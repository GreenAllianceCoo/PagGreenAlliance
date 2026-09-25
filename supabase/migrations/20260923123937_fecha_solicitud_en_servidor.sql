-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgo H-15 (bajo): la política solicitudes_insert_propio no limita
-- fecha_solicitud, así que un asociado puede insertar una solicitud con
-- fecha pasada o futura (afecta el orden de revisión y los reportes).
--   insert into solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado,
--     cuota_mensual, fecha_solicitud) values (auth.uid(), '50', 500000, 0, '2020-01-01');
-- Corrección: la fecha la pone siempre el servidor al insertar.
-- (En update ya la fija sellar_revision_solicitud de la migración 20260923100200.)
-- Idempotente.
-- ============================================================

create or replace function public.fijar_fecha_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.fecha_solicitud := now();
  return new;
end;
$$;
revoke all on function public.fijar_fecha_solicitud() from public, anon, authenticated;

drop trigger if exists tr_fijar_fecha_solicitud on public.solicitudes_credito;
create trigger tr_fijar_fecha_solicitud
  before insert on public.solicitudes_credito
  for each row execute function public.fijar_fecha_solicitud();
