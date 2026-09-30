-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.1 (parte 1 de 2).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Agrega los grupos de crédito nuevos IJ, CT, MY y TC al enum
-- public.grado_policial (que desde 20260929100100 es el tipo del GRUPO de
-- crédito). Va SOLO en esta migración: un valor nuevo de enum no se puede
-- usar en la misma transacción en que se agrega. Los usa la 20260930200100.
-- Orden resultante: PP, PT, SI, IT, IJ, CT, MY, TC, OF (OF queda al final:
-- es el grupo heredado). Idempotente.
-- ============================================================
alter type public.grado_policial add value if not exists 'IJ' before 'OF';
alter type public.grado_policial add value if not exists 'CT' before 'OF';
alter type public.grado_policial add value if not exists 'MY' before 'OF';
alter type public.grado_policial add value if not exists 'TC' before 'OF';
