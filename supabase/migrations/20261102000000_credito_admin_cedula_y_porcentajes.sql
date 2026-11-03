-- ============================================================
-- 2026-11-02 — Porcentajes 50–100 del asociado, crédito creado por el admin
-- y corrección de la cédula (pedido de Sebas).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica
-- (después de 20261030000000_editar_condiciones_credito) ANTES de desplegar
-- el código que la usa. Idempotente (create or replace, if not exists).
--
-- A. Porcentajes del asociado: 50, 60, 70, 80, 90 o 100.
--    * El asociado manda porcentaje_credito (y monto_solicitado). 50 % y 100 %
--      usan cupo, tasa y plazo de su fila de grados_credito; 60–90 % interpolan
--      en línea recta cupo (redondeado a pesos) y tasa entre las filas 50 y 100
--      del grupo, con los valores vigentes al pedir; el plazo es el de la fila 50.
--    * porcentaje_devolucion ya no lo elige el cliente: lo deriva el trigger
--      ('100' si porcentaje_credito = 100; si no, '50' = paquete base).
--      Compatibilidad mientras se despliega el código nuevo: si llega solo
--      porcentaje_devolucion, se usa ese (50 o 100).
--    * Cualquier otro porcentaje: «El porcentaje debe ser 50, 60, 70, 80, 90 o 100».
--    * El INSERT de authenticated en solicitudes_credito es de TABLA (privilegio
--      por defecto de Supabase; nunca se pasó a columnas), así que
--      porcentaje_credito ya era insertable. Se deja explícito con un grant de
--      columna (no abre nada más).
--    * tr_proteger_topes: una pendiente de 60–90 % depende de las DOS filas
--      (50 y 100) de su grupo; no se baja ni se borra ninguna de las dos.
--
-- B. admin_crear_credito(): el admin crea un crédito ya APROBADO (listo para
--    «Marcar desembolsado»), con las mismas validaciones que «Editar
--    condiciones»; puede superar el cupo (queda en el historial con el motivo).
--    * Los triggers de alta reescriben las condiciones: dentro de la RPC se
--      activa el GUC ga.crear_credito_admin y validar_monto_solicitud lo
--      respeta SOLO si además es_admin(). Desde PostgREST nadie ejecuta SQL ni
--      puede fijar un GUC arbitrario (solo request.*), y set_config no está en
--      un esquema expuesto; aun así se exige es_admin() como segunda llave.
--    * Historial veraz: el INSERT no registra «creada» con el asociado como
--      actor (log_historial_credito lo omite con el GUC activo); la RPC escribe
--      «creada_por_admin» con el admin como actor, las condiciones y el motivo,
--      y luego el paso a «aprobado» queda como siempre (actor = el admin).
--
-- C. admin_cambiar_cedula(): corrige la cédula (llave de ingreso: el login la
--    busca en perfiles.cedula con correo_por_cedula()). Actualiza
--    perfiles.cedula, la cédula en auth.users.raw_app_meta_data (no la lee
--    nadie después del alta, pero queda coherente; el trigger
--    sincronizar_perfil_desde_app_metadata no hace nada porque el perfil ya no
--    está en PENDIENTE-) y la cédula de sus solicitudes de afiliación (la
--    eliminación de datos las busca por cédula).
--    * Historial en historial_cambio_datos_perfil con campos {cedula} (sin
--      valores) y una columna nueva motivo, que rechaza números de 6 o más
--      dígitos para que no se cuelen cédulas.
--    * Aviso personal al asociado («Actualizamos tus datos»), como RS-M2.
--    * Barrera: exigir_rpc_datos_perfil ahora también vigila cedula; un admin
--      no cambia la cédula de nadie (ni la suya) por UPDATE directo, solo con
--      la RPC (GUC ga.cambiar_cedula). Los no admin ya los frena
--      proteger_campos_perfil (mismo mensaje de antes). Service role (sin
--      auth.uid()) no cambia: alta de usuarios y eliminación siguen igual.
-- ============================================================

-- ------------------------------------------------------------
-- A.1 Cupo, tasa y plazo para un porcentaje (uso interno: revela la tasa)
-- ------------------------------------------------------------
create or replace function public.condiciones_por_porcentaje(p_grupo public.grado_policial, p_pct integer)
returns table (capacidad_maxima numeric, tasa_interes_mensual numeric, plazo_meses integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_50  public.grados_credito%rowtype;
  v_100 public.grados_credito%rowtype;
begin
  select * into v_50 from public.grados_credito gc
   where gc.grado = p_grupo and gc.porcentaje = '50'::public.porcentaje_devolucion;
  select * into v_100 from public.grados_credito gc
   where gc.grado = p_grupo and gc.porcentaje = '100'::public.porcentaje_devolucion;

  if p_pct <> 100 and v_50.grado is null then
    raise exception 'No hay un tope configurado para el grado % con devolución del %', p_grupo, '50%';
  end if;
  if p_pct <> 50 and v_100.grado is null then
    raise exception 'No hay un tope configurado para el grado % con devolución del %', p_grupo, '100%';
  end if;

  if p_pct = 50 then
    return query select v_50.capacidad_maxima, v_50.tasa_interes_mensual, v_50.plazo_meses;
  elsif p_pct = 100 then
    return query select v_100.capacidad_maxima, v_100.tasa_interes_mensual, v_100.plazo_meses;
  else
    return query select
      round(v_50.capacidad_maxima + (v_100.capacidad_maxima - v_50.capacidad_maxima) * (p_pct - 50) / 50.0),
      round(v_50.tasa_interes_mensual + (v_100.tasa_interes_mensual - v_50.tasa_interes_mensual) * (p_pct - 50) / 50.0, 8),
      v_50.plazo_meses;
  end if;
end;
$$;
revoke all on function public.condiciones_por_porcentaje(public.grado_policial, integer) from public, anon, authenticated;
comment on function public.condiciones_por_porcentaje(public.grado_policial, integer) is
  'Interno (revela la tasa): cupo, tasa y plazo de un grupo para un porcentaje 50..100. 50 y 100 = su fila; en medio, línea recta entre las dos (cupo redondeado a pesos, tasa a 8 decimales, plazo de la fila 50).';

comment on column public.solicitudes_credito.porcentaje_devolucion is
  'Paquete base del crédito: ''100'' si porcentaje_credito = 100; si no, ''50''. Lo deriva validar_monto_solicitud (el cliente ya no lo elige; solo se acepta como dato heredado si no manda porcentaje_credito).';
comment on column public.solicitudes_credito.porcentaje_credito is
  'Porcentaje vigente del crédito (entero, 50 a 100). Al crear, el asociado elige 50, 60, 70, 80, 90 o 100; un admin puede fijar cualquier entero 50..100 (admin_crear_credito / admin_editar_condiciones_credito).';

-- El insert de authenticated ya es de tabla; esto solo lo deja explícito.
grant insert (porcentaje_credito) on public.solicitudes_credito to authenticated;

-- ------------------------------------------------------------
-- A.2 validar_monto_solicitud: porcentajes 50..100 de 10 en 10 y modo admin
-- ------------------------------------------------------------
create or replace function public.validar_monto_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_grupo  public.grado_policial;
  v_pct    integer;
  v_cupo   numeric;
  v_tasa   numeric;
  v_plazo  integer;
begin
  if tg_op = 'UPDATE' then
    -- Resueltas: las congela sellar_revision_solicitud.
    if old.estado <> 'pendiente'::public.estado_solicitud then
      return new;
    end if;
    if coalesce(current_setting('ga.editar_condiciones_credito', true), '') = 'si' then
      return new;
    end if;
    -- Pendiente: las condiciones solo cambian con «Editar condiciones».
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.grado_asociado,
        new.tasa_interes_mensual, new.plazo_meses, new.cuota_mensual,
        new.porcentaje_credito, new.total_a_pagar, new.tipo_credito, new.convenio_id,
        new.condiciones_editadas_at, new.condiciones_editadas_por)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.grado_asociado,
        old.tasa_interes_mensual, old.plazo_meses, old.cuota_mensual,
        old.porcentaje_credito, old.total_a_pagar, old.tipo_credito, old.convenio_id,
        old.condiciones_editadas_at, old.condiciones_editadas_por) then
      raise exception 'Las condiciones de una solicitud solo se cambian con «Editar condiciones»';
    end if;
    return new;
  end if;

  -- El grado sale siempre del perfil, nunca de lo que mande el cliente.
  select p.grado into v_codigo from public.perfiles p where p.id = new.asociado_id;
  if v_codigo is null then
    raise exception 'El asociado no tiene un grado asignado; no se puede calcular el tope de crédito';
  end if;

  select g.grupo_credito into v_grupo from public.grados g where g.codigo = v_codigo;
  if v_grupo is null then
    -- Spec §1: IJ y militares pueden afiliarse pero no pedir crédito.
    raise exception 'Tu grado todavía no tiene cupo de crédito configurado; tu asesor te contactará';
  end if;

  -- Crédito creado por un admin (admin_crear_credito): las condiciones ya
  -- vienen validadas por la RPC. El GUC solo vale con un admin en la sesión.
  if coalesce(current_setting('ga.crear_credito_admin', true), '') = 'si' and public.es_admin() then
    new.grado                 := v_grupo;
    new.grado_asociado        := v_codigo;
    new.cuota_mensual         := null;
    new.porcentaje_devolucion := case when new.porcentaje_credito = 100
                                      then '100'::public.porcentaje_devolucion
                                      else '50'::public.porcentaje_devolucion end;
    return new;
  end if;

  -- Porcentaje: el nuevo campo; si no viene, el heredado (50 o 100).
  v_pct := coalesce(new.porcentaje_credito::integer, new.porcentaje_devolucion::text::integer);
  if v_pct is null or v_pct not in (50, 60, 70, 80, 90, 100) then
    raise exception 'El porcentaje debe ser 50, 60, 70, 80, 90 o 100';
  end if;

  select c.capacidad_maxima, c.tasa_interes_mensual, c.plazo_meses
    into v_cupo, v_tasa, v_plazo
    from public.condiciones_por_porcentaje(v_grupo, v_pct) c;

  if new.monto_solicitado is null or new.monto_solicitado <= 0 then
    raise exception 'El monto solicitado debe ser mayor que cero';
  end if;

  if new.monto_solicitado = 'Infinity'::numeric or new.monto_solicitado <> trunc(new.monto_solicitado) then
    raise exception 'El monto solicitado debe ser un valor en pesos, sin decimales';
  end if;

  if new.monto_solicitado < 100000 then
    raise exception 'El monto mínimo de un crédito es 100000';
  end if;

  if new.monto_solicitado > v_cupo then
    raise exception 'El monto solicitado (%) supera el tope de % para el grado % con devolución del %',
      new.monto_solicitado, v_cupo, v_grupo, v_pct::text || '%';
  end if;

  -- Condiciones: SIEMPRE las pone el servidor (se ignora lo que mande el cliente).
  new.grado                    := v_grupo;
  new.grado_asociado           := v_codigo;
  new.tasa_interes_mensual     := v_tasa;
  new.plazo_meses              := v_plazo;
  new.cuota_mensual            := null;
  new.porcentaje_credito       := v_pct;
  new.porcentaje_devolucion    := case when v_pct = 100 then '100'::public.porcentaje_devolucion
                                       else '50'::public.porcentaje_devolucion end;
  new.total_a_pagar            := null;
  new.tipo_credito             := 'cooperativa'::public.tipo_credito;
  new.convenio_id              := null;
  new.condiciones_editadas_at  := null;
  new.condiciones_editadas_por := null;
  return new;
end;
$$;
revoke all on function public.validar_monto_solicitud() from public, anon, authenticated;

-- ------------------------------------------------------------
-- A.3 tr_proteger_topes: una pendiente de 51..99 % depende de las dos filas
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
        and (s.porcentaje_credito = old.porcentaje::text::smallint
             or s.porcentaje_credito between 51 and 99)
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

-- ------------------------------------------------------------
-- B.1 Historial: el alta hecha por admin_crear_credito la registra la RPC
-- ------------------------------------------------------------
create or replace function public.log_historial_credito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- admin_crear_credito escribe «creada_por_admin» con el admin como actor.
    if coalesce(current_setting('ga.crear_credito_admin', true), '') = 'si' and public.es_admin() then
      return null;
    end if;
    insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
    values ('solicitud_credito'::public.historial_entidad, new.id, new.asociado_id, 'creada', null);
  elsif tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
    values (
      'solicitud_credito'::public.historial_entidad,
      new.id,
      new.revisado_por,
      new.estado::text,
      case when new.estado = 'rechazado'::public.estado_solicitud then new.motivo_rechazo else null end
    );
  end if;
  return null;  -- trigger AFTER: el valor de retorno se ignora
end;
$$;
revoke all on function public.log_historial_credito() from public, anon, authenticated;

comment on column public.historial_solicitudes.accion is
  'Para cambios de estado: el valor del enum (pendiente/aprobado/rechazado/contactado/...). Para notas: ''nota''. Para la creación: ''creada'' (la pidió el asociado) o ''creada_por_admin'' (admin_crear_credito). Otras: condiciones_editadas, desembolsado, datos_editados.';

-- ------------------------------------------------------------
-- B.2 RPC «Crear crédito» (queda aprobado)
-- ------------------------------------------------------------
create or replace function public.admin_crear_credito(
  p_asociado_id   uuid,
  p_monto         numeric,
  p_total_a_pagar numeric,
  p_plazo_meses   integer,
  p_porcentaje    integer,
  p_tipo          public.tipo_credito,
  p_convenio_id   uuid,
  p_motivo        text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_perfil   public.perfiles%rowtype;
  v_grupo    public.grado_policial;
  v_motivo   text := btrim(coalesce(p_motivo, ''));
  v_convenio uuid := case when p_tipo = 'convenio'::public.tipo_credito then p_convenio_id end;
  v_cupo     numeric;
  v_tasa     numeric;
  v_id       uuid;
  v_detalle  text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede crear un crédito';
  end if;
  if char_length(v_motivo) not between 5 and 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_asociado_id is null or p_asociado_id = v_uid then
    raise exception 'No puedes crearte un crédito a ti mismo; debe hacerlo otro administrador';
  end if;

  select * into v_perfil from public.perfiles p where p.id = p_asociado_id for update;
  if not found or v_perfil.rol <> 'asociado'::public.rol_usuario or v_perfil.eliminado_at is not null then
    raise exception 'No encontramos al asociado';
  end if;
  if not v_perfil.activo then
    raise exception 'El asociado está inactivo; no se le puede crear un crédito';
  end if;
  select g.grupo_credito into v_grupo from public.grados g where g.codigo = v_perfil.grado;
  if v_grupo is null then
    raise exception 'El asociado no tiene un grado con cupo de crédito configurado';
  end if;
  -- Misma regla que chk_credito_proceso_operando (exigir_proceso_operando_credito).
  if not exists (
    select 1 from public.procesos_ejecutivos pe
     where pe.asociado_id = p_asociado_id
       and pe.estado = 'operando'::public.estado_proceso_ejecutivo
  ) then
    raise exception 'El proceso ejecutivo del asociado no está en «operando»';
  end if;
  if exists (
    select 1 from public.solicitudes_credito s
     where s.asociado_id = p_asociado_id and s.estado = 'pendiente'::public.estado_solicitud
  ) then
    raise exception 'El asociado ya tiene una solicitud de crédito pendiente; resuélvela primero';
  end if;

  -- Mismas validaciones que admin_editar_condiciones_credito.
  if p_monto is null or p_monto = 'Infinity'::numeric or p_monto <> trunc(p_monto) or p_monto < 100000 or p_monto > 1000000000 then
    raise exception 'El monto a recibir debe ser en pesos, sin decimales, entre 100000 y 1000000000';
  end if;
  if p_total_a_pagar is null or p_total_a_pagar = 'Infinity'::numeric or p_total_a_pagar <> trunc(p_total_a_pagar) or p_total_a_pagar > 2000000000 then
    raise exception 'El total a pagar debe ser en pesos, sin decimales';
  end if;
  if p_total_a_pagar < p_monto then
    raise exception 'El total a pagar no puede ser menor que el monto a recibir';
  end if;
  if p_plazo_meses is null or p_plazo_meses not between 1 and 60 then
    raise exception 'El plazo debe estar entre 1 y 60 meses';
  end if;
  if p_porcentaje is null or p_porcentaje not between 50 and 100 then
    raise exception 'El porcentaje debe ser un número entero entre 50 y 100';
  end if;
  if p_tipo is null then
    raise exception 'Elige el tipo de crédito';
  end if;
  if p_tipo = 'convenio'::public.tipo_credito then
    if v_convenio is null then
      raise exception 'Elige el convenio';
    end if;
    if not exists (select 1 from public.convenios c where c.id = v_convenio and c.visible) then
      raise exception 'Ese convenio no está disponible';
    end if;
  end if;

  -- Tasa (y cupo de referencia) interpolados entre 50 % y 100 % del grupo.
  select c.capacidad_maxima, c.tasa_interes_mensual into v_cupo, v_tasa
    from public.condiciones_por_porcentaje(v_grupo, p_porcentaje) c;

  perform set_config('ga.crear_credito_admin', 'si', true);
  insert into public.solicitudes_credito
    (asociado_id, monto_solicitado, porcentaje_credito, porcentaje_devolucion, tasa_interes_mensual,
     plazo_meses, total_a_pagar, tipo_credito, convenio_id, condiciones_editadas_at, condiciones_editadas_por)
  values
    (p_asociado_id, p_monto, p_porcentaje,
     case when p_porcentaje = 100 then '100'::public.porcentaje_devolucion else '50'::public.porcentaje_devolucion end,
     v_tasa, p_plazo_meses, p_total_a_pagar, p_tipo, v_convenio, now(), v_uid)
  returning id into v_id;
  perform set_config('ga.crear_credito_admin', '', true);

  v_detalle := format('Crédito creado y aprobado por un administrador. Recibe: %s. Devuelve: %s. Plazo: %s meses. Porcentaje: %s. Tipo: %s. ',
                      p_monto, p_total_a_pagar, p_plazo_meses, p_porcentaje, p_tipo);
  if p_monto > v_cupo then
    v_detalle := v_detalle || format('Supera el cupo de %s. ', v_cupo);
  end if;
  -- Un milisegundo antes de «aprobado» (misma transacción = mismo now()),
  -- para que el historial se lea en orden.
  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle, created_at)
  values ('solicitud_credito'::public.historial_entidad, v_id, v_uid, 'creada_por_admin',
          v_detalle || 'Motivo: ' || v_motivo, now() - interval '1 millisecond');

  -- Aprobación: sellar_revision_solicitud pone revisado_por = el admin y
  -- fecha_respuesta = now(); log_historial_credito registra «aprobado».
  update public.solicitudes_credito s
     set estado = 'aprobado'::public.estado_solicitud
   where s.id = v_id;

  return v_id;
end;
$$;
revoke all on function public.admin_crear_credito(uuid, numeric, numeric, integer, integer, public.tipo_credito, uuid, text) from public, anon;
grant execute on function public.admin_crear_credito(uuid, numeric, numeric, integer, integer, public.tipo_credito, uuid, text) to authenticated;
comment on function public.admin_crear_credito(uuid, numeric, numeric, integer, integer, public.tipo_credito, uuid, text) is
  'Solo admin (no para sí mismo): crea un crédito ya aprobado para un asociado activo, con grado con cupo, proceso en «operando» y sin pendiente. Puede superar el cupo; deja «creada_por_admin» con el motivo y «aprobado» en historial_solicitudes. Devuelve el id.';

-- ------------------------------------------------------------
-- C.1 Historial de cambios de datos: motivo (sin valores personales)
-- ------------------------------------------------------------
alter table public.historial_cambio_datos_perfil
  add column if not exists motivo text check (motivo is null or char_length(motivo) between 5 and 300);
comment on table public.historial_cambio_datos_perfil is
  'Cambios de datos del asociado hechos por un admin («Editar datos», «Cambiar cédula»): quién, cuándo, qué columnas y, si la RPC lo pide, el motivo. No guarda valores. Inmutable.';
comment on column public.historial_cambio_datos_perfil.motivo is
  'Motivo escrito por el admin (admin_cambiar_cedula). No admite números de 6 o más dígitos para no guardar cédulas.';

-- ------------------------------------------------------------
-- C.2 Barrera: la cédula solo cambia con admin_cambiar_cedula()
-- ------------------------------------------------------------
create or replace function public.exigir_rpc_datos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return new;
  end if;

  -- Cédula (llave de ingreso). A los no admin ya los frena proteger_campos_perfil.
  if new.cedula is distinct from old.cedula
     and public.es_admin()
     and coalesce(current_setting('ga.cambiar_cedula', true), '') <> 'si' then
    if new.id = v_uid then
      raise exception 'No puedes cambiar tu propia cédula; debe hacerlo otro administrador';
    end if;
    raise exception 'La cédula de un asociado solo se cambia con «Cambiar cédula»';
  end if;

  if coalesce(current_setting('ga.editar_datos_asociado', true), '') = 'si' then
    return new;
  end if;

  if new.id <> v_uid
     and (new.nombre_completo, new.telefono, new.correo_institucional, new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from
         (old.nombre_completo, old.telefono, old.correo_institucional, old.nomina_entidad, old.nomina_tipo, old.nomina_numero)
  then
    raise exception 'Los datos de un asociado solo se cambian con «Editar datos»';
  end if;

  -- Un admin tampoco se cambia a sí mismo nombre, correo institucional ni nómina
  -- (para el resto de roles ya lo impide proteger_campos_perfil). El celular sí.
  if new.id = v_uid and public.es_admin()
     and (new.nombre_completo, new.correo_institucional, new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from
         (old.nombre_completo, old.correo_institucional, old.nomina_entidad, old.nomina_tipo, old.nomina_numero)
  then
    raise exception 'No puedes cambiar tus propios datos; debe hacerlo otro administrador';
  end if;

  return new;
end;
$$;
revoke all on function public.exigir_rpc_datos_perfil() from public, anon, authenticated;

drop trigger if exists tr_exigir_rpc_datos_perfil on public.perfiles;
create trigger tr_exigir_rpc_datos_perfil
  before update of cedula, nombre_completo, telefono, correo_institucional, nomina_entidad, nomina_tipo, nomina_numero
  on public.perfiles
  for each row execute function public.exigir_rpc_datos_perfil();

-- ------------------------------------------------------------
-- C.3 RPC «Cambiar cédula»
-- ------------------------------------------------------------
create or replace function public.admin_cambiar_cedula(p_asociado_id uuid, p_cedula text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_actual public.perfiles%rowtype;
  -- Misma normalización que esquemaCedula (lib/validaciones/comunes.ts).
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[[:space:].-]', '', 'g');
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_fecha  text := to_char(now() at time zone 'America/Bogota', 'DD/MM/YYYY');
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar la cédula de un asociado';
  end if;
  if p_asociado_id is null or p_asociado_id = v_uid then
    raise exception 'No puedes cambiar tu propia cédula; debe hacerlo otro administrador';
  end if;
  if char_length(v_motivo) not between 5 and 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if regexp_replace(v_motivo, '[[:space:].-]', '', 'g') ~ '[0-9]{6,}' then
    raise exception 'El motivo no debe incluir números de cédula';
  end if;

  select * into v_actual from public.perfiles p where p.id = p_asociado_id for update;
  if not found or v_actual.rol <> 'asociado'::public.rol_usuario or v_actual.eliminado_at is not null then
    raise exception 'No encontramos al asociado';
  end if;
  if v_actual.asesor_id = v_uid then
    raise exception 'Es uno de tus clientes: otro administrador debe cambiar su cédula';
  end if;

  if v_cedula !~ '^[0-9]{6,10}$' then
    raise exception 'La cédula debe tener solo números, entre 6 y 10 dígitos.';
  end if;
  if v_cedula = v_actual.cedula then
    raise exception 'La cédula nueva es igual a la actual';
  end if;
  if exists (select 1 from public.perfiles p where p.cedula = v_cedula)
     or exists (select 1 from public.solicitudes_afiliacion s
                 where s.cedula = v_cedula and s.estado in ('pendiente', 'contactado')) then
    raise exception 'Esa cédula ya tiene cuenta u otra solicitud en curso';
  end if;

  begin
    perform set_config('ga.cambiar_cedula', 'si', true);
    update public.perfiles p set cedula = v_cedula where p.id = p_asociado_id;
    perform set_config('ga.cambiar_cedula', '', true);
  exception when unique_violation then
    -- Carrera con otra cuenta que tomó la misma cédula.
    raise exception 'Esa cédula ya tiene cuenta u otra solicitud en curso';
  end;

  -- Sus solicitudes de afiliación siguen siendo suyas (la eliminación de
  -- datos las busca por cédula). proteger_solicitud_afiliacion lo deja pasar
  -- con ga.editar_afiliacion y un admin; solo cambia la cédula.
  perform set_config('ga.editar_afiliacion', 'si', true);
  update public.solicitudes_afiliacion s set cedula = v_cedula where s.cedula = v_actual.cedula;
  perform set_config('ga.editar_afiliacion', '', true);

  -- Coherencia con lo que guardó el alta en Auth. El trigger
  -- sincronizar_perfil_desde_app_metadata no hace nada (el perfil no está en PENDIENTE-).
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('cedula', v_cedula)
   where u.id = p_asociado_id;

  insert into public.historial_cambio_datos_perfil (perfil_id, actor_id, campos, motivo)
  values (p_asociado_id, v_uid, array['cedula'], v_motivo);

  insert into public.avisos_asociados (titulo, mensaje, creado_por, destinatario_id)
  values (
    'Actualizamos tus datos',
    'El ' || v_fecha || ' la cooperativa actualizó tu número de cédula. Desde ahora ingresas con el número nuevo. '
      || 'Si no pediste este cambio, escríbenos por WhatsApp.',
    v_uid,
    p_asociado_id
  );
end;
$$;
revoke all on function public.admin_cambiar_cedula(uuid, text, text) from public, anon;
grant execute on function public.admin_cambiar_cedula(uuid, text, text) to authenticated;
comment on function public.admin_cambiar_cedula(uuid, text, text) is
  'Solo admin: corrige la cédula (llave de ingreso) de un asociado no eliminado que no sea él mismo ni su cliente. Actualiza perfil, app_metadata de Auth y sus afiliaciones; deja historial (sin valores) y aviso personal.';
