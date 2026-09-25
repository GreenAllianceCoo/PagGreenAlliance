-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgo H-11 (bajo): la spec (sección 3) pide mostrar emoji +
-- especialidad de cada convenio; la tabla no tiene esas columnas y está
-- vacía (0 filas).
-- No se agrega acceso anon: si la landing pública debe mostrar convenios,
-- ver pregunta P-07 (opción recomendada: leerlos en el servidor y exponer
-- solo nombre/emoji/especialidad, sin NIT ni teléfono).
-- Idempotente.
-- ============================================================

alter table public.convenios add column if not exists emoji text;
alter table public.convenios add column if not exists especialidad text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'convenios_textos_largo_chk') then
    alter table public.convenios
      add constraint convenios_textos_largo_chk
      check (
        char_length(btrim(nombre_empresa)) between 1 and 120
        and (emoji is null or char_length(emoji) <= 16)
        and (especialidad is null or char_length(especialidad) <= 80)
      );
  end if;
end $$;
