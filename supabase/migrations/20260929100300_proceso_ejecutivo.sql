-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §3.6, §3.7, §6).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Estado del proceso ejecutivo del asociado (8 pasos) y fecha de inicio
-- del embargo, en una TABLA APARTE (no en perfiles), como pide la spec:
--   * perfiles tiene la política perfiles_update (el asociado edita su
--     fila); cada columna nueva ahí depende de acordarse de protegerla en
--     proteger_campos_perfil. Una tabla aparte sin privilegios de escritura
--     para authenticated es más difícil de romper.
--   * Escritura: SOLO con la función admin_actualizar_proceso_ejecutivo()
--     (verifica es_admin()). authenticated no tiene insert/update/delete
--     sobre la tabla: ni un asociado ni un admin la escriben directo.
--   * Lectura: el asociado ve su fila; el admin todas. El asesor la ve de
--     sus clientes solo por las funciones del panel del asesor.
--   * Historial: cada cambio de estado o de fecha queda en
--     historial_proceso_ejecutivo (estado anterior/nuevo, fecha, admin y
--     cuándo), lo escribe un trigger. Solo lo lee el admin.
--   * Fecha de inicio del embargo:
--       - al pasar a «operando», si no viene, se fija HOY (hora Colombia);
--       - el admin puede ajustarla (misma función, con p_fecha_inicio_embargo);
--       - antes de «operando» es null (si se devuelve el proceso a un paso
--         anterior, se borra; queda en el historial);
--       - en «terminado» se conserva.
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'estado_proceso_ejecutivo') then
    create type public.estado_proceso_ejecutivo as enum (
      'reparto', 'admitido', 'notificacion', 'sentencia',
      'liquidacion', 'entrega_titulos', 'operando', 'terminado'
    );
  end if;
end $$;

comment on type public.estado_proceso_ejecutivo is
  'Pasos del proceso ejecutivo en orden (spec §3.6): Reparto, Admitido, Notificación, Sentencia, Liquidación, Entrega de títulos, Operando, Terminado.';

-- ------------------------------------------------------------
-- Tabla del estado actual (una fila por asociado)
-- ------------------------------------------------------------
create table if not exists public.procesos_ejecutivos (
  asociado_id           uuid primary key references public.perfiles (id) on delete cascade,
  estado                public.estado_proceso_ejecutivo not null default 'reparto',
  fecha_inicio_embargo  date,
  actualizado_por       uuid references public.perfiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint procesos_ejecutivos_fecha_coherente_chk check (
    (estado < 'operando'::public.estado_proceso_ejecutivo and fecha_inicio_embargo is null)
    or (estado = 'operando'::public.estado_proceso_ejecutivo and fecha_inicio_embargo is not null)
    or  estado = 'terminado'::public.estado_proceso_ejecutivo
  ),
  constraint procesos_ejecutivos_fecha_minima_chk check (
    fecha_inicio_embargo is null or fecha_inicio_embargo >= date '2020-01-01'
  )
);

comment on table public.procesos_ejecutivos is
  'Estado actual del proceso ejecutivo de cada asociado y fecha de inicio del embargo (conteo de 36 meses). Solo se escribe con admin_actualizar_proceso_ejecutivo().';
comment on column public.procesos_ejecutivos.fecha_inicio_embargo is
  'Día (hora Colombia) en que empezó el embargo. Se fija al pasar a operando; el admin la puede ajustar. Fin del conteo = fecha + 36 meses.';

create index if not exists ix_procesos_ejecutivos_actualizado_por on public.procesos_ejecutivos (actualizado_por);
create index if not exists ix_procesos_ejecutivos_estado on public.procesos_ejecutivos (estado);

alter table public.procesos_ejecutivos enable row level security;
revoke all on public.procesos_ejecutivos from anon, authenticated;
grant select on public.procesos_ejecutivos to authenticated;

drop policy if exists "procesos_select" on public.procesos_ejecutivos;
create policy "procesos_select" on public.procesos_ejecutivos
  for select to authenticated
  using (asociado_id = (select auth.uid()) or (select public.es_admin()));
-- Sin políticas ni privilegios de insert/update/delete: solo la función de abajo.

-- ------------------------------------------------------------
-- Historial (quién, qué, cuándo)
-- ------------------------------------------------------------
create table if not exists public.historial_proceso_ejecutivo (
  id                    bigint generated always as identity primary key,
  asociado_id           uuid not null references public.perfiles (id) on delete cascade,
  estado_anterior       public.estado_proceso_ejecutivo,
  estado_nuevo          public.estado_proceso_ejecutivo not null,
  fecha_inicio_embargo  date,
  admin_id              uuid references public.perfiles (id),
  created_at            timestamptz not null default now()
);

comment on table public.historial_proceso_ejecutivo is
  'Cada cambio de estado o de fecha de inicio del proceso ejecutivo: estado anterior y nuevo, fecha vigente, admin que lo hizo y cuándo. Solo lo escribe un trigger; solo lo lee el admin.';

create index if not exists ix_historial_proceso_asociado
  on public.historial_proceso_ejecutivo (asociado_id, created_at desc);
create index if not exists ix_historial_proceso_admin
  on public.historial_proceso_ejecutivo (admin_id);

alter table public.historial_proceso_ejecutivo enable row level security;
revoke all on public.historial_proceso_ejecutivo from anon, authenticated;
grant select on public.historial_proceso_ejecutivo to authenticated;

drop policy if exists "historial_proceso_select_admin" on public.historial_proceso_ejecutivo;
create policy "historial_proceso_select_admin" on public.historial_proceso_ejecutivo
  for select to authenticated using ((select public.es_admin()));

-- ------------------------------------------------------------
-- BEFORE: reglas de la fecha y sello de quién/cuándo
-- ------------------------------------------------------------
create or replace function public.normalizar_proceso_ejecutivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  -- Defensa en profundidad: con sesión, solo un admin (la tabla ya no da
  -- privilegios de escritura a authenticated).
  if auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar el proceso ejecutivo';
  end if;

  if tg_op = 'UPDATE' then
    if new.asociado_id is distinct from old.asociado_id then
      raise exception 'El proceso no puede cambiar de asociado';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;

  if new.estado < 'operando'::public.estado_proceso_ejecutivo then
    new.fecha_inicio_embargo := null;
  elsif new.estado = 'operando'::public.estado_proceso_ejecutivo and new.fecha_inicio_embargo is null then
    new.fecha_inicio_embargo := v_hoy;  -- por defecto, el día del cambio
  end if;

  if new.fecha_inicio_embargo is not null and new.fecha_inicio_embargo > v_hoy + 31 then
    raise exception 'La fecha de inicio del embargo no puede estar a más de un mes en el futuro';
  end if;

  new.actualizado_por := auth.uid();
  new.updated_at      := now();
  return new;
end;
$$;
revoke all on function public.normalizar_proceso_ejecutivo() from public, anon, authenticated;

drop trigger if exists tr_normalizar_proceso_ejecutivo on public.procesos_ejecutivos;
create trigger tr_normalizar_proceso_ejecutivo
  before insert or update on public.procesos_ejecutivos
  for each row execute function public.normalizar_proceso_ejecutivo();

-- ------------------------------------------------------------
-- AFTER: historial
-- ------------------------------------------------------------
create or replace function public.log_historial_proceso_ejecutivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.estado is distinct from old.estado
     or new.fecha_inicio_embargo is distinct from old.fecha_inicio_embargo then
    insert into public.historial_proceso_ejecutivo
      (asociado_id, estado_anterior, estado_nuevo, fecha_inicio_embargo, admin_id)
    values (
      new.asociado_id,
      case when tg_op = 'UPDATE' then old.estado end,
      new.estado,
      new.fecha_inicio_embargo,
      auth.uid()
    );
  end if;
  return null;
end;
$$;
revoke all on function public.log_historial_proceso_ejecutivo() from public, anon, authenticated;

drop trigger if exists tr_historial_proceso_ejecutivo on public.procesos_ejecutivos;
create trigger tr_historial_proceso_ejecutivo
  after insert or update on public.procesos_ejecutivos
  for each row execute function public.log_historial_proceso_ejecutivo();

-- ------------------------------------------------------------
-- RPC del admin: crear o cambiar el proceso de un asociado
--   p_fecha_inicio_embargo null = conservar la actual (o, al pasar a
--   operando, usar hoy). Con valor = ajustarla (solo desde operando).
-- ------------------------------------------------------------
create or replace function public.admin_actualizar_proceso_ejecutivo(
  p_asociado_id          uuid,
  p_estado               public.estado_proceso_ejecutivo,
  p_fecha_inicio_embargo date default null
)
returns public.procesos_ejecutivos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.procesos_ejecutivos;
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede cambiar el proceso ejecutivo';
  end if;
  if p_asociado_id is null or p_estado is null then
    raise exception 'Faltan datos para actualizar el proceso ejecutivo';
  end if;
  if not exists (select 1 from public.perfiles p where p.id = p_asociado_id) then
    raise exception 'No existe ese asociado';
  end if;
  if p_fecha_inicio_embargo is not null
     and p_estado < 'operando'::public.estado_proceso_ejecutivo then
    raise exception 'La fecha de inicio del embargo solo se registra desde el paso «Operando»';
  end if;

  insert into public.procesos_ejecutivos as pe (asociado_id, estado, fecha_inicio_embargo)
  values (p_asociado_id, p_estado, p_fecha_inicio_embargo)
  on conflict (asociado_id) do update
     set estado = excluded.estado,
         fecha_inicio_embargo = coalesce(excluded.fecha_inicio_embargo, pe.fecha_inicio_embargo)
  returning pe.* into v_fila;

  return v_fila;
end;
$$;
revoke all on function public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date) from public, anon;
grant execute on function public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date) to authenticated;
comment on function public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date) is
  'Solo admin (lo revisa la función). Crea o cambia el estado del proceso ejecutivo; al pasar a operando fija la fecha de inicio (hoy si no se manda). Deja historial.';
