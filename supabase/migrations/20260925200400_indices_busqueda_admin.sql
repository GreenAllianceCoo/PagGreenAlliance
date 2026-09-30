-- ============================================================
-- ga-auditor-supabase, 2026-09-25 — Brecha de backend del rediseño C+ (pieza 2d).
-- PROPUESTA OPCIONAL / baja prioridad: NO APLICADA.
--
-- «Buscar por nombre o cédula» en el admin (2d) ya funciona hoy con
-- ilike '%texto%' sobre perfiles.nombre_completo / perfiles.cedula y
-- solicitudes_afiliacion.nombre / solicitudes_afiliacion.cedula: RLS ya
-- deja al admin leer esas columnas (no hace falta ninguna migración para
-- que la búsqueda exista). Con ~200 asociados un ilike sin índice no es un
-- problema de rendimiento real hoy.
--
-- Esta migración es solo una mejora de rendimiento a futuro (más
-- asociados, o el admin escribiendo letra por letra): índices GIN de
-- trigramas para que ilike '%texto%' use índice en vez de recorrer toda la
-- tabla. No cambia qué puede leer quién (sin riesgo de privacidad nuevo).
-- Idempotente.
-- ============================================================

create extension if not exists pg_trgm;

create index if not exists ix_perfiles_nombre_trgm
  on public.perfiles using gin (nombre_completo gin_trgm_ops);
create index if not exists ix_perfiles_cedula_trgm
  on public.perfiles using gin (cedula gin_trgm_ops);

create index if not exists ix_afiliacion_nombre_trgm
  on public.solicitudes_afiliacion using gin (nombre gin_trgm_ops);
create index if not exists ix_afiliacion_cedula_trgm
  on public.solicitudes_afiliacion using gin (cedula gin_trgm_ops);
