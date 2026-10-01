-- ============================================================
-- ga-auditor-supabase, 2026-10-01 — spec §13.2 y dashboards D-22/D-23.
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Idempotente.
--
-- §13.2 «el asociado queda bloqueado tras un rechazo». Diagnóstico:
--   * En la base NO hay ninguna regla que bloquee por un rechazo. Al crear
--     una solicitud solo se exige: activo (chk_asociado_activo_credito),
--     proceso en «operando» (chk_credito_proceso_operando), grado con grupo
--     y tope (chk_monto_solicitud) y una sola PENDIENTE
--     (ux_solicitud_pendiente_por_asociado). Una rechazada no cuenta.
--   * La app (/cuenta/solicitar y su acción) solo frena por «pendiente».
--   * Lo que el asociado percibe como bloqueo: /cuenta muestra siempre la
--     ÚLTIMA solicitud; tras un rechazo la tarjeta queda en «Rechazada»
--     (paso actual) y el botón grande «Nueva solicitud» solo existe en la
--     tarjeta vacía; queda el mosaico pequeño. Si además el admin no tiene al
--     asociado en «operando» (o el grado no tiene cupo), el mosaico sale
--     apagado y el mensaje no menciona el rechazo.
--
-- Solución: admin_habilitar_credito(p_asociado_id, p_motivo)
--   * Solo admin activo, no a sí mismo, motivo 5–300.
--   * Exige que la ÚLTIMA solicitud del asociado esté «rechazado» y que no
--     se haya habilitado ya.
--   * Estado que cambia: NINGUNA columna de perfiles ni de la solicitud (la
--     rechazada sigue congelada). Se agrega una fila INMUTABLE en
--     historial_solicitudes (entidad solicitud_credito, entidad_id = la
--     rechazada, accion 'credito_habilitado', detalle = motivo, actor = admin).
--   * Devuelve los bloqueos que AÚN impedirían pedir (inactivo, sin_grado,
--     sin_cupo, no_operando) para que el admin los corrija con sus acciones.
--   * El asociado: mi_habilitacion_credito() devuelve la fecha de la
--     habilitación si su última solicitud es la rechazada habilitada; /cuenta
--     debe mostrar entonces la tarjeta vacía con «Nueva solicitud» (y no la
--     rechazada). El motivo NO se le muestra (nota interna del admin).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Las filas 'credito_habilitado' del historial son inmutables
-- ------------------------------------------------------------
create or replace function public.historial_habilitacion_inmutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' or old.accion = 'credito_habilitado' then
    raise exception 'El registro de habilitación de crédito no se puede modificar ni borrar';
  end if;
  if tg_op = 'UPDATE' and new.accion = 'credito_habilitado' then
    raise exception 'El registro de habilitación de crédito no se puede modificar ni borrar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.historial_habilitacion_inmutable() from public, anon, authenticated;

drop trigger if exists tr_historial_habilitacion_inmutable on public.historial_solicitudes;
create trigger tr_historial_habilitacion_inmutable
  before update or delete on public.historial_solicitudes
  for each row execute function public.historial_habilitacion_inmutable();

-- Una sola habilitación por solicitud rechazada.
create unique index if not exists ux_historial_credito_habilitado
  on public.historial_solicitudes (entidad_id)
  where accion = 'credito_habilitado';

-- ------------------------------------------------------------
-- 2. RPC del admin
-- ------------------------------------------------------------
create or replace function public.admin_habilitar_credito(p_asociado_id uuid, p_motivo text)
returns table (asociado_id uuid, solicitud_id uuid, historial_id uuid, bloqueos text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_perfil record;
  v_sol    record;
  v_hist   uuid;
  v_bloq   text[] := '{}';
begin
  if not coalesce(public.es_admin(), false) then
    raise exception 'Solo un administrador puede habilitar el crédito de un asociado';
  end if;
  if p_asociado_id is null then
    raise exception 'Falta el asociado';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_asociado_id = v_uid then
    raise exception 'No puedes habilitar tu propio crédito; debe hacerlo otro administrador';
  end if;

  select p.id, p.activo, p.grado into v_perfil
  from public.perfiles p where p.id = p_asociado_id;
  if not found then
    raise exception 'El asociado no existe';
  end if;

  select s.id, s.estado into v_sol
  from public.solicitudes_credito s
  where s.asociado_id = p_asociado_id
  order by s.fecha_solicitud desc, s.id desc
  limit 1
  for update;
  if not found or v_sol.estado <> 'rechazado'::public.estado_solicitud then
    raise exception 'El asociado no tiene un crédito rechazado por habilitar';
  end if;
  if exists (select 1 from public.historial_solicitudes h
             where h.entidad_id = v_sol.id and h.accion = 'credito_habilitado') then
    raise exception 'Este rechazo ya fue habilitado';
  end if;

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values ('solicitud_credito'::public.historial_entidad, v_sol.id, v_uid, 'credito_habilitado', v_motivo)
  returning id into v_hist;

  -- Lo que todavía impediría pedir (mismas reglas que los triggers de insert).
  if not v_perfil.activo then v_bloq := array_append(v_bloq, 'inactivo'); end if;
  if v_perfil.grado is null then
    v_bloq := array_append(v_bloq, 'sin_grado');
  elsif not exists (select 1 from public.grados g
                    where g.codigo = v_perfil.grado and g.grupo_credito is not null) then
    v_bloq := array_append(v_bloq, 'sin_cupo');
  end if;
  if not exists (select 1 from public.procesos_ejecutivos pe
                 where pe.asociado_id = p_asociado_id
                   and pe.estado = 'operando'::public.estado_proceso_ejecutivo) then
    v_bloq := array_append(v_bloq, 'no_operando');
  end if;

  return query select p_asociado_id, v_sol.id, v_hist, v_bloq;
end;
$$;
revoke all on function public.admin_habilitar_credito(uuid, text) from public, anon;
grant execute on function public.admin_habilitar_credito(uuid, text) to authenticated;
comment on function public.admin_habilitar_credito(uuid, text) is
  '§13.2: registra (inmutable) que el admin habilita una nueva solicitud tras el rechazo de la última. No cambia columnas; devuelve los bloqueos pendientes.';

-- ------------------------------------------------------------
-- 3. Lectura del asociado
-- ------------------------------------------------------------
create or replace function public.mi_habilitacion_credito()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select h.created_at
  from (select s.id, s.estado from public.solicitudes_credito s
        where s.asociado_id = (select auth.uid())
        order by s.fecha_solicitud desc, s.id desc limit 1) u
  join public.historial_solicitudes h
    on h.entidad_id = u.id and h.accion = 'credito_habilitado'
  where u.estado = 'rechazado'::public.estado_solicitud;
$$;
revoke all on function public.mi_habilitacion_credito() from public, anon;
grant execute on function public.mi_habilitacion_credito() to authenticated;
comment on function public.mi_habilitacion_credito() is
  '§13.2: fecha en que el admin habilitó una nueva solicitud tras el rechazo de la última del que llama; null si no aplica.';

-- ------------------------------------------------------------
-- 4. Métricas: claves nuevas (las existentes no cambian)
-- ------------------------------------------------------------
create or replace function public.admin_metricas_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mes as (
    select date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota' as ini,
           (date_trunc('month', now() at time zone 'America/Bogota'))::date as ini_fecha,
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
                             where b.anio = mes.anio and b.mes = mes.mes),
    -- Nuevas (D-22)
    'por_estado_proceso', coalesce((select jsonb_object_agg(e, n) from (
        select coalesce(pe.estado::text, 'sin_proceso') e, count(*) n
        from public.perfiles p
        left join public.procesos_ejecutivos pe on pe.asociado_id = p.id
        where p.rol = 'asociado'::public.rol_usuario and p.activo
        group by 1) x), '{}'::jsonb),
    'desembolsos_mes', (select jsonb_build_object('conteo', count(*),
                                                  'monto', coalesce(sum(s.monto_solicitado), 0))
                        from public.solicitudes_credito s, mes
                        where s.fecha_desembolso >= mes.ini_fecha
                          and s.fecha_desembolso < (mes.ini_fecha + interval '1 month')::date)
  ) end;
$$;
revoke all on function public.admin_metricas_dashboard() from public, anon;
grant execute on function public.admin_metricas_dashboard() to authenticated;

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
                                     and a.created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'),
    -- Nueva (D-23): clientes del asesor por estado del proceso ejecutivo.
    'por_estado_proceso', coalesce((select jsonb_object_agg(e, n) from (
        select coalesce(pe.estado::text, 'sin_proceso') e, count(*) n
        from public.perfiles p
        left join public.procesos_ejecutivos pe on pe.asociado_id = p.id
        where p.asesor_id = (select auth.uid())
        group by 1) x), '{}'::jsonb)
  ) end;
$$;
revoke all on function public.asesor_metricas_dashboard() from public, anon;
grant execute on function public.asesor_metricas_dashboard() to authenticated;
