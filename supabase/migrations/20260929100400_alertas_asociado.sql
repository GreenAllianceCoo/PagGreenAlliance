-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §3.8, §3.9, §6).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100300_proceso_ejecutivo.sql.
--
-- Alertas del asociado al admin: «Retiro anticipado» y «Renovar los 36 meses».
--   * El asociado NO inserta directo: crear_alerta_asociado(tipo) valida
--       - retiro_anticipado: proceso en «operando» y conteo de 36 meses
--         activo (R-05);
--       - renovacion: proceso en «operando» y ya pasaron 24 meses desde
--         fecha_inicio_embargo (R-06);
--       - no hay otra alerta PENDIENTE del mismo tipo (índice único parcial,
--         no solo código).
--   * El asociado ve sus alertas (para desactivar el botón); el admin ve
--     todas y las marca «atendida» con admin_marcar_alerta_atendida().
--   * El correo a los admins lo manda el servidor después de crear la
--     alerta; correos_admins() le da la lista (solo service_role).
--   * mi_proceso_ejecutivo(): todo lo que /cuenta necesita para el conteo
--     y los dos botones, calculado en la base con la hora de Colombia.
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'tipo_alerta_asociado') then
    create type public.tipo_alerta_asociado as enum ('retiro_anticipado', 'renovacion');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'estado_alerta_asociado') then
    create type public.estado_alerta_asociado as enum ('pendiente', 'atendida');
  end if;
end $$;

create table if not exists public.alertas_asociado (
  id           uuid primary key default gen_random_uuid(),
  asociado_id  uuid not null references public.perfiles (id) on delete cascade,
  tipo         public.tipo_alerta_asociado not null,
  estado       public.estado_alerta_asociado not null default 'pendiente',
  created_at   timestamptz not null default now(),
  atendida_por uuid references public.perfiles (id),
  atendida_at  timestamptz,
  constraint alertas_asociado_atencion_chk check (
    (estado = 'pendiente'::public.estado_alerta_asociado and atendida_por is null and atendida_at is null)
    or (estado = 'atendida'::public.estado_alerta_asociado and atendida_at is not null)
  )
);

comment on table public.alertas_asociado is
  'Avisos del asociado al admin (retiro anticipado, renovación). Se crean con crear_alerta_asociado() y se cierran con admin_marcar_alerta_atendida().';

-- Una sola pendiente por asociado y tipo (garantía en la base).
create unique index if not exists ux_alertas_pendiente_por_tipo
  on public.alertas_asociado (asociado_id, tipo)
  where estado = 'pendiente'::public.estado_alerta_asociado;
create index if not exists ix_alertas_bandeja
  on public.alertas_asociado (estado, created_at desc);
create index if not exists ix_alertas_asociado
  on public.alertas_asociado (asociado_id, created_at desc);
create index if not exists ix_alertas_atendida_por
  on public.alertas_asociado (atendida_por);

alter table public.alertas_asociado enable row level security;
revoke all on public.alertas_asociado from anon, authenticated;
grant select on public.alertas_asociado to authenticated;

drop policy if exists "alertas_select" on public.alertas_asociado;
create policy "alertas_select" on public.alertas_asociado
  for select to authenticated
  using (asociado_id = (select auth.uid()) or (select public.es_admin()));
-- Sin insert/update/delete para authenticated: solo por las funciones.

-- ------------------------------------------------------------
-- El asociado crea su alerta
-- ------------------------------------------------------------
create or replace function public.crear_alerta_asociado(p_tipo public.tipo_alerta_asociado)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_hoy  date := (now() at time zone 'America/Bogota')::date;
  v_proc public.procesos_ejecutivos%rowtype;
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_tipo is null then
    raise exception 'Falta el tipo de aviso';
  end if;

  select * into v_proc from public.procesos_ejecutivos pe where pe.asociado_id = v_uid;

  if not found
     or v_proc.estado <> 'operando'::public.estado_proceso_ejecutivo
     or v_proc.fecha_inicio_embargo is null then
    raise exception 'Esta opción se habilita cuando tu proceso esté operando';
  end if;

  if p_tipo = 'retiro_anticipado'::public.tipo_alerta_asociado then
    -- TODO(confirmar: R-05) visible desde «operando» y mientras el conteo esté activo.
    if v_hoy >= (v_proc.fecha_inicio_embargo + interval '36 months')::date then
      raise exception 'Tu conteo de 36 meses ya terminó';
    end if;
  else
    -- TODO(confirmar: R-06) se habilita a los 24 meses de fecha_inicio_embargo.
    if v_hoy < (v_proc.fecha_inicio_embargo + interval '24 months')::date then
      raise exception 'La renovación se habilita cuando pasen 24 meses desde el inicio de tu embargo';
    end if;
  end if;

  if exists (
    select 1 from public.alertas_asociado a
    where a.asociado_id = v_uid and a.tipo = p_tipo
      and a.estado = 'pendiente'::public.estado_alerta_asociado
  ) then
    raise exception 'Ya avisaste al administrador; te contactará pronto';
  end if;

  begin
    insert into public.alertas_asociado (asociado_id, tipo)
    values (v_uid, p_tipo)
    returning id into v_id;
  exception when unique_violation then
    -- Dos clics a la vez: el índice único parcial frena el segundo.
    raise exception 'Ya avisaste al administrador; te contactará pronto';
  end;

  return v_id;
end;
$$;
revoke all on function public.crear_alerta_asociado(public.tipo_alerta_asociado) from public, anon;
grant execute on function public.crear_alerta_asociado(public.tipo_alerta_asociado) to authenticated;
comment on function public.crear_alerta_asociado(public.tipo_alerta_asociado) is
  'El asociado en sesión avisa al admin (retiro anticipado o renovación). Valida el estado del proceso, los plazos y que no haya otra pendiente del mismo tipo. Devuelve el id de la alerta.';

-- ------------------------------------------------------------
-- El admin la marca atendida
-- ------------------------------------------------------------
create or replace function public.admin_marcar_alerta_atendida(p_alerta_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede atender alertas';
  end if;

  update public.alertas_asociado
     set estado = 'atendida'::public.estado_alerta_asociado,
         atendida_por = auth.uid(),
         atendida_at = now()
   where id = p_alerta_id
     and estado = 'pendiente'::public.estado_alerta_asociado;

  if not found then
    raise exception 'La alerta no existe o ya estaba atendida';
  end if;
end;
$$;
revoke all on function public.admin_marcar_alerta_atendida(uuid) from public, anon;
grant execute on function public.admin_marcar_alerta_atendida(uuid) to authenticated;
comment on function public.admin_marcar_alerta_atendida(uuid) is
  'Solo admin (lo revisa la función): marca una alerta pendiente como atendida, con quién y cuándo.';

-- ------------------------------------------------------------
-- Correos de los admins, para avisarles (solo el servidor)
-- ------------------------------------------------------------
create or replace function public.correos_admins()
returns table (correo text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.rol = 'admin'::public.rol_usuario
    and p.activo
    and u.email is not null;
$$;
revoke all on function public.correos_admins() from public, anon, authenticated;
grant execute on function public.correos_admins() to service_role;
comment on function public.correos_admins() is
  'Correos de los admins activos, para el aviso de una alerta nueva. Solo service_role.';

-- ------------------------------------------------------------
-- Lo que /cuenta necesita del proceso (una fila, o ninguna si aún no hay proceso)
-- ------------------------------------------------------------
create or replace function public.mi_proceso_ejecutivo()
returns table (
  estado                        public.estado_proceso_ejecutivo,
  fecha_inicio_embargo          date,
  fecha_fin_embargo             date,     -- inicio + 36 meses
  fecha_habilita_renovacion     date,     -- inicio + 24 meses
  conteo_activo                 boolean,  -- operando y hoy < fin
  puede_pedir_retiro            boolean,
  puede_pedir_renovacion        boolean,
  retiro_pendiente              boolean,
  renovacion_pendiente          boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select pe.estado,
           pe.fecha_inicio_embargo,
           (pe.fecha_inicio_embargo + interval '36 months')::date as fin,
           (pe.fecha_inicio_embargo + interval '24 months')::date as renov,
           (now() at time zone 'America/Bogota')::date as hoy,
           exists (select 1 from public.alertas_asociado a
                    where a.asociado_id = pe.asociado_id
                      and a.tipo = 'retiro_anticipado'::public.tipo_alerta_asociado
                      and a.estado = 'pendiente'::public.estado_alerta_asociado) as ret_pend,
           exists (select 1 from public.alertas_asociado a
                    where a.asociado_id = pe.asociado_id
                      and a.tipo = 'renovacion'::public.tipo_alerta_asociado
                      and a.estado = 'pendiente'::public.estado_alerta_asociado) as ren_pend
    from public.procesos_ejecutivos pe
    where pe.asociado_id = (select auth.uid())
  )
  select b.estado,
         b.fecha_inicio_embargo,
         b.fin,
         b.renov,
         coalesce(b.estado = 'operando'::public.estado_proceso_ejecutivo and b.hoy < b.fin, false),
         coalesce(b.estado = 'operando'::public.estado_proceso_ejecutivo and b.hoy < b.fin and not b.ret_pend, false),
         coalesce(b.estado = 'operando'::public.estado_proceso_ejecutivo and b.hoy >= b.renov and not b.ren_pend, false),
         b.ret_pend,
         b.ren_pend
  from base b;
$$;
revoke all on function public.mi_proceso_ejecutivo() from public, anon;
grant execute on function public.mi_proceso_ejecutivo() to authenticated;
comment on function public.mi_proceso_ejecutivo() is
  'Proceso ejecutivo del usuario en sesión con fechas del conteo (36 y 24 meses, hora Colombia) y si puede pedir retiro/renovación. 0 filas si aún no tiene proceso.';
