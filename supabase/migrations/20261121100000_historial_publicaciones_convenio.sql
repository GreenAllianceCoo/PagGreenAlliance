-- ============================================================
-- Convenios B4 · Historial de ocultar / volver a mostrar publicaciones
-- (docs/spec-convenios.md §B4: «Queda en el historial del admin quién
-- ocultó y cuándo»).
--
--  1. historial_publicaciones_convenio: una fila cada vez que Green Alliance
--     oculta o vuelve a mostrar una publicación. Guarda el título y el nombre
--     del convenio del momento, así sobrevive aunque la publicación se retire.
--     La escribe solo el trigger (security definer); la lee solo un admin.
--  2. admin_historial_equipo(): suma esos eventos (tipo «publicacion»).
--
-- La fila de convenio_publicaciones ya sella oculta_en / oculta_por; pero al
-- volver a mostrar se limpian, por eso hace falta esta tabla aparte.
-- Idempotente.
-- APLICADA en producción el 2026-11-22 (autorizada por Sebas).
-- ============================================================

create table if not exists public.historial_publicaciones_convenio (
  id              bigint generated always as identity primary key,
  publicacion_id  uuid,
  convenio_id     uuid references public.convenios (id) on delete set null,
  convenio_nombre text not null,
  titulo          text not null,
  actor_id        uuid references public.perfiles (id) on delete set null,
  accion          text not null check (accion in ('ocultada', 'mostrada')),
  motivo          text check (motivo is null or char_length(motivo) <= 200),
  created_at      timestamptz not null default now()
);
comment on table public.historial_publicaciones_convenio is
  'Quién ocultó o volvió a mostrar cada publicación de convenio y cuándo. Solo la escribe el trigger; solo la lee un admin.';

create index if not exists historial_publicaciones_convenio_actor_idx
  on public.historial_publicaciones_convenio (actor_id, created_at desc);
create index if not exists historial_publicaciones_convenio_convenio_idx
  on public.historial_publicaciones_convenio (convenio_id);
create index if not exists historial_publicaciones_convenio_publicacion_idx
  on public.historial_publicaciones_convenio (publicacion_id, created_at desc);

alter table public.historial_publicaciones_convenio enable row level security;
revoke all on table public.historial_publicaciones_convenio from anon, authenticated;
grant select on table public.historial_publicaciones_convenio to authenticated;

drop policy if exists historial_publicaciones_convenio_select_admin on public.historial_publicaciones_convenio;
create policy historial_publicaciones_convenio_select_admin on public.historial_publicaciones_convenio
  for select to authenticated
  using ((select public.es_admin()));

-- Después de guardar: si cambió «oculta», deja la huella.
create or replace function public.convenio_publicaciones_registrar_moderacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.oculta_en is null) = (new.oculta_en is null) then
    return null;
  end if;
  insert into public.historial_publicaciones_convenio
    (publicacion_id, convenio_id, convenio_nombre, titulo, actor_id, accion, motivo)
  select new.id, new.convenio_id, coalesce(c.nombre_empresa, 'un convenio'), new.titulo,
         auth.uid(),
         case when new.oculta_en is null then 'mostrada' else 'ocultada' end,
         case when new.oculta_en is null then null else new.oculta_motivo end
    from (select 1) x
    left join public.convenios c on c.id = new.convenio_id;
  return null;
end;
$$;
revoke all on function public.convenio_publicaciones_registrar_moderacion() from public, anon, authenticated;

drop trigger if exists tr_convenio_publicaciones_registrar_moderacion on public.convenio_publicaciones;
create trigger tr_convenio_publicaciones_registrar_moderacion
  after update of oculta_en on public.convenio_publicaciones
  for each row execute function public.convenio_publicaciones_registrar_moderacion();

-- ------------------------------------------------------------
-- admin_historial_equipo: igual que 20261003300000 + «publicacion».
-- ------------------------------------------------------------
create or replace function public.admin_historial_equipo(
  p_actor  uuid default null,
  p_desde  date default null,
  p_hasta  date default null,
  p_limite integer default 25,
  p_pagina integer default 1
)
returns table (
  cuando         timestamptz,
  actor_id       uuid,
  actor_nombre   text,
  actor_rol      text,
  tipo           text,
  objetivo       text,
  detalle        text,
  extra          text,
  motivo         text,
  total          bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede ver el historial del equipo' using errcode = '42501';
  end if;

  return query
  with ev as (
    -- Afiliaciones: quién cambió el estado.
    select h.created_at as cuando, h.actor_id as actor, 'afiliacion'::text as tipo,
           coalesce(s.nombre, 'un solicitante') as objetivo,
           h.estado_nuevo::text as detalle, h.estado_anterior::text as extra, null::text as motivo
      from public.historial_afiliaciones h
      join public.solicitudes_afiliacion s on s.id = h.solicitud_id
    union all
    -- Proceso ejecutivo.
    select h.created_at, h.admin_id, 'proceso',
           coalesce(a.nombre_completo, 'un asociado'),
           h.estado_nuevo::text, h.fecha_inicio_embargo::text, null
      from public.historial_proceso_ejecutivo h
      left join public.perfiles a on a.id = h.asociado_id
    union all
    -- Asignaciones de asesor.
    select h.created_at, h.actor_id, 'asesor',
           coalesce(a.nombre_completo, 'un asociado'),
           (select n.nombre_completo from public.perfiles n where n.id = h.asesor_nuevo_id),
           (select n.nombre_completo from public.perfiles n where n.id = h.asesor_anterior_id), null
      from public.historial_cambio_asesor h
      left join public.perfiles a on a.id = h.perfil_id
    union all
    -- Cambios de rol.
    select h.created_at, h.actor_id, 'rol',
           coalesce(a.nombre_completo, 'una persona'),
           h.rol_nuevo, h.rol_anterior, h.motivo
      from public.historial_cambio_rol h
      left join public.perfiles a on a.id = h.perfil_id
    union all
    -- Bajas, reactivaciones y desactivaciones del equipo.
    select h.created_at, h.admin_id, 'estado',
           coalesce(a.nombre_completo, 'una persona'),
           h.activo_nuevo::text, a.rol::text, h.motivo
      from public.historial_estado_asociado h
      left join public.perfiles a on a.id = h.asociado_id
    union all
    -- Créditos: aprobar, rechazar, desembolsar, habilitar, comprobante.
    select h.created_at, h.actor_id, 'credito',
           coalesce(a.nombre_completo, 'un asociado'),
           h.accion,
           null,
           case when h.accion in ('rechazado', 'credito_habilitado') then h.detalle end
      from public.historial_solicitudes h
      join public.solicitudes_credito c on c.id = h.entidad_id
      left join public.perfiles a on a.id = c.asociado_id
     where h.entidad = 'solicitud_credito'::public.historial_entidad
       and h.accion in ('aprobado', 'rechazado', 'desembolsado', 'credito_habilitado', 'comprobante_desembolso')
    union all
    -- Publicaciones de convenios: ocultar y volver a mostrar.
    select h.created_at, h.actor_id, 'publicacion',
           h.convenio_nombre, h.accion, h.titulo, h.motivo
      from public.historial_publicaciones_convenio h
  )
  select e.cuando, e.actor, p.nombre_completo::text, p.rol::text, e.tipo, e.objetivo, e.detalle, e.extra, e.motivo,
         count(*) over ()
    from ev e
    join public.perfiles p on p.id = e.actor and p.rol::text <> 'asociado'
   where (p_actor is null or e.actor = p_actor)
     and (p_desde is null or (e.cuando at time zone 'America/Bogota')::date >= p_desde)
     and (p_hasta is null or (e.cuando at time zone 'America/Bogota')::date <= p_hasta)
   order by e.cuando desc, e.tipo
   limit v_limite offset (v_pagina - 1) * v_limite;
end;
$$;
revoke all on function public.admin_historial_equipo(uuid, date, date, integer, integer) from public, anon;
grant execute on function public.admin_historial_equipo(uuid, date, date, integer, integer) to authenticated;
comment on function public.admin_historial_equipo(uuid, date, date, integer, integer) is
  'Solo admin. Lo que hicieron admins, secretarios y asesores (afiliaciones, proceso ejecutivo, asesor, rol, bajas, créditos, publicaciones de convenios), más reciente primero, filtrable por persona y fechas y paginado.';
