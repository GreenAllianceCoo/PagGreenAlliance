-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Fase 2 · PARTE 1. NO APLICADA en producción.
-- Decisión de la cooperativa: nuevo rol 'asesor' (junto a 'asociado' y 'admin').
-- Los asesores ingresan igual que los asociados (cédula + código); los crea
-- el admin desde el panel (lo hace otro agente después).
--
-- IMPORTANTE: `alter type ... add value` no se puede usar en la misma
-- transacción en la que se agrega (Postgres lo bloquea: "unsafe use of new
-- value of enum type"). Por eso este archivo SOLO agrega el valor; ninguna
-- otra migración de esta tanda hace nada más en este mismo archivo. Las
-- migraciones siguientes (en archivos aparte, con timestamp posterior) ya
-- pueden usar 'asesor' sin problema.
-- Idempotente: `if not exists` sobre pg_enum.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'rol_usuario' and e.enumlabel = 'asesor'
  ) then
    alter type public.rol_usuario add value 'asesor';
  end if;
end $$;

comment on type public.rol_usuario is
  'asociado: usuario normal de la cooperativa. admin: panel de administración. asesor: ve un resumen de sus clientes (sin datos de contacto).';
