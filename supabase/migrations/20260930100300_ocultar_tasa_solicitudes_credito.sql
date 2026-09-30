-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — Respuestas de Sebas (spec §8): «el
-- asociado nunca puede leer la tasa», también la de SUS solicitudes.
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260930100100_ocultar_tasa_grados_credito.sql.
--
-- Problema: la política solicitudes_select deja al asociado leer SU fila
-- completa, incluida tasa_interes_mensual:
--   GET /rest/v1/solicitudes_credito?select=tasa_interes_mensual   (con su JWT)
-- RLS es por fila, no por columna.
--
-- Corrección:
--  1. Privilegios POR COLUMNA: authenticated lee todas las columnas de
--     solicitudes_credito MENOS tasa_interes_mensual (anon ya no leía nada
--     desde 20260923123853). El admin comparte el rol authenticated, así que
--     tampoco la lee directo.
--  2. admin_tasas_solicitudes(uuid[]): la tasa de esas solicitudes, solo
--     para el admin (si no, 0 filas).
--  Insertar y actualizar no cambia (siguen los privilegios de tabla y RLS).
--  Realtime (postgres_changes) respeta los privilegios por columna
--  (realtime.apply_rls usa has_column_privilege): el asociado deja de
--  recibir la tasa en los eventos.
--
-- OJO para migraciones futuras: una columna NUEVA de solicitudes_credito no
-- queda legible para authenticated hasta que se le dé
-- `grant select (columna) on public.solicitudes_credito to authenticated`.
--
-- CAMBIOS DE CÓDIGO en el mismo despliegue (si no, fallan con 42501
-- «permission denied for table/column»):
--  * app/admin/creditos/page.tsx: quitar tasa_interes_mensual del select y
--    pedirla con .rpc("admin_tasas_solicitudes", { p_ids }).
--  * Cualquier select("*") o `Prefer: return=representation` sin lista de
--    columnas sobre solicitudes_credito con sesión de usuario (p. ej. la e2e
--    tests/e2e/i-despliegue.spec.ts ~410).
-- Idempotente.
-- ============================================================

revoke select on public.solicitudes_credito from anon, authenticated;

do $$
declare
  v_columnas text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_columnas
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'solicitudes_credito'
    and c.column_name <> 'tasa_interes_mensual';

  execute format('grant select (%s) on public.solicitudes_credito to authenticated', v_columnas);
end $$;

comment on column public.solicitudes_credito.tasa_interes_mensual is
  'Tasa vigente cuando pidió el crédito; no cambia si después cambia la tabla. NO la lee authenticated por la API: el admin la obtiene con admin_tasas_solicitudes().';

create or replace function public.admin_tasas_solicitudes(p_ids uuid[])
returns table (id uuid, tasa_interes_mensual numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.tasa_interes_mensual
  from public.solicitudes_credito s
  where (select public.es_admin())
    and s.id = any (p_ids);
$$;
revoke all on function public.admin_tasas_solicitudes(uuid[]) from public, anon;
grant execute on function public.admin_tasas_solicitudes(uuid[]) to authenticated;
comment on function public.admin_tasas_solicitudes(uuid[]) is
  'Solo admin: tasa de interés con que se pidió cada solicitud de la lista. Cualquier otro recibe 0 filas.';
