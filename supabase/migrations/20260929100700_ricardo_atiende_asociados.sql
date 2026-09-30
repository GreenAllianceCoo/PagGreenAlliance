-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §2.9, §6).
-- PROPUESTA DE DATOS: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100000_perfiles_atiende_asociados.sql.
--
-- Ricardo Varón (cédula 1124998852) sigue siendo ADMIN y además atiende
-- asociados: aparece en el desplegable «Asesor» de /afiliacion y puede
-- tener clientes (asesor_id).
--
-- Solo toca su fila, y solo si sigue siendo admin. No cambia su rol.
-- En una base local (sin esa cédula) no hace nada.
-- Los asesores nuevos (Miguel Rueda, Rafael González, Nany Barón) NO se
-- crean aquí: los crea Sebas desde /admin/asesores (spec §6).
-- Idempotente.
-- ============================================================

do $$
declare
  v_filas integer;
begin
  update public.perfiles
     set atiende_asociados = true
   where cedula = '1124998852'
     and rol = 'admin'::public.rol_usuario
     and not atiende_asociados;
  get diagnostics v_filas = row_count;
  raise notice 'Ricardo Varón (1124998852): % fila(s) actualizada(s) a atiende_asociados = true', v_filas;
end $$;
