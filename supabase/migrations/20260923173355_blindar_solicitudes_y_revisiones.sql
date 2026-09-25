-- ============================================================
-- Reglas del crédito confirmadas con la cooperativa (2026-09-23) y
-- hallazgos de la 2.ª auditoría (docs/auditorias/2026-09-23-auditoria-supabase.md).
--
-- Respuestas de la cooperativa que aplica:
--   P-01  Monto mínimo de un crédito: 100.000.
--   P-02  Cada grado y porcentaje tiene su tasa de interés mensual
--         (tasa_interes_mensual), sacada de la tabla de la presentación:
--         tasa = cuota_mensual / capacidad_maxima. La app la muestra; la
--         cuota NO se calcula.
--   P-03  Primero en llegar, primero en salir: la solicitud guarda el grado
--         y la tasa con que se pidió, y no se pueden cambiar. No se puede
--         bajar ni borrar un tope mientras haya solicitudes pendientes de
--         ese grado y porcentaje.
--   P-05  Las solicitudes se conservan: nadie las borra desde la API.
--   P-06  El motivo es obligatorio al rechazar.
--   P-09  Nadie resuelve su propia solicitud.
--   P-10  El asociado no cambia su nombre; sí su teléfono.
--
-- Hallazgos que corrige: H-14, H-16, H-21, H-22, H-23, H-24, H-25.
--
-- El service role (auth.uid() null: SQL Editor, scripts) queda exento de
-- las reglas de "quién" para poder corregir datos, no de las de "qué".
-- Idempotente: add column if not exists, create or replace, drop ... if exists.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tasa de interés mensual por grado y porcentaje (P-02)
-- ------------------------------------------------------------
alter table public.grados_credito
  add column if not exists tasa_interes_mensual numeric(10, 8);

update public.grados_credito
   set tasa_interes_mensual = round(cuota_mensual / capacidad_maxima, 8)
 where tasa_interes_mensual is null;

alter table public.grados_credito
  alter column tasa_interes_mensual set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grados_credito_tasa_chk') then
    alter table public.grados_credito
      add constraint grados_credito_tasa_chk
      check (tasa_interes_mensual > 0 and tasa_interes_mensual < 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'grados_credito_tope_minimo_chk') then
    alter table public.grados_credito
      add constraint grados_credito_tope_minimo_chk
      check (capacidad_maxima >= 100000);
  end if;
end $$;

comment on column public.grados_credito.tasa_interes_mensual is
  'Tasa de interés mensual (fracción: 0.079 = 7,9 %).';
comment on column public.grados_credito.cuota_mensual is
  'Referencia de la presentación: interés mensual al tope.';
comment on column public.grados_credito.total_credito is
  'Referencia de la presentación: total a pagar al tope.';

-- ------------------------------------------------------------
-- 2. La solicitud guarda el grado y la tasa con que se pidió (P-03).
--    La cuota no se calcula: cuota_mensual queda en null (H-14).
-- ------------------------------------------------------------
drop function if exists public.calcular_cuota_credito(numeric, numeric, numeric);

alter table public.solicitudes_credito
  add column if not exists grado public.grado_policial,
  add column if not exists tasa_interes_mensual numeric(10, 8);

alter table public.solicitudes_credito
  alter column cuota_mensual drop not null;

comment on column public.solicitudes_credito.cuota_mensual is
  'Sin uso: la cuota no se calcula (null).';
comment on column public.solicitudes_credito.grado is
  'Grado del asociado cuando pidió el crédito.';
comment on column public.solicitudes_credito.tasa_interes_mensual is
  'Tasa vigente cuando pidió el crédito; no cambia si después cambia la tabla.';

-- Solicitudes que ya existan: se completan con la tabla vigente. Los triggers
-- se apagan mientras tanto porque congelan las resueltas.
alter table public.solicitudes_credito disable trigger user;

update public.solicitudes_credito s
   set grado                = p.grado,
       tasa_interes_mensual = gc.tasa_interes_mensual
  from public.perfiles p
  join public.grados_credito gc on gc.grado = p.grado
 where p.id = s.asociado_id
   and gc.porcentaje = s.porcentaje_devolucion
   and s.tasa_interes_mensual is null;

alter table public.solicitudes_credito enable trigger user;

alter table public.solicitudes_credito
  alter column grado set not null,
  alter column tasa_interes_mensual set not null;

-- ------------------------------------------------------------
-- 3. Validación al crear; condiciones fijas después (H-21, P-01)
-- ------------------------------------------------------------
create or replace function public.validar_monto_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grado public.grado_policial;
  v_tope  public.grados_credito%rowtype;
begin
  if tg_op = 'UPDATE' then
    -- Resueltas: las congela sellar_revision_solicitud.
    if old.estado <> 'pendiente'::public.estado_solicitud then
      return new;
    end if;
    -- Pendiente: solo se resuelve. Para cambiar condiciones, se rechaza y se pide otra.
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.tasa_interes_mensual,
        new.plazo_meses, new.cuota_mensual)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.tasa_interes_mensual,
        old.plazo_meses, old.cuota_mensual) then
      raise exception 'Las condiciones de una solicitud no se pueden modificar; recházela y cree una nueva';
    end if;
    return new;
  end if;

  -- El grado sale siempre del perfil, nunca de lo que mande el cliente.
  select p.grado into v_grado from public.perfiles p where p.id = new.asociado_id;
  if v_grado is null then
    raise exception 'El asociado no tiene un grado asignado; no se puede calcular el tope de crédito';
  end if;

  select * into v_tope
  from public.grados_credito gc
  where gc.grado = v_grado and gc.porcentaje = new.porcentaje_devolucion;
  if not found then
    raise exception 'No hay un tope configurado para el grado % con devolución del %',
      v_grado, new.porcentaje_devolucion::text || '%';
  end if;

  if new.monto_solicitado is null or new.monto_solicitado <= 0 then
    raise exception 'El monto solicitado debe ser mayor que cero';
  end if;

  if new.monto_solicitado = 'Infinity'::numeric or new.monto_solicitado <> trunc(new.monto_solicitado) then
    raise exception 'El monto solicitado debe ser un valor en pesos, sin decimales';
  end if;

  if new.monto_solicitado < 100000 then
    raise exception 'El monto mínimo de un crédito es 100000';
  end if;

  if new.monto_solicitado > v_tope.capacidad_maxima then
    raise exception 'El monto solicitado (%) supera el tope de % para el grado % con devolución del %',
      new.monto_solicitado, v_tope.capacidad_maxima, v_grado, new.porcentaje_devolucion::text || '%';
  end if;

  -- Condiciones: SIEMPRE las pone el servidor (se ignora lo que mande el cliente).
  new.grado                := v_grado;
  new.tasa_interes_mensual := v_tope.tasa_interes_mensual;
  new.plazo_meses          := v_tope.plazo_meses;
  new.cuota_mensual        := null;
  return new;
end;
$$;
revoke all on function public.validar_monto_solicitud() from public, anon, authenticated;

-- Sin lista de columnas: todo update pasa por aquí (H-21).
drop trigger if exists chk_monto_solicitud on public.solicitudes_credito;
create trigger chk_monto_solicitud
  before insert or update on public.solicitudes_credito
  for each row execute function public.validar_monto_solicitud();

-- ------------------------------------------------------------
-- 4. Toda solicitud creada desde la API nace pendiente (H-22)
-- ------------------------------------------------------------
create or replace function public.fijar_fecha_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.fecha_solicitud := now();
  if auth.uid() is not null then
    new.estado          := 'pendiente'::public.estado_solicitud;
    new.revisado_por    := null;
    new.fecha_respuesta := null;
    new.motivo_rechazo  := null;
  end if;
  return new;
end;
$$;
revoke all on function public.fijar_fecha_solicitud() from public, anon, authenticated;
-- El trigger tr_fijar_fecha_solicitud (before insert) ya apunta a esta función.

-- ------------------------------------------------------------
-- 5. Resueltas congeladas y sin auto-aprobación (H-23, P-09)
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
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.tasa_interes_mensual,
        new.plazo_meses, new.cuota_mensual,
        new.motivo_rechazo, new.revisado_por, new.fecha_respuesta, new.fecha_solicitud)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.tasa_interes_mensual,
        old.plazo_meses, old.cuota_mensual,
        old.motivo_rechazo, old.revisado_por, old.fecha_respuesta, old.fecha_solicitud) then
      raise exception 'Una solicitud ya resuelta no se puede modificar';
    end if;
  end if;

  if old.estado = 'pendiente'::public.estado_solicitud and new.estado is distinct from old.estado then
    if auth.uid() is not null and new.asociado_id = auth.uid() then
      raise exception 'No puede aprobar ni rechazar su propia solicitud; debe hacerlo otro administrador';
    end if;
    -- Sello de revisión en servidor.
    new.revisado_por    := auth.uid();
    new.fecha_respuesta := now();
  end if;

  new.fecha_solicitud := old.fecha_solicitud;
  return new;
end;
$$;
revoke all on function public.sellar_revision_solicitud() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6. Motivo obligatorio al rechazar (P-06)
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_motivo_rechazo_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_motivo_rechazo_chk
      check (estado <> 'rechazado'::public.estado_solicitud or nullif(btrim(motivo_rechazo), '') is not null)
      not valid;
  end if;
end $$;
alter table public.solicitudes_credito validate constraint solicitudes_motivo_rechazo_chk;

-- ------------------------------------------------------------
-- 7. Las solicitudes se conservan (P-05)
-- ------------------------------------------------------------
drop policy if exists "solicitudes_delete_admin" on public.solicitudes_credito;

-- ------------------------------------------------------------
-- 8. No se baja ni se borra un tope con solicitudes pendientes (P-03, H-16)
-- ------------------------------------------------------------
create or replace function public.proteger_topes_con_pendientes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
  or new.grado is distinct from old.grado
  or new.porcentaje is distinct from old.porcentaje
  or new.capacidad_maxima < old.capacidad_maxima then
    if exists (
      select 1 from public.solicitudes_credito s
      where s.estado = 'pendiente'::public.estado_solicitud
        and s.grado = old.grado
        and s.porcentaje_devolucion = old.porcentaje
    ) then
      raise exception 'No se puede bajar ni eliminar el tope de % con devolución del % mientras haya solicitudes pendientes; resuélvalas primero',
        old.grado, old.porcentaje::text || '%';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_topes_con_pendientes() from public, anon, authenticated;

drop trigger if exists tr_proteger_topes on public.grados_credito;
create trigger tr_proteger_topes
  before update or delete on public.grados_credito
  for each row execute function public.proteger_topes_con_pendientes();

-- ------------------------------------------------------------
-- 9. solicitudes_afiliacion: el sello de revisión solo lo pone el servidor (H-24)
-- ------------------------------------------------------------
create or replace function public.proteger_solicitud_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.nombre is distinct from old.nombre
    or new.cedula is distinct from old.cedula
    or new.grado is distinct from old.grado
    or new.unidad is distinct from old.unidad
    or new.celular is distinct from old.celular
    or new.email is distinct from old.email
    or new.mensaje is distinct from old.mensaje
    or new.acepto_datos_at is distinct from old.acepto_datos_at
    or new.created_at is distinct from old.created_at then
      raise exception 'Solo se puede cambiar el estado de la solicitud de afiliación';
    end if;
    if new.estado is not distinct from old.estado then
      new.revisado_por   := old.revisado_por;
      new.fecha_revision := old.fecha_revision;
    end if;
  end if;
  if new.estado is distinct from old.estado then
    new.revisado_por   := auth.uid();
    new.fecha_revision := now();
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_solicitud_afiliacion() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 10. perfiles: id y created_at inmutables desde la API (H-25); el asociado no cambia su nombre (P-10)
-- ------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id then raise exception 'No se puede cambiar el id de un perfil'; end if;
    if new.created_at is distinct from old.created_at then raise exception 'No se puede cambiar la fecha de creación del perfil'; end if;

    if not public.es_admin() then
      if new.rol is distinct from old.rol then raise exception 'No puede modificar su propio rol'; end if;
      if new.grado is distinct from old.grado then raise exception 'No puede modificar su propio grado; solicítelo a la administración'; end if;
      if new.cedula is distinct from old.cedula then raise exception 'No puede modificar su número de cédula'; end if;
      -- P-10: el asociado solo puede cambiar su teléfono.
      if new.nombre_completo is distinct from old.nombre_completo then raise exception 'No puede modificar su nombre; solicítelo a la administración'; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;
