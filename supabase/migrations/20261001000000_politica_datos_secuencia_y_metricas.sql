-- ============================================================
-- ga-auditor-supabase, 2026-09-30. Idempotente.
-- 1) Version de la politica de datos aceptada en la afiliacion.
-- 2) P-55: anon/authenticated sin permisos sobre limites_intentos_id_seq.
-- 3) Metricas agregadas para los dashboards 4.7 (admin) y 4.8 (asesor):
--    solo conteos y sumas, nunca filas con datos personales.
-- ============================================================

-- 1) version_politica_datos ----------------------------------
alter table public.solicitudes_afiliacion
  add column if not exists version_politica_datos text;

comment on column public.solicitudes_afiliacion.version_politica_datos is
  'Version de la politica de tratamiento de datos aceptada (VERSION_POLITICA_DATOS de lib/politica-datos.ts). Obligatoria en filas nuevas (si el servidor no la envia se sella la vigente) e inmutable. Filas anteriores al 2026-10-01 quedan en null.';

-- Formato corto (p. ej. 1.0). NOT VALID: no revisa filas viejas.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'solicitudes_afiliacion_version_politica_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_version_politica_chk
      check (version_politica_datos is null
             or version_politica_datos ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$')
      not valid;
  end if;
end $$;

-- Version vigente en un solo sitio (igual a VERSION_POLITICA_DATOS de
-- lib/politica-datos.ts). Al publicar una version nueva se cambia aqui y alli.
create or replace function public.version_politica_datos_vigente()
returns text
language sql
immutable
set search_path = ''
as $$ select '1.0'::text $$;
revoke all on function public.version_politica_datos_vigente() from public, anon;
grant execute on function public.version_politica_datos_vigente() to authenticated, service_role;

-- INSERT: si el servidor no envia la version se sella la vigente (ninguna fila
-- nueva queda en null y el formulario actual no se rompe mientras
-- app/afiliacion/actions.ts empieza a enviarla); si la envia, el check valida
-- el formato. UPDATE: inmutable.
create or replace function public.tr_version_politica_datos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(new.version_politica_datos), '') is null then
      new.version_politica_datos := public.version_politica_datos_vigente();
    end if;
  elsif new.version_politica_datos is distinct from old.version_politica_datos then
    raise exception 'version_politica_datos no se puede modificar';
  end if;
  return new;
end;
$$;
revoke all on function public.tr_version_politica_datos() from public, anon, authenticated;

drop trigger if exists tr_version_politica_datos on public.solicitudes_afiliacion;
create trigger tr_version_politica_datos
  before insert or update of version_politica_datos on public.solicitudes_afiliacion
  for each row execute function public.tr_version_politica_datos();

-- El perfil no la copia: la prueba de la autorizacion vive en la solicitud
-- (enlazada por cedula). Si la cooperativa pide re-aceptar versiones nuevas
-- desde el perfil, se agrega entonces una tabla de aceptaciones.

-- 2) P-55 ----------------------------------------------------
-- Nadie fuera del servidor inserta en limites_intentos (registrar_intento
-- es security definer), asi que la secuencia no la necesitan anon/authenticated.
revoke all on sequence public.limites_intentos_id_seq from public, anon, authenticated;

-- 3) Metricas ------------------------------------------------
create or replace function public.admin_metricas_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mes as (
    select date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota' as ini,
           extract(year  from now() at time zone 'America/Bogota')::int as anio,
           extract(month from now() at time zone 'America/Bogota')::int as mes
  )
  select case when not coalesce((select public.es_admin()), false) then null else jsonb_build_object(
    'asociados_activos', (select count(*) from public.perfiles p
                          where p.rol = 'asociado'::public.rol_usuario and p.activo),
    'asociados_por_grado', coalesce((select jsonb_object_agg(g, n) from (
        select coalesce(p.grado::text, 'sin_grado') g, count(*) n
        from public.perfiles p
        where p.rol = 'asociado'::public.rol_usuario and p.activo
        group by 1) x), '{}'::jsonb),
    'asociados_por_institucion', coalesce((select jsonb_object_agg(i, n) from (
        select coalesce(p.institucion::text, 'sin_institucion') i, count(*) n
        from public.perfiles p
        where p.rol = 'asociado'::public.rol_usuario and p.activo
        group by 1) x), '{}'::jsonb),
    'afiliaciones_pendientes', (select count(*) from public.solicitudes_afiliacion a
                                where a.estado = 'pendiente'::public.estado_afiliacion),
    'creditos_pendientes', (select count(*) from public.solicitudes_credito s
                            where s.estado = 'pendiente'::public.estado_solicitud),
    'monto_solicitado_mes', (select coalesce(sum(s.monto_solicitado), 0) from public.solicitudes_credito s, mes
                             where s.fecha_solicitud >= mes.ini),
    'monto_aprobado_mes', (select coalesce(sum(s.monto_solicitado), 0) from public.solicitudes_credito s, mes
                           where s.estado = 'aprobado'::public.estado_solicitud
                             and s.fecha_respuesta >= mes.ini),
    'inscritos_sorteo_mes', (select count(distinct b.asociado_id) from public.boletas_sorteo b, mes
                             where b.anio = mes.anio and b.mes = mes.mes)
  ) end;
$$;
revoke all on function public.admin_metricas_dashboard() from public, anon;
grant execute on function public.admin_metricas_dashboard() to authenticated;
comment on function public.admin_metricas_dashboard() is
  'Dashboard 4.7: solo conteos y sumas (mes en hora de Bogota). null si quien llama no es admin.';

create or replace function public.asesor_metricas_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not coalesce((select public.puede_atender((select auth.uid()))), false) then null else jsonb_build_object(
    'clientes_total', (select count(*) from public.perfiles p
                       where p.asesor_id = (select auth.uid())),
    'clientes_por_estado_credito', coalesce((select jsonb_object_agg(e, n) from (
        select coalesce(u.estado::text, 'sin_solicitud') e, count(*) n
        from public.perfiles p
        left join lateral (
          select s.estado from public.solicitudes_credito s
          where s.asociado_id = p.id order by s.fecha_solicitud desc limit 1
        ) u on true
        where p.asesor_id = (select auth.uid())
        group by 1) x), '{}'::jsonb),
    'creditos_pendientes', (select count(*) from public.solicitudes_credito s
                            join public.perfiles p on p.id = s.asociado_id
                            where p.asesor_id = (select auth.uid())
                              and s.estado = 'pendiente'::public.estado_solicitud),
    'afiliaciones_por_estado', coalesce((select jsonb_object_agg(e, n) from (
        select a.estado::text e, count(*) n from public.solicitudes_afiliacion a
        where a.asesor_id = (select auth.uid()) group by 1) x), '{}'::jsonb),
    'afiliaciones_referidas_mes', (select count(*) from public.solicitudes_afiliacion a
                                   where a.asesor_id = (select auth.uid())
                                     and a.created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota')
  ) end;
$$;
revoke all on function public.asesor_metricas_dashboard() from public, anon;
grant execute on function public.asesor_metricas_dashboard() to authenticated;
comment on function public.asesor_metricas_dashboard() is
  'Dashboard 4.8: conteos de los clientes del asesor que llama (F2-03). null si no puede_atender() hoy.';
