-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Auditoría fase 2, hallazgo F2-01 (ALTA).
-- PROPUESTA: NO APLICADA. Sebas la revisa y la aplica junto con las 6 de la
-- fase 2 (va después de 20260924000500_sorteo_mensual.sql).
--
-- Problema: 20260924000500 da `grant select on boletas_sorteo to authenticated`
-- y la política deja ver la propia fila. Postgres RLS es por FILA, no por
-- columna: un asociado con sesión puede pedir su número ANTES de confirmarlo
--   GET /rest/v1/boletas_sorteo?select=numero   (con su JWT de las cookies)
-- y luego "confirmarlo" sin haber abierto el correo. La app lo esconde en la
-- pantalla (lib/sorteo/vista.ts), pero la API REST no pasa por la pantalla.
--
-- Corrección:
--  1. Privilegios por columna: authenticated puede leer todo MENOS `numero`.
--  2. mi_boleta_sorteo(anio, mes): la boleta propia; `numero` solo si ya está
--     confirmada.
--  3. boletas_confirmadas_sorteo(anio, mes): lista del admin (con número),
--     vacía para quien no sea admin.
--  4. Ajustes menores del sorteo: search_path fijo en sorteo_ventana_abierta
--     (aviso del linter) y participar_sorteo tolera la carrera de dos clics
--     simultáneos o de dos números iguales generados a la vez.
--
-- CAMBIOS DE CÓDIGO NECESARIOS EN EL MISMO DESPLIEGUE (si no, esas consultas
-- fallan con "permission denied for column numero"):
--  * app/cuenta/page.tsx: en vez de .from("boletas_sorteo").select("estado, numero")
--    usar .rpc("mi_boleta_sorteo", { p_anio: anio, p_mes: mes }).maybeSingle().
--  * app/cuenta/actions-sorteo.ts (líneas ~140-148): tras confirmar, devolver el
--    número que el asociado escribió (resultado.data), que ya coincidió; o
--    usar la misma RPC. Leer `intentos` sigue permitido.
--  * app/admin/sorteo/page.tsx: .rpc("boletas_confirmadas_sorteo", { p_anio, p_mes }).
--  * supabase/tests/10_sorteo_mensual.sql: ajustar/añadir casos (ver reporte).
-- Idempotente: revoke/grant y create or replace.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Privilegios por columna (sin `numero`)
-- ------------------------------------------------------------
revoke select on public.boletas_sorteo from authenticated;
grant select (id, asociado_id, anio, mes, estado, fecha_envio, fecha_confirmacion, intentos, created_at)
  on public.boletas_sorteo to authenticated;
-- La política boletas_sorteo_select (fila propia o admin) se mantiene igual.

-- ------------------------------------------------------------
-- 2. La boleta propia; el número solo después de confirmarla
-- ------------------------------------------------------------
create or replace function public.mi_boleta_sorteo(p_anio smallint, p_mes smallint)
returns table (estado public.estado_boleta_sorteo, numero text, intentos integer, fecha_envio timestamptz, fecha_confirmacion timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.estado,
         case when b.estado = 'confirmada'::public.estado_boleta_sorteo then b.numero end,
         b.intentos,
         b.fecha_envio,
         b.fecha_confirmacion
  from public.boletas_sorteo b
  where b.asociado_id = (select auth.uid())
    and b.anio = p_anio
    and b.mes = p_mes;
$$;
revoke all on function public.mi_boleta_sorteo(smallint, smallint) from public, anon;
grant execute on function public.mi_boleta_sorteo(smallint, smallint) to authenticated;
comment on function public.mi_boleta_sorteo(smallint, smallint) is
  'Boleta del sorteo del usuario en sesión para ese año/mes. `numero` solo sale si ya está confirmada (antes, null).';

-- ------------------------------------------------------------
-- 3. Lista del admin: confirmadas de un mes, con número
-- ------------------------------------------------------------
create or replace function public.boletas_confirmadas_sorteo(p_anio smallint, p_mes smallint)
returns table (numero text, fecha_confirmacion timestamptz, nombre_completo text, cedula text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.numero, b.fecha_confirmacion, p.nombre_completo, p.cedula
  from public.boletas_sorteo b
  join public.perfiles p on p.id = b.asociado_id
  where (select public.es_admin())
    and b.anio = p_anio
    and b.mes = p_mes
    and b.estado = 'confirmada'::public.estado_boleta_sorteo
  order by b.fecha_confirmacion;
$$;
revoke all on function public.boletas_confirmadas_sorteo(smallint, smallint) from public, anon;
grant execute on function public.boletas_confirmadas_sorteo(smallint, smallint) to authenticated;
comment on function public.boletas_confirmadas_sorteo(smallint, smallint) is
  'Solo admin: boletas confirmadas del mes con número, nombre y cédula. Quien no sea admin recibe 0 filas.';

-- ------------------------------------------------------------
-- 4a. search_path fijo (aviso function_search_path_mutable del linter)
-- ------------------------------------------------------------
alter function public.sorteo_ventana_abierta() set search_path = '';

-- ------------------------------------------------------------
-- 4b. participar_sorteo: carreras
--   * Dos clics a la vez del mismo asociado: el segundo insert choca con
--     ux_boletas_sorteo_asociado_mes → hoy sale un 23505 crudo (la app lo
--     muestra como error genérico). Ahora sale el mensaje de "ya tienes".
--   * Dos asociados a los que se les genera el mismo número a la vez: choca
--     con ux_boletas_sorteo_numero_mes → se genera otro y se reintenta.
-- Misma firma, mismo resultado y mismos privilegios que en 20260924000500.
-- ------------------------------------------------------------
create or replace function public.participar_sorteo(p_asociado_id uuid)
returns table (id uuid, numero text, anio smallint, mes smallint, fecha_envio timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio   smallint := extract(year  from (now() at time zone 'America/Bogota'))::smallint;
  v_mes    smallint := extract(month from (now() at time zone 'America/Bogota'))::smallint;
  v_dia    smallint := extract(day   from (now() at time zone 'America/Bogota'))::smallint;
  v_numero text;
  v_id     uuid;
begin
  if p_asociado_id is null then
    raise exception 'Falta el asociado';
  end if;
  if v_dia < 1 or v_dia > 5 then
    raise exception 'La inscripción al sorteo solo está abierta del 1 al 5 de cada mes';
  end if;

  for i in 1..5 loop
    if exists (
      select 1 from public.boletas_sorteo b
      where b.asociado_id = p_asociado_id and b.anio = v_anio and b.mes = v_mes
    ) then
      raise exception 'Ya tienes una boleta para el sorteo de este mes';
    end if;

    v_numero := public.generar_numero_boleta_sorteo(v_anio, v_mes);
    begin
      insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
      values (p_asociado_id, v_anio, v_mes, v_numero)
      returning boletas_sorteo.id into v_id;
      exit; -- insertada
    exception when unique_violation then
      -- Otra transacción ganó: o ya hay boleta de este asociado (la
      -- siguiente vuelta lo detecta y avisa) o el número se repitió (se
      -- genera otro).
      v_id := null;
    end;
  end loop;

  if v_id is null then
    raise exception 'No se pudo generar un número de boleta único para %/%', v_mes, v_anio;
  end if;

  return query
    select v_id, v_numero, v_anio, v_mes, b.fecha_envio
    from public.boletas_sorteo b where b.id = v_id;
end;
$$;
revoke all on function public.participar_sorteo(uuid) from public, anon, authenticated;
grant execute on function public.participar_sorteo(uuid) to service_role;
