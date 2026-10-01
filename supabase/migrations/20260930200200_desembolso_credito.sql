-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.2 (R-07, P-47).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- El conteo de 3 meses del crédito empieza con el desembolso.
--   * solicitudes_credito.fecha_desembolso (date, hora de Colombia) y
--     desembolsado_por (admin que lo marcó).
--   * RPC public.admin_marcar_desembolsado(p_solicitud_id, p_fecha): solo
--     admin activo, solo aprobadas, una sola vez, no la propia.
--   * El asociado LEE fecha_desembolso (permiso por columna, como las demás
--     columnas visibles); no la escribe: solicitudes_update_admin solo deja
--     actualizar al admin y el trigger sellar_revision_solicitud congela la
--     pareja una vez puesta.
--   * sellar_revision_solicitud (congela las resueltas) se amplía: la ÚNICA
--     modificación permitida en una resuelta es poner el desembolso de una
--     aprobada que no lo tenía. desembolsado_por lo pone el servidor.
-- Idempotente.
-- ============================================================

alter table public.solicitudes_credito
  add column if not exists fecha_desembolso date,
  add column if not exists desembolsado_por uuid references public.perfiles (id);

comment on column public.solicitudes_credito.fecha_desembolso is
  'Día del desembolso (hora de Colombia). Desde aquí corren los 3 meses. Solo lo pone admin_marcar_desembolsado.';
comment on column public.solicitudes_credito.desembolsado_por is
  'Admin que marcó el desembolso. Lo fija el trigger con auth.uid().';

create index if not exists ix_solicitudes_desembolsado_por
  on public.solicitudes_credito (desembolsado_por) where desembolsado_por is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_desembolso_coherente_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_desembolso_coherente_chk
      check ((fecha_desembolso is null or estado = 'aprobado'::public.estado_solicitud)
             and (desembolsado_por is null or fecha_desembolso is not null));
  end if;
end $$;

-- Lectura por columna (el asociado ve su fecha; el admin, quién lo hizo).
grant select (fecha_desembolso, desembolsado_por) on public.solicitudes_credito to authenticated;

-- ------------------------------------------------------------
-- Trigger que congela las resueltas: ahora admite el desembolso una vez.
-- ------------------------------------------------------------
create or replace function public.sellar_revision_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if new.asociado_id is distinct from old.asociado_id then
    raise exception 'Una solicitud no puede cambiar de asociado';
  end if;

  if old.estado <> 'pendiente'::public.estado_solicitud then
    if new.estado is distinct from old.estado then
      raise exception 'Una solicitud ya resuelta no puede cambiar de estado';
    end if;
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.grado_asociado,
        new.tasa_interes_mensual, new.plazo_meses, new.cuota_mensual,
        new.motivo_rechazo, new.revisado_por, new.fecha_respuesta, new.fecha_solicitud)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.grado_asociado,
        old.tasa_interes_mensual, old.plazo_meses, old.cuota_mensual,
        old.motivo_rechazo, old.revisado_por, old.fecha_respuesta, old.fecha_solicitud) then
      raise exception 'Una solicitud ya resuelta no se puede modificar';
    end if;

    -- §12.2: desembolso, una sola vez y solo en aprobadas.
    if (new.fecha_desembolso, new.desembolsado_por)
       is distinct from (old.fecha_desembolso, old.desembolsado_por) then
      if old.fecha_desembolso is not null then
        raise exception 'Este crédito ya fue marcado como desembolsado';
      end if;
      if old.estado <> 'aprobado'::public.estado_solicitud then
        raise exception 'Solo un crédito aprobado se puede marcar como desembolsado';
      end if;
      if new.fecha_desembolso is null then
        raise exception 'Falta la fecha de desembolso';
      end if;
      if new.fecha_desembolso > v_hoy then
        raise exception 'La fecha de desembolso no puede ser futura';
      end if;
      if new.fecha_desembolso < (old.fecha_respuesta at time zone 'America/Bogota')::date then
        raise exception 'La fecha de desembolso no puede ser anterior a la aprobación';
      end if;
      if auth.uid() is not null and old.asociado_id = auth.uid() then
        raise exception 'No puede marcar el desembolso de su propio crédito; debe hacerlo otro administrador';
      end if;
      new.desembolsado_por := auth.uid();
    end if;
  else
    -- Pendiente: no se desembolsa (primero se aprueba, en otra operación).
    if new.fecha_desembolso is not null or new.desembolsado_por is not null then
      raise exception 'Solo un crédito aprobado se puede marcar como desembolsado';
    end if;
  end if;

  if old.estado = 'pendiente'::public.estado_solicitud and new.estado is distinct from old.estado then
    if auth.uid() is not null and new.asociado_id = auth.uid() then
      raise exception 'No puede aprobar ni rechazar su propia solicitud; debe hacerlo otro administrador';
    end if;
    new.revisado_por    := auth.uid();
    new.fecha_respuesta := now();
  end if;

  new.fecha_solicitud := old.fecha_solicitud;
  return new;
end;
$$;
revoke all on function public.sellar_revision_solicitud() from public, anon, authenticated;

-- ------------------------------------------------------------
-- RPC del admin
-- ------------------------------------------------------------
create or replace function public.admin_marcar_desembolsado(p_solicitud_id uuid, p_fecha date default null)
returns table (id uuid, fecha_desembolso date, desembolsado_por uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_sol   public.solicitudes_credito%rowtype;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede marcar desembolsos';
  end if;
  if p_solicitud_id is null then
    raise exception 'Falta la solicitud';
  end if;

  select * into v_sol from public.solicitudes_credito s where s.id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe';
  end if;
  if v_sol.estado <> 'aprobado'::public.estado_solicitud then
    raise exception 'Solo un crédito aprobado se puede marcar como desembolsado';
  end if;
  if v_sol.fecha_desembolso is not null then
    raise exception 'Este crédito ya fue marcado como desembolsado';
  end if;

  -- Las demás reglas (fecha futura, anterior a la aprobación, crédito
  -- propio) las aplica sellar_revision_solicitud.
  update public.solicitudes_credito s
     set fecha_desembolso = v_fecha
   where s.id = p_solicitud_id;

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values ('solicitud_credito'::public.historial_entidad, p_solicitud_id, auth.uid(),
          'desembolsado', 'Fecha de desembolso: ' || to_char(v_fecha, 'YYYY-MM-DD'));

  return query
    select s.id, s.fecha_desembolso, s.desembolsado_por
    from public.solicitudes_credito s where s.id = p_solicitud_id;
end;
$$;
revoke all on function public.admin_marcar_desembolsado(uuid, date) from public, anon;
grant execute on function public.admin_marcar_desembolsado(uuid, date) to authenticated;
