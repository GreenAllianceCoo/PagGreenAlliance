-- ============================================================
-- ga-auditor-supabase, 2026-09-25 — Brecha de backend del rediseño C+ (pieza 2b).
-- PROPUESTA: NO APLICADA. Sebas la revisa y la aplica.
--
-- La pieza 2b («Sorteo del mes») ofrece un botón «Avisarme el 1 de octubre»
-- cuando la ventana de inscripción (día 1 al 5, ver sorteo_ventana_abierta())
-- todavía no abrió. Hoy no hay dónde guardar esa preferencia: ni una columna
-- en perfiles ni una tabla aparte.
--
-- Se agrega una preferencia simple y NO sensible (no es un dato personal
-- nuevo, es solo «quiere que le avisen»): el propio asociado la prende o
-- apaga desde /cuenta, igual que ya edita su teléfono. No hace falta tocar
-- proteger_campos_perfil: esta columna no está en la lista de «solo admin»
-- y la política perfiles_update ya deja a cada quien editar su propia fila.
--
-- PENDIENTE (fuera de esta migración; es trabajo de app/infraestructura, no
-- de esquema): quién dispara el correo el día 1 de cada mes. Hace falta un
-- job (pg_cron, que hoy no está habilitado en este proyecto, o un cron de
-- Vercel) que lea `select id from perfiles where avisar_apertura_sorteo`
-- y llame a Resend. Decidir ese mecanismo es una pregunta abierta para la
-- cooperativa/Sebas, no algo que esta migración deba inventar.
-- Idempotente: add column if not exists.
-- ============================================================

alter table public.perfiles
  add column if not exists avisar_apertura_sorteo boolean not null default false;

comment on column public.perfiles.avisar_apertura_sorteo is
  'Preferencia del asociado: avisarle por correo cuando abra la ventana del sorteo (día 1 de cada mes). La edita el propio asociado desde /cuenta; falta decidir qué job la lee y envía el correo.';
