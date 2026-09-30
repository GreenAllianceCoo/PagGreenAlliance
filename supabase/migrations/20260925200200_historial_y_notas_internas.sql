-- ============================================================
-- ga-auditor-supabase, 2026-09-25 — Brecha de backend del rediseño C+ (pieza 2d).
-- PROPUESTA: NO APLICADA. Sebas la revisa y la aplica.
--
-- El panel de admin (2d) pide «nota interna · solo la ve el equipo» e
-- «Historial: quién hizo qué y cuándo» por solicitud (crédito o
-- afiliación). Ninguna de las dos existe hoy.
--
-- Diseño elegido: UNA sola tabla (historial_solicitudes) para ambas cosas,
-- en vez de una columna nota_interna en solicitudes_credito /
-- solicitudes_afiliacion:
--
--  * Riesgo descartado: solicitudes_credito NO tiene ningún
--    `grant select (columnas)` — el proyecto le da a `authenticated` el
--    privilegio por defecto de Supabase sobre toda la tabla, y la única
--    barrera es RLS por FILA (solicitudes_select: el propio asociado ve su
--    fila completa). Si nota_interna fuera una columna ahí, el asociado la
--    leería con su propia sesión (GET /rest/v1/solicitudes_credito?select=
--    nota_interna) aunque la pantalla nunca la muestre. Hay que restringir
--    por COLUMNA (como se hizo con boletas_sorteo.numero en 20260924000600)
--    o, más simple y sin tocar los privilegios ya auditados de una tabla
--    crítica: no poner el dato ahí. Se eligió lo segundo.
--  * historial_solicitudes es una tabla nueva, sin RLS de "fila propia": la
--    única política de select exige es_admin(), así que un asociado no
--    tiene ninguna vía (ni columna ni fila) para leerla.
--  * Se registran solo (SECURITY DEFINER, dueño postgres, igual que
--    limites_intentos): nadie autenticado tiene insert/update/delete
--    directo. La app agrega una nota con la función
--    agregar_nota_solicitud(); los cambios de estado quedan solos con
--    triggers AFTER en las dos tablas de solicitudes.
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'historial_entidad') then
    create type public.historial_entidad as enum ('solicitud_credito', 'solicitud_afiliacion');
  end if;
end $$;

create table if not exists public.historial_solicitudes (
  id         uuid primary key default gen_random_uuid(),
  entidad    public.historial_entidad not null,
  entidad_id uuid not null,
  actor_id   uuid references public.perfiles(id),
  accion     text not null check (char_length(accion) between 1 and 60),
  detalle    text check (detalle is null or char_length(detalle) <= 1000),
  created_at timestamptz not null default now()
);

comment on table public.historial_solicitudes is
  'Quién hizo qué y cuándo sobre una solicitud de crédito o de afiliación, más las notas internas (accion = ''nota''). Solo lo escriben triggers/funciones SECURITY DEFINER; solo lo lee el admin.';
comment on column public.historial_solicitudes.accion is
  'Para cambios de estado: el valor del enum (pendiente/aprobado/rechazado/contactado/...). Para notas: ''nota''. Para la creación: ''creada''.';

create index if not exists ix_historial_solicitudes_entidad
  on public.historial_solicitudes (entidad, entidad_id, created_at desc);

alter table public.historial_solicitudes enable row level security;
revoke all on public.historial_solicitudes from anon, authenticated;
grant select on public.historial_solicitudes to authenticated;  -- RLS de abajo lo limita a admin

drop policy if exists "historial_select_admin" on public.historial_solicitudes;
create policy "historial_select_admin" on public.historial_solicitudes
  for select to authenticated using ((select public.es_admin()));
-- Sin política de insert/update/delete para authenticated: solo entran filas
-- por los triggers y por agregar_nota_solicitud(), que corren como el dueño
-- de la tabla (postgres) y por eso no necesitan una política que los deje pasar.

-- ------------------------------------------------------------
-- Registrar automáticamente: solicitud creada y cambios de estado.
-- ------------------------------------------------------------
create or replace function public.log_historial_credito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
    values ('solicitud_credito'::public.historial_entidad, new.id, new.asociado_id, 'creada', null);
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
    values (
      'solicitud_credito'::public.historial_entidad,
      new.id,
      new.revisado_por,
      new.estado::text,
      case when new.estado = 'rechazado'::public.estado_solicitud then new.motivo_rechazo else null end
    );
  end if;
  return null;  -- trigger AFTER: el valor de retorno se ignora
end;
$$;
revoke all on function public.log_historial_credito() from public, anon, authenticated;

drop trigger if exists tr_historial_credito on public.solicitudes_credito;
create trigger tr_historial_credito
  after insert or update on public.solicitudes_credito
  for each row execute function public.log_historial_credito();

create or replace function public.log_historial_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
    values ('solicitud_afiliacion'::public.historial_entidad, new.id, null, 'creada', null);
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
    values ('solicitud_afiliacion'::public.historial_entidad, new.id, new.revisado_por, new.estado::text, null);
  end if;
  return null;
end;
$$;
revoke all on function public.log_historial_afiliacion() from public, anon, authenticated;

drop trigger if exists tr_historial_afiliacion on public.solicitudes_afiliacion;
create trigger tr_historial_afiliacion
  after insert or update on public.solicitudes_afiliacion
  for each row execute function public.log_historial_afiliacion();

-- ------------------------------------------------------------
-- Nota interna: la agrega un admin, queda en el historial (accion = 'nota').
-- ------------------------------------------------------------
create or replace function public.agregar_nota_solicitud(
  p_entidad    public.historial_entidad,
  p_entidad_id uuid,
  p_nota       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede agregar notas internas';
  end if;
  if p_nota is null or char_length(btrim(p_nota)) = 0 then
    raise exception 'La nota no puede estar vacía';
  end if;
  if char_length(p_nota) > 1000 then
    raise exception 'La nota es demasiado larga (máximo 1000 caracteres)';
  end if;
  if p_entidad = 'solicitud_credito'::public.historial_entidad
     and not exists (select 1 from public.solicitudes_credito s where s.id = p_entidad_id) then
    raise exception 'No existe esa solicitud de crédito';
  end if;
  if p_entidad = 'solicitud_afiliacion'::public.historial_entidad
     and not exists (select 1 from public.solicitudes_afiliacion a where a.id = p_entidad_id) then
    raise exception 'No existe esa solicitud de afiliación';
  end if;

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values (p_entidad, p_entidad_id, auth.uid(), 'nota', btrim(p_nota));
end;
$$;
revoke all on function public.agregar_nota_solicitud(public.historial_entidad, uuid, text) from public, anon;
grant execute on function public.agregar_nota_solicitud(public.historial_entidad, uuid, text) to authenticated;
comment on function public.agregar_nota_solicitud(public.historial_entidad, uuid, text) is
  'Agrega una nota interna (accion=''nota'') al historial de una solicitud. Solo admin (lo revisa la propia función, no solo RLS).';
