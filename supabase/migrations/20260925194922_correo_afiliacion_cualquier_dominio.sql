-- ============================================================
--  El correo de la solicitud de afiliación ya no tiene que ser institucional
--  (@policia.gov.co / @ejercito.mil.co): se acepta cualquier dominio.
--  Se mantiene el chk de formato general (minúsculas y usuario@dominio).
-- ============================================================

alter table public.solicitudes_afiliacion
  drop constraint if exists solicitudes_afiliacion_email_institucion_chk;
