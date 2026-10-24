-- ============================================================
-- 2026-10-23 — Editar los datos de una solicitud de afiliación antes de
-- aprobarla (pedido de Ricardo Varón vía Sebas).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica
-- (después de 20261022000000_aviso_cambio_datos). Idempotente.
--
--  - admin_editar_afiliacion(): solo un administrador y solo con la solicitud en
--    «pendiente» o «contactado». Corrige nombres, apellidos, cédula,
--    institución, grado, celular, Nequi, correo personal, correo institucional y
--    cuenta de nómina. No toca fotos, asesor, mensaje ni la autorización de datos.
--    Rechaza una cédula o un correo que ya tengan cuenta o otra solicitud abierta
--    (mensajes claros: solo los ve el admin). Valida el dominio del correo
--    institucional. Deja «datos_editados» en historial_solicitudes con los campos
--    cambiados (sin valores).
--  - proteger_solicitud_afiliacion(): sigue impidiendo cualquier otro cambio de
--    datos con sesión; solo lo deja pasar dentro de la RPC (ga.editar_afiliacion).
--  - El grado lo sigue validando el trigger validar_grado_afiliacion y el nombre
--    lo recompone componer_nombre_afiliacion.
-- ============================================================

create or replace function public.proteger_solicitud_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edicion_admin boolean := coalesce(current_setting('ga.editar_afiliacion', true), '') = 'si' and public.es_admin();
begin
  if auth.uid() is not null and not v_edicion_admin then
    if new.nombres is distinct from old.nombres
    or new.apellidos is distinct from old.apellidos
    or new.cedula is distinct from old.cedula
    or new.grado is distinct from old.grado
    or new.institucion is distinct from old.institucion
    or new.unidad is distinct from old.unidad
    or new.celular is distinct from old.celular
    or new.nequi is distinct from old.nequi
    or new.email is distinct from old.email
    or new.correo_institucional is distinct from old.correo_institucional
    or new.nomina_entidad is distinct from old.nomina_entidad
    or new.nomina_tipo is distinct from old.nomina_tipo
    or new.nomina_numero is distinct from old.nomina_numero
    or new.asesor_id is distinct from old.asesor_id
    or new.foto_cedula_frente is distinct from old.foto_cedula_frente
    or new.foto_cedula_reverso is distinct from old.foto_cedula_reverso
    or new.foto_selfie is distinct from old.foto_selfie
    or new.mensaje is distinct from old.mensaje
    or new.acepto_datos_at is distinct from old.acepto_datos_at
    or new.created_at is distinct from old.created_at then
      raise exception 'Solo se puede cambiar el estado de la solicitud de afiliación';
    end if;
  end if;
  -- Aun dentro de la RPC, estos campos nunca cambian.
  if v_edicion_admin and (
       new.asesor_id is distinct from old.asesor_id
    or new.foto_cedula_frente is distinct from old.foto_cedula_frente
    or new.foto_cedula_reverso is distinct from old.foto_cedula_reverso
    or new.foto_selfie is distinct from old.foto_selfie
    or new.mensaje is distinct from old.mensaje
    or new.acepto_datos_at is distinct from old.acepto_datos_at
    or new.created_at is distinct from old.created_at) then
    raise exception 'Solo se pueden corregir los datos escritos por el solicitante';
  end if;
  if auth.uid() is not null and new.estado is not distinct from old.estado then
    new.revisado_por   := old.revisado_por;
    new.fecha_revision := old.fecha_revision;
  end if;
  if new.estado is distinct from old.estado then
    new.revisado_por   := auth.uid();
    new.fecha_revision := now();
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_solicitud_afiliacion() from public, anon, authenticated;

create or replace function public.admin_editar_afiliacion(
  p_solicitud_id         uuid,
  p_nombres              text,
  p_apellidos            text,
  p_cedula               text,
  p_institucion          public.institucion_afiliacion,
  p_grado                text,
  p_celular              text,
  p_nequi                text,
  p_email                text,
  p_correo_institucional text,
  p_nomina_entidad       text,
  p_nomina_tipo          public.tipo_cuenta_nomina,
  p_nomina_numero        text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_actual public.solicitudes_afiliacion%rowtype;
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_inst   text := nullif(lower(btrim(coalesce(p_correo_institucional, ''))), '');
  v_campos text[] := '{}';
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede corregir los datos de una solicitud';
  end if;

  select * into v_actual from public.solicitudes_afiliacion s where s.id = p_solicitud_id for update;
  if not found then
    raise exception 'No encontramos la solicitud';
  end if;
  if v_actual.estado not in ('pendiente', 'contactado') then
    raise exception 'Solo se corrigen solicitudes pendientes o contactadas';
  end if;

  if v_inst is not null
     and split_part(v_inst, '@', 2) <> all (public.dominios_correo_institucional(p_institucion)) then
    raise exception 'El correo institucional no es del dominio de su institución';
  end if;

  if p_nombres is distinct from v_actual.nombres or p_apellidos is distinct from v_actual.apellidos then
    v_campos := array_append(v_campos, 'nombre');
  end if;
  if p_cedula is distinct from v_actual.cedula then
    if exists (select 1 from public.perfiles p where p.cedula = p_cedula)
       or exists (select 1 from public.solicitudes_afiliacion s
                   where s.cedula = p_cedula and s.estado in ('pendiente', 'contactado') and s.id <> p_solicitud_id) then
      raise exception 'Esa cédula ya tiene cuenta u otra solicitud en curso';
    end if;
    v_campos := array_append(v_campos, 'cedula');
  end if;
  if p_institucion is distinct from v_actual.institucion then v_campos := array_append(v_campos, 'institucion'); end if;
  if p_grado is distinct from v_actual.grado then v_campos := array_append(v_campos, 'grado'); end if;
  if p_celular is distinct from v_actual.celular then v_campos := array_append(v_campos, 'celular'); end if;
  if p_nequi is distinct from v_actual.nequi then v_campos := array_append(v_campos, 'nequi'); end if;
  if v_email is distinct from v_actual.email then
    if exists (select 1 from auth.users u where lower(u.email) = v_email)
       or exists (select 1 from public.solicitudes_afiliacion s
                   where s.email = v_email and s.estado in ('pendiente', 'contactado') and s.id <> p_solicitud_id) then
      raise exception 'Ese correo personal ya lo usa otra cuenta u otra solicitud en curso';
    end if;
    v_campos := array_append(v_campos, 'correo_personal');
  end if;
  if v_inst is distinct from v_actual.correo_institucional then
    if v_inst is not null and (
         exists (select 1 from public.perfiles p where p.correo_institucional = v_inst)
      or exists (select 1 from public.solicitudes_afiliacion s
                  where s.correo_institucional = v_inst and s.estado in ('pendiente', 'contactado') and s.id <> p_solicitud_id)) then
      raise exception 'Ese correo institucional ya lo usa otra cuenta u otra solicitud en curso';
    end if;
    v_campos := array_append(v_campos, 'correo_institucional');
  end if;
  if (p_nomina_entidad, p_nomina_tipo, p_nomina_numero)
     is distinct from (v_actual.nomina_entidad, v_actual.nomina_tipo, v_actual.nomina_numero) then
    v_campos := array_append(v_campos, 'nomina');
  end if;
  if cardinality(v_campos) = 0 then
    raise exception 'No hay cambios para guardar';
  end if;

  perform set_config('ga.editar_afiliacion', 'si', true);
  update public.solicitudes_afiliacion s
     set nombres = p_nombres,
         apellidos = p_apellidos,
         cedula = p_cedula,
         institucion = p_institucion,
         grado = p_grado,
         celular = p_celular,
         nequi = p_nequi,
         email = v_email,
         correo_institucional = v_inst,
         nomina_entidad = p_nomina_entidad,
         nomina_tipo = p_nomina_tipo,
         nomina_numero = p_nomina_numero
   where s.id = p_solicitud_id;
  perform set_config('ga.editar_afiliacion', '', true);

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values ('solicitud_afiliacion'::public.historial_entidad, p_solicitud_id, v_uid, 'datos_editados',
          'Campos: ' || array_to_string(v_campos, ', '));
  return v_campos;
end;
$$;
revoke all on function public.admin_editar_afiliacion(uuid, text, text, text, public.institucion_afiliacion, text, text, text, text, text, text, public.tipo_cuenta_nomina, text) from public, anon;
grant execute on function public.admin_editar_afiliacion(uuid, text, text, text, public.institucion_afiliacion, text, text, text, text, text, text, public.tipo_cuenta_nomina, text) to authenticated;
