-- ============================================================
-- ga-auditor-supabase, 2026-10-09 — Revisión de seguridad del 8-oct (H-01, H-02, H-03, H-05, H-07).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Todas las migraciones hasta 20261008000000 ya están aplicadas: esta es nueva.
--
--  H-01 (alta)  anon ya no lee convenios.telefono_contacto (el WhatsApp queda
--               para quien tiene sesión).
--  H-02 (media) buscar_asociados_general: la cédula se busca EXACTA (6 a 10 dígitos),
--               ya no por fragmentos (no se puede reconstruir la cédula enmascarada).
--  H-03 (media) El cambio de correo de ingreso queda atado a la solicitud de
--               recuperación elegida: el correo que se aplica es el de la solicitud,
--               la solicitud debe tener 10 min de creada y, al registrar, el correo
--               actual en Auth debe ser exactamente el de la solicitud.
--  H-05 (media) Varias solicitudes de recuperación pendientes por perfil (tope 3);
--               un tercero con la cédula ya no bloquea a la persona real.
--  H-07 (baja)  admin_cambiar_estado_asociado no desactiva a un administrador.
--  H-09 (baja)  fotos_carne_huerfanas: el cron borra las fotos del carné que nunca se confirmaron.
--
-- CAMBIOS DE FIRMA (el código de la app debe seguirlos):
--   admin_validar_cambio_correo(uuid, text)  -> admin_validar_cambio_correo(uuid, uuid, text)
--       ahora devuelve una FILA (o_solicitud_id, o_correo_nuevo, o_celular_coincide)
--   admin_registrar_cambio_correo(uuid, text) -> admin_registrar_cambio_correo(uuid, uuid, text)
--   (las firmas viejas se eliminan; no quedan sobrecargas ambiguas)
--
-- Orden: esta migración va sola, después de 20261008000000. Idempotente.
-- ============================================================

-- ============================================================
-- H-01. anon no lee telefono_contacto
--   `revoke select` a nivel de tabla también quita los permisos por columna.
--   Se vuelven a conceder SOLO las columnas comerciales, sin el WhatsApp.
--   authenticated lo lee con la política convenios_select_visibles
--   (visible o admin); el grant de columna es redundante con el de tabla
--   pero deja explícito que esa columna es de quien tiene sesión.
-- ============================================================
revoke select on public.convenios from anon;
grant select (id, nombre_empresa, nit, especialidad, emoji, descripcion, servicios, sedes,
              orden, visible, logo_path, video_url, pdf_url, pdf_tamano)
  on public.convenios to anon;

grant select (telefono_contacto) on public.convenios to authenticated;

-- ============================================================
-- H-02. Búsqueda general de asociados: cédula EXACTA
--   Igual que la versión de 20261003300000 salvo la rama de dígitos:
--   solo 6 a 10 dígitos y `cedula = dígitos` (antes `like '%dígitos%'`).
--   La búsqueda por nombre no cambia.
-- ============================================================
create or replace function public.buscar_asociados_general(p_texto text)
returns table (nombre text, cedula_enmascarada text, asesor_texto text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_digitos text := regexp_replace(btrim(coalesce(p_texto, '')), '[\s.\-]', '', 'g');
  v_patron  text;
begin
  if auth.uid() is null or not public.puede_atender(auth.uid()) then
    raise exception 'Solo los asesores pueden buscar asociados' using errcode = '42501';
  end if;

  if v_digitos ~ '^[0-9]+$' then
    -- H-02: cédula completa (6 a 10 dígitos) y coincidencia exacta.
    if char_length(v_digitos) < 6 or char_length(v_digitos) > 10 then
      return;
    end if;
    return query
      select p.nombre_completo::text,
             public.enmascarar_cedula(p.cedula),
             (case
                when p.asesor_id is null then 'Sin asesor'
                else coalesce(a.nombre_completo, 'Sin asesor')
              end)::text
        from public.perfiles p
        left join public.perfiles a on a.id = p.asesor_id
       where p.rol = 'asociado'::public.rol_usuario
         and p.activo
         and p.cedula = v_digitos
       order by p.nombre_completo
       limit 10;
  else
    if char_length(v_texto) < 4 or char_length(v_texto) > 60 then
      return;
    end if;
    v_patron := '%' || replace(replace(replace(v_texto, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    return query
      select p.nombre_completo::text,
             public.enmascarar_cedula(p.cedula),
             (case
                when p.asesor_id is null then 'Sin asesor'
                else coalesce(a.nombre_completo, 'Sin asesor')
              end)::text
        from public.perfiles p
        left join public.perfiles a on a.id = p.asesor_id
       where p.rol = 'asociado'::public.rol_usuario
         and p.activo
         and p.nombre_completo ilike v_patron
       order by p.nombre_completo
       limit 10;
  end if;
end;
$$;
revoke all on function public.buscar_asociados_general(text) from public, anon;
grant execute on function public.buscar_asociados_general(text) to authenticated;
comment on function public.buscar_asociados_general(text) is
  'Búsqueda general de asociados activos por nombre (mínimo 4 letras) o por cédula COMPLETA (6 a 10 dígitos, coincidencia exacta; H-02) para asesores: nombre, cédula enmascarada y nombre de quien lo atiende (asesor o admin). Máximo 10 resultados. Solo puede_atender().';

-- ============================================================
-- H-05. Varias solicitudes de recuperación pendientes por perfil (tope 3)
--   * Estado nuevo 'reemplazada': la pendiente más vieja que sobra del tope,
--     o las que quedan abiertas cuando el admin atiende otra de la misma persona.
--   * El índice único parcial se cambia por uno NO único (para la bandeja).
--   * Ya no hay `on conflict`: crear_solicitud_recuperacion cuenta y recorta.
-- ============================================================
alter table public.solicitudes_recuperacion_acceso
  drop constraint if exists solicitudes_recuperacion_acceso_estado_check;
alter table public.solicitudes_recuperacion_acceso
  add constraint solicitudes_recuperacion_acceso_estado_check
  check (estado in ('pendiente', 'atendida', 'rechazada', 'reemplazada'));

drop index if exists public.ux_recuperacion_pendiente_por_perfil;
create index if not exists ix_recuperacion_pendientes_por_perfil
  on public.solicitudes_recuperacion_acceso (perfil_id, created_at desc)
  where estado = 'pendiente';

-- La política "recuperacion_select_admin" (20261002500000) ya deja al admin ver
-- TODAS las filas (todos los estados): no cambia.

create or replace function public.crear_solicitud_recuperacion(
  p_cedula       text,
  p_correo_nuevo text,
  p_celular      text,
  p_motivo       text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles%rowtype;
  v_actual text;
  v_correo text := lower(btrim(p_correo_nuevo));
  v_id     uuid;
begin
  select p.* into v_perfil
    from public.perfiles p
   where p.cedula = btrim(p_cedula)
     and p_cedula ~ '^\s*[0-9]{6,10}\s*$'
     and p.rol = 'asociado'::public.rol_usuario
     and p.activo
   limit 1;
  if not found then
    return null;
  end if;

  select u.email::text into v_actual from auth.users u where u.id = v_perfil.id;
  if v_correo = lower(coalesce(v_actual, '')) then
    return null;  -- pide el mismo correo que ya tiene: nada que revisar
  end if;

  -- Serializa las altas de la misma persona (el tope se cuenta sin carreras).
  perform pg_advisory_xact_lock(hashtextextended('recuperacion:' || v_perfil.id::text, 0));

  -- Repetir exactamente la misma petición no llena la bandeja.
  if exists (
    select 1 from public.solicitudes_recuperacion_acceso s
     where s.perfil_id = v_perfil.id and s.estado = 'pendiente' and s.correo_nuevo = v_correo
  ) then
    return null;
  end if;

  insert into public.solicitudes_recuperacion_acceso
    (perfil_id, cedula, correo_nuevo, celular, celular_coincide, motivo, created_at)
  values (
    v_perfil.id,
    v_perfil.cedula,
    v_correo,
    p_celular,
    coalesce(regexp_replace(coalesce(v_perfil.telefono, ''), '[^0-9]', '', 'g') = p_celular, false),
    btrim(p_motivo),
    clock_timestamp()   -- orden estable aunque varias entren en la misma transacción
  )
  returning id into v_id;

  -- Tope: máximo 3 pendientes por persona; las más viejas pasan a «reemplazada»
  -- (el admin las sigue viendo en la bandeja/historial).
  update public.solicitudes_recuperacion_acceso s
     set estado = 'reemplazada',
         resuelta_at = now(),
         motivo_resolucion = 'Reemplazada por solicitudes más recientes (máximo 3 pendientes por persona)'
   where s.id in (
     select x.id
       from public.solicitudes_recuperacion_acceso x
      where x.perfil_id = v_perfil.id and x.estado = 'pendiente'
      order by x.created_at desc, x.id
      offset 3
   );

  return v_id;  -- null si se repitió la misma petición
end;
$$;
revoke all on function public.crear_solicitud_recuperacion(text, text, text, text) from public, anon, authenticated;
grant execute on function public.crear_solicitud_recuperacion(text, text, text, text) to service_role;
comment on function public.crear_solicitud_recuperacion(text, text, text, text) is
  'Registra un pedido de recuperación de acceso si la cédula es de un asociado activo. Solo service_role. Hasta 3 pendientes por persona (la más vieja pasa a «reemplazada»); la misma petición repetida no se duplica. El servidor responde igual exista o no la cédula (anti-enumeración).';

-- ============================================================
-- H-03. Cambio de correo atado a la solicitud
--   DECISIÓN: la función recibe el id de la solicitud (el admin la elige en la
--   bandeja, ahora que puede haber varias) y DEVUELVE el correo a aplicar; el
--   admin ya no escribe el correo. Así el correo que llega a Auth es el que la
--   persona pidió. En el registro se comprueba además que auth.users tenga
--   exactamente ese correo (si el servidor aplicó otro, falla).
--   Nuevo: la solicitud debe tener al menos 10 minutos de creada.
-- ============================================================
drop function if exists public.admin_registrar_cambio_correo(uuid, text);
drop function if exists public.admin_validar_cambio_correo(uuid, text);

create or replace function public.admin_validar_cambio_correo(
  p_asociado_id  uuid,
  p_solicitud_id uuid,
  p_motivo       text
)
returns table (o_solicitud_id uuid, o_correo_nuevo text, o_celular_coincide boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_sol    record;
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede cambiar el correo de ingreso';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_asociado_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio correo de ingreso desde aquí; usa tu perfil';
  end if;
  if not exists (
    select 1 from public.perfiles p
     where p.id = p_asociado_id and p.rol = 'asociado'::public.rol_usuario
  ) then
    raise exception 'El asociado no existe';
  end if;
  -- RS-01: quien atiende al asociado no puede cambiarle el correo.
  if exists (
    select 1 from public.perfiles p
     where p.id = p_asociado_id and p.asesor_id = auth.uid()
  ) then
    raise exception 'Otro administrador debe cambiar el correo de tus clientes';
  end if;
  -- Tampoco si fue él quien le cambió el asesor hace poco (se saltaría RS-01).
  if exists (
    select 1 from public.historial_cambio_asesor h
     where h.perfil_id = p_asociado_id
       and h.actor_id = auth.uid()
       and h.created_at > now() - interval '24 hours'
  ) then
    raise exception 'Otro administrador debe cambiar el correo: cambiaste el asesor de esta persona hace menos de 24 horas';
  end if;

  select s.id, s.correo_nuevo, s.celular_coincide, s.created_at into v_sol
    from public.solicitudes_recuperacion_acceso s
   where s.id = p_solicitud_id
     and s.perfil_id = p_asociado_id
     and s.estado = 'pendiente';
  if not found then
    if not exists (
      select 1 from public.solicitudes_recuperacion_acceso s
       where s.perfil_id = p_asociado_id and s.estado = 'pendiente'
    ) then
      raise exception 'No hay una solicitud de recuperación pendiente de esta persona';
    end if;
    raise exception 'La solicitud elegida no es una solicitud pendiente de esta persona';
  end if;
  -- H-03: la solicitud debe haber esperado al menos 10 minutos (tiempo para que
  -- la persona real lo note y para verificar la identidad por fuera).
  if v_sol.created_at > now() - interval '10 minutes' then
    raise exception 'La solicitud debe tener al menos 10 minutos de creada';
  end if;

  return query select v_sol.id, v_sol.correo_nuevo, v_sol.celular_coincide;
end;
$$;
revoke all on function public.admin_validar_cambio_correo(uuid, uuid, text) from public, anon;
grant execute on function public.admin_validar_cambio_correo(uuid, uuid, text) to authenticated;
comment on function public.admin_validar_cambio_correo(uuid, uuid, text) is
  'Solo admin: valida (sin cambiar nada) que se pueda aplicar la solicitud de recuperación elegida: motivo, no a sí mismo, asociado, no su cliente, sin cambio de asesor propio en 24 h, solicitud pendiente de esa persona y con 10 minutos de creada. Devuelve (id, correo_nuevo, celular_coincide): el correo que se aplica es EXACTAMENTE el de la solicitud.';

create or replace function public.admin_registrar_cambio_correo(
  p_asociado_id  uuid,
  p_solicitud_id uuid,
  p_motivo       text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_val    record;
  v_id     uuid;
begin
  select * into v_val
    from public.admin_validar_cambio_correo(p_asociado_id, p_solicitud_id, v_motivo);

  -- H-03: el correo que quedó en Auth debe ser el de la solicitud.
  if not exists (
    select 1 from auth.users u
     where u.id = p_asociado_id
       and lower(btrim(u.email::text)) = v_val.o_correo_nuevo
  ) then
    raise exception 'El correo de ingreso actual no coincide con el de la solicitud elegida';
  end if;

  update public.solicitudes_recuperacion_acceso
     set estado = 'atendida',
         resuelta_por = auth.uid(),
         resuelta_at = now(),
         motivo_resolucion = v_motivo
   where id = v_val.o_solicitud_id and estado = 'pendiente';
  if not found then
    raise exception 'La solicitud ya fue resuelta';
  end if;

  -- Las demás pendientes de la misma persona quedan sin efecto.
  update public.solicitudes_recuperacion_acceso
     set estado = 'reemplazada',
         resuelta_por = auth.uid(),
         resuelta_at = now(),
         motivo_resolucion = 'Se atendió otra solicitud de esta persona'
   where perfil_id = p_asociado_id and estado = 'pendiente';

  update public.historial_cambio_correo_ingreso
     set actor_id = auth.uid(), origen = 'admin', motivo = v_motivo, solicitud_id = v_val.o_solicitud_id
   where id = (
     select h.id from public.historial_cambio_correo_ingreso h
      where h.perfil_id = p_asociado_id and h.origen = 'auth'
        and h.created_at > now() - interval '2 minutes'
      order by h.created_at desc limit 1
   )
  returning id into v_id;

  if v_id is null then
    insert into public.historial_cambio_correo_ingreso (perfil_id, actor_id, origen, motivo, solicitud_id)
    values (p_asociado_id, auth.uid(), 'admin', v_motivo, v_val.o_solicitud_id)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.admin_registrar_cambio_correo(uuid, uuid, text) from public, anon;
grant execute on function public.admin_registrar_cambio_correo(uuid, uuid, text) to authenticated;
comment on function public.admin_registrar_cambio_correo(uuid, uuid, text) is
  'Solo admin (valida con admin_validar_cambio_correo): comprueba que el correo actual en Auth sea el de la solicitud elegida, deja el historial, cierra esa solicitud como atendida y pasa las demás pendientes de la persona a «reemplazada». El cambio en auth.users lo hace el servidor ANTES de llamar a esta función.';

-- ============================================================
-- H-07. Un admin no desactiva a otro admin
--   Igual que 20260930200400 salvo el rechazo cuando el perfil es admin y se
--   quiere desactivar. Reactivar a un admin inactivo sí se permite.
--   OJO: admin_cambiar_rol_equipo hoy NO baja a un admin (solo mueve
--   secretario<->asesor y secretario->admin), así que desactivar a un admin
--   se hace por SQL (Sebas, desde el panel). Ver el reporte.
-- ============================================================
create or replace function public.admin_cambiar_estado_asociado(
  p_asociado_id uuid, p_activo boolean, p_motivo text)
returns table (asociado_id uuid, activo boolean, historial_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_actual boolean;
  v_rol    public.rol_usuario;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_hist   bigint;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de un asociado';
  end if;
  if p_asociado_id is null or p_activo is null then
    raise exception 'Faltan datos para cambiar el estado';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_asociado_id = v_uid then
    raise exception 'No puedes cambiar tu propio estado; debe hacerlo otro administrador';
  end if;

  select p.activo, p.rol into v_actual, v_rol from public.perfiles p where p.id = p_asociado_id for update;
  if not found then
    raise exception 'El asociado no existe';
  end if;
  if v_rol = 'admin'::public.rol_usuario and not p_activo then
    raise exception 'No se puede desactivar a un administrador desde la app; pídelo al equipo técnico';
  end if;
  if v_actual = p_activo then
    if p_activo then
      raise exception 'El asociado ya está activo';
    else
      raise exception 'El asociado ya está dado de baja';
    end if;
  end if;

  perform set_config('ga.cambio_estado_asociado', 'si', true);
  update public.perfiles p set activo = p_activo where p.id = p_asociado_id;
  perform set_config('ga.cambio_estado_asociado', '', true);

  insert into public.historial_estado_asociado (asociado_id, activo_anterior, activo_nuevo, motivo, admin_id)
  values (p_asociado_id, v_actual, p_activo, v_motivo, v_uid)
  returning id into v_hist;

  return query select p_asociado_id, p_activo, v_hist;
end;
$$;
revoke all on function public.admin_cambiar_estado_asociado(uuid, boolean, text) from public, anon;
grant execute on function public.admin_cambiar_estado_asociado(uuid, boolean, text) to authenticated;

-- ============================================================
-- H-09. Fotos del carné huérfanas
--   crearSubidaFotoCarne entrega URLs de subida; si el asociado sube y no
--   confirma, el archivo queda en `fotos-carne` sin fila en fotos_carne.
--   Igual que fotos_huerfanas_afiliacion: solo service_role (cron), archivos
--   con más de 24 h cuya ruta no es la vigente de ningún asociado.
-- ============================================================
create or replace function public.fotos_carne_huerfanas(p_limite integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'fotos-carne'
    and o.created_at < now() - interval '24 hours'
    and o.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and not exists (select 1 from public.fotos_carne f where f.ruta = o.name)
  order by o.created_at, o.name
  limit greatest(coalesce(p_limite, 500), 0);
$$;
revoke all on function public.fotos_carne_huerfanas(integer) from public, anon, authenticated;
grant execute on function public.fotos_carne_huerfanas(integer) to service_role;
comment on function public.fotos_carne_huerfanas(integer) is
  'Solo service_role (cron de limpieza, H-09): archivos de fotos-carne con más de 24 h que no son la foto vigente de ningún asociado, los más viejos primero, hasta p_limite.';
