-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgos H-02 (alto), H-03, H-04, H-09 (medio/bajo).
--
-- Verificado en producción el 2026-09-23 con count(*): 0 perfiles con
-- cédula no numérica, 0 grados con valores <= 0, 0 solicitudes. Los CHECK
-- se crean NOT VALID y luego se validan, para no bloquear la tabla.
-- Idempotente: cada constraint/índice se crea solo si no existe.
-- ============================================================

-- ------------------------------------------------------------
-- perfiles: cédula solo dígitos (6-10) o el marcador PENDIENTE-xxxxxxxx
-- que pone handle_new_user cuando no llega cédula.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_cedula_formato_chk') then
    alter table public.perfiles
      add constraint perfiles_cedula_formato_chk
      check (cedula ~ '^[0-9]{6,10}$' or cedula ~ '^PENDIENTE-[0-9a-f]{8}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfiles_nombre_largo_chk') then
    alter table public.perfiles
      add constraint perfiles_nombre_largo_chk
      check (char_length(btrim(nombre_completo)) between 1 and 120) not valid;
  end if;
end $$;
alter table public.perfiles validate constraint perfiles_cedula_formato_chk;
alter table public.perfiles validate constraint perfiles_nombre_largo_chk;

-- ------------------------------------------------------------
-- grados_credito: valores positivos
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grados_credito_valores_positivos_chk') then
    alter table public.grados_credito
      add constraint grados_credito_valores_positivos_chk
      check (capacidad_maxima > 0 and cuota_mensual > 0 and total_credito > 0 and plazo_meses > 0) not valid;
  end if;
end $$;
alter table public.grados_credito validate constraint grados_credito_valores_positivos_chk;

-- ------------------------------------------------------------
-- solicitudes_credito: valores y coherencia de estado
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_valores_positivos_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_valores_positivos_chk
      check (monto_solicitado > 0 and cuota_mensual >= 0 and plazo_meses > 0) not valid;
  end if;
  -- Una solicitud pendiente no tiene datos de revisión; una resuelta tiene fecha de respuesta.
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_estado_coherente_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_estado_coherente_chk
      check (
        (estado = 'pendiente'::public.estado_solicitud
           and revisado_por is null and fecha_respuesta is null and motivo_rechazo is null)
        or
        (estado <> 'pendiente'::public.estado_solicitud and fecha_respuesta is not null)
      ) not valid;
  end if;
  -- OPCIONAL (ver pregunta P-06): exigir motivo al rechazar.
  -- alter table public.solicitudes_credito add constraint solicitudes_motivo_rechazo_chk
  --   check (estado <> 'rechazado'::public.estado_solicitud or nullif(btrim(motivo_rechazo), '') is not null) not valid;
end $$;
alter table public.solicitudes_credito validate constraint solicitudes_valores_positivos_chk;
alter table public.solicitudes_credito validate constraint solicitudes_estado_coherente_chk;

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
-- FK sin índice (advisor unindexed_foreign_keys).
create index if not exists ix_solicitudes_revisado_por
  on public.solicitudes_credito (revisado_por);
-- La app consulta "última solicitud del asociado" (asociado_id + order by fecha_solicitud desc).
-- El índice único parcial solo cubre las pendientes; este cubre el historial y la FK.
create index if not exists ix_solicitudes_asociado_fecha
  on public.solicitudes_credito (asociado_id, fecha_solicitud desc);

-- ------------------------------------------------------------
-- Una solicitud resuelta (aprobada/rechazada) queda congelada.
-- Hoy el trigger solo impide cambiar el `estado`; un admin (o un error en
-- el panel) podría cambiar monto, porcentaje, asociado o motivo después de
-- aprobada. También impide mover una solicitud a otro asociado.
-- ------------------------------------------------------------
create or replace function public.sellar_revision_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asociado_id is distinct from old.asociado_id then
    raise exception 'Una solicitud no puede cambiar de asociado';
  end if;

  if old.estado <> 'pendiente'::public.estado_solicitud then
    if new.estado is distinct from old.estado then
      raise exception 'Una solicitud ya resuelta no puede cambiar de estado';
    end if;
    if new.monto_solicitado      is distinct from old.monto_solicitado
    or new.porcentaje_devolucion is distinct from old.porcentaje_devolucion
    or new.cuota_mensual         is distinct from old.cuota_mensual
    or new.plazo_meses           is distinct from old.plazo_meses
    or new.motivo_rechazo        is distinct from old.motivo_rechazo
    or new.revisado_por          is distinct from old.revisado_por
    or new.fecha_respuesta       is distinct from old.fecha_respuesta
    or new.fecha_solicitud       is distinct from old.fecha_solicitud then
      raise exception 'Una solicitud ya resuelta no se puede modificar';
    end if;
  end if;

  if old.estado = 'pendiente'::public.estado_solicitud and new.estado is distinct from old.estado then
    -- Sello de revisión en servidor (no se confía en lo que mande el cliente).
    new.revisado_por    := auth.uid();
    new.fecha_respuesta := now();
  end if;

  -- La fecha de solicitud no se reescribe nunca.
  new.fecha_solicitud := old.fecha_solicitud;
  return new;
end;
$$;
revoke all on function public.sellar_revision_solicitud() from public, anon, authenticated;
