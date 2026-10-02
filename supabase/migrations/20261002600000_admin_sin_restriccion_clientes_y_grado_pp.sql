-- ============================================================
-- Pedidos de Sebas (2026-10-01)
--
-- 1) Las reglas «otro administrador debe …» sobre los PROPIOS clientes (RS-01,
--    RS-17) eran para que nadie se inflara comisiones o premios. Los
--    administradores son los dueños del negocio, así que se quitan para ellos:
--    un admin puede mover el proceso ejecutivo de sus clientes, asignarse
--    clientes y registrar sus comisiones. Los asesores nunca pudieron hacer
--    nada de eso (RLS y es_admin() siguen igual).
--    Se mantienen: nadie cambia su PROPIO proceso, estado o crédito, y el
--    cambio de correo de ingreso (recuperación de acceso) sigue exigiendo que
--    lo haga otro admin, porque es un control contra la toma de cuentas.
--
-- 2) Policía: «Patrullero de Policía» (PP) y «Patrullero» (PT) eran el mismo
--    grado. Queda solo «Patrullero» con el cupo de PT (1,3 M / 2,7 M). PP deja
--    de ofrecerse (no se borra: nadie lo usa hoy, pero así no se rompen
--    referencias del historial).
-- ============================================================

-- 1a) Proceso ejecutivo: sin la regla de «tus clientes».
create or replace function public.normalizar_proceso_ejecutivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if auth.uid() is not null then
    if not public.es_admin() then
      raise exception 'Solo un administrador puede cambiar el proceso ejecutivo';
    end if;
    if new.asociado_id = auth.uid() then
      raise exception 'Otro administrador debe actualizar tu propio proceso';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.asociado_id is distinct from old.asociado_id then
      raise exception 'El proceso no puede cambiar de asociado';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;

  if new.estado < 'operando'::public.estado_proceso_ejecutivo then
    new.fecha_inicio_embargo := null;
  elsif new.estado = 'operando'::public.estado_proceso_ejecutivo and new.fecha_inicio_embargo is null then
    new.fecha_inicio_embargo := v_hoy;
  end if;

  if new.fecha_inicio_embargo is not null and new.fecha_inicio_embargo > v_hoy + 31 then
    raise exception 'La fecha de inicio del embargo no puede estar a más de un mes en el futuro';
  end if;

  new.actualizado_por := auth.uid();
  new.updated_at      := now();
  return new;
end;
$$;
revoke all on function public.normalizar_proceso_ejecutivo() from public, anon, authenticated;

-- 1b) Pagos de comisión: el admin puede registrar y corregir los suyos.
create or replace function public.sellar_pago_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.puede_atender(new.asesor_id) then
    raise exception 'El pago debe ser para un asesor activo';
  end if;
  -- Quién y cuándo: siempre del servidor. Un pago nace vigente.
  new.registrado_por   := auth.uid();
  new.created_at       := now();
  new.anulado          := false;
  new.anulado_por      := null;
  new.anulado_at       := null;
  new.motivo_anulacion := null;
  return new;
end;
$$;
revoke all on function public.sellar_pago_comision() from public, anon, authenticated;

create or replace function public.proteger_pago_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(current_setting('ga.motivo_cambio', true)), '');
begin
  if tg_op = 'DELETE' then
    raise exception 'Los pagos de comisión no se borran; anúlelos con un motivo';
  end if;

  if v_motivo is null or char_length(v_motivo) < 5 then
    raise exception 'Para corregir un pago hace falta un motivo (mínimo 5 caracteres)';
  end if;

  if old.anulado then
    raise exception 'Un pago anulado ya no se puede modificar';
  end if;

  if (new.id, new.asesor_id, new.asociado_id, new.periodo_corte, new.registrado_por, new.created_at)
     is distinct from
     (old.id, old.asesor_id, old.asociado_id, old.periodo_corte, old.registrado_por, old.created_at) then
    raise exception 'Solo se puede corregir el monto, el concepto o la nota, o anular el pago';
  end if;

  if new.anulado then
    new.anulado_por      := auth.uid();
    new.anulado_at       := now();
    new.motivo_anulacion := v_motivo;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_pago_comision() from public, anon, authenticated;

-- 1c) Perfiles: el admin puede asignarse clientes o quitárselos.
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
      if new.nombre_completo is distinct from old.nombre_completo then raise exception 'No puede modificar su nombre; solicítelo a la administración'; end if;
      if new.asesor_id is distinct from old.asesor_id then raise exception 'No puede modificar su propio asesor; solicítelo a la administración'; end if;
      if new.institucion is distinct from old.institucion then raise exception 'No puede modificar su institución; solicítelo a la administración'; end if;
      if new.activo is distinct from old.activo then raise exception 'No puede modificar su estado de asociado; solicítelo a la administración'; end if;
      if new.atiende_asociados is distinct from old.atiende_asociados then raise exception 'No puede modificar si atiende asociados; solicítelo a la administración'; end if;
      if new.correo_institucional is distinct from old.correo_institucional then raise exception 'No puede modificar su correo institucional; solicítelo a la administración'; end if;
      if (new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from (old.nomina_entidad, old.nomina_tipo, old.nomina_numero) then
        raise exception 'No puede modificar su cuenta de nómina; solicítelo a la administración';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;

-- 2) Patrullero de Policía (PP) deja de ofrecerse; queda «Patrullero» (PT).
update public.grados set seleccionable = false where codigo = 'PP';
