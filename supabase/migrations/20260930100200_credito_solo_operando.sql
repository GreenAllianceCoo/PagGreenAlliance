-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — Respuestas de Sebas (spec §8):
-- «Crédito para inactivos o antes de "Operando": no se permite.»
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100300_proceso_ejecutivo.sql.
--
-- Nuevo trigger BEFORE INSERT en solicitudes_credito: el asociado debe
-- estar activo (perfiles.activo) y su proceso ejecutivo en «operando».
-- Si no: «Podrás pedir tu crédito cuando tu proceso esté operando».
--   * Aplica a todos, también al service role: es una regla de «qué», no de
--     «quién».
--   * Solo al CREAR. Las pendientes que ya existan se resuelven normal.
--   * Nombre chk_credito_proceso_operando: los triggers BEFORE corren en
--     orden alfabético, así que este corre antes que chk_monto_solicitud
--     (primero se avisa del proceso, después de montos y topes).
--
-- OJO al aplicar en producción: los asociados que hoy piden crédito
-- necesitan una fila en procesos_ejecutivos en «operando» (el admin la
-- crea con admin_actualizar_proceso_ejecutivo). Mientras no la tengan, no
-- podrán pedir. Revisar con count(*) antes de aplicar.
-- El servidor (app/cuenta/solicitar) debe hacer la misma validación y
-- mostrar el mismo texto (spec §8).
-- Idempotente.
-- ============================================================

create or replace function public.exigir_proceso_operando_credito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.perfiles p
    join public.procesos_ejecutivos pe on pe.asociado_id = p.id
    where p.id = new.asociado_id
      and p.activo
      and pe.estado = 'operando'::public.estado_proceso_ejecutivo
  ) then
    raise exception 'Podrás pedir tu crédito cuando tu proceso esté operando';
  end if;
  return new;
end;
$$;
revoke all on function public.exigir_proceso_operando_credito() from public, anon, authenticated;

drop trigger if exists chk_credito_proceso_operando on public.solicitudes_credito;
create trigger chk_credito_proceso_operando
  before insert on public.solicitudes_credito
  for each row execute function public.exigir_proceso_operando_credito();
