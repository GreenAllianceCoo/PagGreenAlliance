-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.7 (Q-01).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- 1. public.bonos_acumulados_asesor(p_asesor_id uuid default null): conteo
--    ACUMULADO (nunca se reinicia) de clientes que llegaron a «operando» con
--    ese asesor, según historial_proceso_ejecutivo (RS-17: asesor de la
--    última entrada a operando desde un estado anterior). Se excluyen:
--      - perfiles dados de baja (activo = false),
--      - clientes con retiro anticipado ATENDIDO (alertas_asociado).
--    Un asesor/admin que atiende solo ve lo suyo; el admin puede pasar
--    p_asesor_id para ver el de otro. Metas: 50 (bono) y 100 (viaje).
--    Función aparte: comisiones_periodo_asesor NO cambia de contrato.
-- 2. comisiones_periodo_asesor: mismas columnas; clientes_operativos y
--    total_operando_hoy ahora excluyen a los dados de baja. ingresos_nuevos
--    no cambia (se paga el ingreso del período en que entró).
-- Idempotente.
-- ============================================================

create or replace function public.bonos_acumulados_asesor(p_asesor_id uuid default null)
returns table (asesor_id uuid, clientes_acumulados integer,
               meta_bono_50 integer, alcanzo_bono_50 boolean,
               meta_viaje_100 integer, alcanzo_viaje_100 boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_asesor  uuid;
  v_total   integer;
begin
  if v_uid is null then
    return;
  end if;
  if p_asesor_id is null or p_asesor_id = v_uid then
    if not public.puede_atender(v_uid) then
      return;
    end if;
    v_asesor := v_uid;
  else
    if not public.es_admin() then
      return;   -- un asesor no ve los bonos de otro
    end if;
    v_asesor := p_asesor_id;
  end if;

  select count(*)::int into v_total
  from public.perfiles p
  join lateral (
    select h.asesor_id
    from public.historial_proceso_ejecutivo h
    where h.asociado_id = p.id
      and h.estado_nuevo = 'operando'::public.estado_proceso_ejecutivo
      and (h.estado_anterior is null or h.estado_anterior < 'operando'::public.estado_proceso_ejecutivo)
    order by h.created_at desc, h.id desc
    limit 1
  ) entrada on true
  where entrada.asesor_id = v_asesor
    and p.activo
    and not exists (
      select 1 from public.alertas_asociado a
      where a.asociado_id = p.id
        and a.tipo = 'retiro_anticipado'::public.tipo_alerta_asociado
        and a.estado = 'atendida'::public.estado_alerta_asociado
    );

  return query select v_asesor, v_total, 50, v_total >= 50, 100, v_total >= 100;
end;
$$;
revoke all on function public.bonos_acumulados_asesor(uuid) from public, anon;
grant execute on function public.bonos_acumulados_asesor(uuid) to authenticated;

-- ------------------------------------------------------------
-- comisiones_periodo_asesor: excluye dados de baja en operativos
-- ------------------------------------------------------------
create or replace function public.comisiones_periodo_asesor(p_fecha date default null)
returns table (periodo_inicio date, periodo_fin date, ingresos_nuevos integer, valor_ingresos_nuevos numeric,
               clientes_operativos integer, valor_clientes_operativos numeric, total_operando_hoy integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_valor_ingreso   constant numeric := 500000;
  c_valor_operativo constant numeric := 100000;
  v_uid    uuid := auth.uid();
  v_fecha  date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_inicio date;
  v_fin    date;
  v_fin_ts timestamptz;
  v_ingresos integer;
  v_operativos integer;
  v_hoy integer;
begin
  if v_uid is null or not public.puede_atender(v_uid) then
    return;
  end if;

  select pc.inicio, pc.fin into v_inicio, v_fin from public.periodo_comision(v_fecha) pc;
  v_fin_ts := ((v_fin + 1)::timestamp at time zone 'America/Bogota');

  -- RS-17: asesor de cuando el cliente pasó a operando.
  select count(*)::int into v_ingresos
  from public.procesos_ejecutivos pe
  join lateral (
    select h.asesor_id
    from public.historial_proceso_ejecutivo h
    where h.asociado_id = pe.asociado_id
      and h.estado_nuevo >= 'operando'::public.estado_proceso_ejecutivo
      and (h.estado_anterior is null or h.estado_anterior < 'operando'::public.estado_proceso_ejecutivo)
    order by h.created_at desc, h.id desc
    limit 1
  ) entrada on true
  where entrada.asesor_id = v_uid
    and pe.fecha_inicio_embargo between v_inicio and v_fin;

  -- §12.7: los dados de baja no cuentan como operativos.
  select count(*)::int into v_operativos
  from public.perfiles p
  where p.asesor_id = v_uid
    and p.activo
    and (
      select h.estado_nuevo
      from public.historial_proceso_ejecutivo h
      where h.asociado_id = p.id and h.created_at < v_fin_ts
      order by h.created_at desc, h.id desc
      limit 1
    ) = 'operando'::public.estado_proceso_ejecutivo;

  select count(*)::int into v_hoy
  from public.perfiles p
  join public.procesos_ejecutivos pe on pe.asociado_id = p.id
  where p.asesor_id = v_uid
    and p.activo
    and pe.estado = 'operando'::public.estado_proceso_ejecutivo;

  return query select v_inicio, v_fin,
    v_ingresos, v_ingresos * c_valor_ingreso,
    v_operativos, v_operativos * c_valor_operativo,
    v_hoy;
end;
$$;
revoke all on function public.comisiones_periodo_asesor(date) from public, anon;
grant execute on function public.comisiones_periodo_asesor(date) to authenticated;
