-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — Respuestas de Sebas (spec §8): «el
-- asociado no puede leer tasa_interes_mensual ni por la API».
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Problema: grados_credito tiene `select to authenticated using (true)`, así
-- que cualquier asociado con sesión (y la política no cubre anon, pero anon
-- tenía el privilegio) podía pedir
--   GET /rest/v1/grados_credito?select=tasa_interes_mensual
-- También cuota_mensual y total_credito revelan la tasa
-- (tasa = cuota_mensual / capacidad_maxima), así que se ocultan igual.
--
-- Corrección: privilegios POR COLUMNA. anon y authenticated solo pueden leer
-- grado, porcentaje, capacidad_maxima y plazo_meses (RLS sigue igual: anon
-- no tiene política, así que no ve filas). Siguen pudiendo escribir según
-- sus políticas (solo el admin).
--
-- La tasa se lee con tabla_credito_con_tasa(): solo si quien llama
-- puede_atender() (asesor, o admin con atiende_asociados) o es admin; si
-- no, 0 filas. La usa la demo del asesor y del admin.
--
-- CAMBIO DE CÓDIGO en el mismo despliegue:
--   lib/asesor/cargarPaquetesDemo.ts: en vez de
--     .from("grados_credito").select("grado, porcentaje, capacidad_maxima, tasa_interes_mensual, plazo_meses")
--   usar
--     .rpc("tabla_credito_con_tasa")   (mismas 5 columnas, ya ordenadas)
--   Las otras lecturas (app/cuenta/page.tsx, app/cuenta/solicitar/*,
--   lib/grados.ts) solo piden porcentaje, capacidad_maxima, plazo_meses y
--   grado: siguen funcionando.
-- Idempotente (revoke/grant y create or replace).
-- ============================================================

revoke select on public.grados_credito from anon, authenticated;
grant select (grado, porcentaje, capacidad_maxima, plazo_meses)
  on public.grados_credito to anon, authenticated;

comment on column public.grados_credito.tasa_interes_mensual is
  'Tasa de interés mensual (fracción: 0.079 = 7,9 %). NO la leen anon ni authenticated por la API; asesores y admins la leen con tabla_credito_con_tasa().';

create or replace function public.tabla_credito_con_tasa()
returns table (
  grado                 public.grado_policial,
  porcentaje            public.porcentaje_devolucion,
  capacidad_maxima      numeric,
  tasa_interes_mensual  numeric,
  plazo_meses           integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select gc.grado, gc.porcentaje, gc.capacidad_maxima, gc.tasa_interes_mensual, gc.plazo_meses
  from public.grados_credito gc
  where (select public.es_admin())
     or (select public.puede_atender((select auth.uid())))
  order by gc.grado, gc.porcentaje;
$$;
revoke all on function public.tabla_credito_con_tasa() from public, anon;
grant execute on function public.tabla_credito_con_tasa() to authenticated;
comment on function public.tabla_credito_con_tasa() is
  'Topes con tasa de interés, para la demo del asesor/admin. Solo admin o quien puede_atender(); cualquier otro recibe 0 filas.';
