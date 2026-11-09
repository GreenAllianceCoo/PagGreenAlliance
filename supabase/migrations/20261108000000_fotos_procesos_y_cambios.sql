-- ============================================================
-- 2026-11-08 — Fotos de afiliación, documentos del proceso y sección «Cambios»
-- (pedido de Sebas). PROPUESTA: Sebas la aplica en producción ANTES de desplegar
-- el código que la usa. Idempotente (create or replace, if not exists).
--
-- Decisiones de Sebas (8-nov): el historial guarda el valor anterior y el nuevo;
-- fotos y «Cambios» solo los ve el admin; el proceso admite varios PDF con
-- historial; solo el admin sube y descarga los PDF.
--
-- A. Valores antes/después en historial_cambio_datos_perfil
--    * Columnas valores_anteriores / valores_nuevos (jsonb, solo de los campos
--      que cambiaron). admin_editar_datos_asociado y admin_cambiar_cedula las
--      llenan. Antes la tabla no guardaba valores (decisión anterior); ahora sí,
--      y la eliminación del asociado los borra (E).
--
-- B. Fotos de afiliación (cédula frente/reverso y selfie): el admin las cambia
--    * El archivo nuevo vive en el MISMO prefijo de la solicitud
--      («solicitudes/<id>/<frente|reverso|selfie>-<uuid>.<ext>»), así la limpieza
--      de huérfanas (fotos_huerfanas_afiliacion) no lo toca mientras la
--      solicitud exista. La foto anterior NO se borra: queda en el historial
--      para verla en «Cambios».
--    * proteger_solicitud_afiliacion: modo nuevo ga.cambiar_foto_afiliacion
--      (solo con es_admin()) en el que SOLO cambian las 3 columnas de fotos.
--    * Como la cédula: no a sí mismo ni a sus propios clientes (la selfie sale en
--      el carné y sirve para reconocer a la persona).
--    * La selfie nueva pasa sola al carné si el asociado no subió foto propia
--      (foto_carne_de_asociado lee la columna).
--
-- C. Documentos del proceso ejecutivo (PDF, varios por asociado)
--    * Bucket privado procesos-documentos (10 MB, solo application/pdf), sin
--      políticas de Storage: sube y firma solo el servidor (service role) tras
--      exigir admin.
--    * Tabla documentos_proceso: el admin la lee (RLS); escribe solo por RPC.
--      «Quitar» deja la fila (quién, cuándo, motivo) y el servidor borra el
--      archivo.
--
-- D. admin_cambios_asociados(): una sola lista de cambios por asociado (datos y
--    cédula con valores, fotos de afiliación, foto del carné, correo de ingreso,
--    asesor, baja/reactivación, proceso ejecutivo y documentos). Solo admin.
--
-- E. admin_confirmar_eliminacion: además borra las fotos anteriores del
--    historial, los PDF del proceso y los valores del historial de datos.
-- ============================================================

-- ------------------------------------------------------------
-- A.1 Columnas de valores
-- ------------------------------------------------------------
alter table public.historial_cambio_datos_perfil
  add column if not exists valores_anteriores jsonb,
  add column if not exists valores_nuevos     jsonb;
comment on table public.historial_cambio_datos_perfil is
  'Cambios de datos del asociado hechos por un admin («Editar datos», «Corregir cédula»): quién, cuándo, qué columnas, el valor anterior y el nuevo, y el motivo si la RPC lo pide. Inmutable; la eliminación del asociado borra valores y motivo.';
comment on column public.historial_cambio_datos_perfil.valores_anteriores is
  'Valores antes del cambio, solo de los campos que cambiaron (claves: nombre, celular, correo_institucional, nomina_entidad, nomina_tipo, nomina_numero, cedula).';
comment on column public.historial_cambio_datos_perfil.valores_nuevos is
  'Valores después del cambio, mismas claves que valores_anteriores.';

-- ------------------------------------------------------------
-- A.2 admin_editar_datos_asociado: guarda antes/después
-- ------------------------------------------------------------
create or replace function public.admin_editar_datos_asociado(
  p_asociado_id uuid,
  p_nombre text,
  p_telefono text,
  p_correo_institucional text,
  p_nomina_entidad text,
  p_nomina_tipo public.tipo_cuenta_nomina,
  p_nomina_numero text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_actual  public.perfiles%rowtype;
  v_correo  text := nullif(lower(btrim(coalesce(p_correo_institucional, ''))), '');
  v_campos  text[] := '{}';
  v_sensibles text[] := '{}';
  v_antes   jsonb := '{}'::jsonb;
  v_despues jsonb := '{}'::jsonb;
  v_fecha   text := to_char(now() at time zone 'America/Bogota', 'DD/MM/YYYY');
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede editar los datos de un asociado';
  end if;
  if p_asociado_id is null or p_asociado_id = v_uid then
    raise exception 'No puedes editar tus propios datos; debe hacerlo otro administrador';
  end if;

  select * into v_actual from public.perfiles p where p.id = p_asociado_id for update;
  if not found or v_actual.rol <> 'asociado'::public.rol_usuario or v_actual.eliminado_at is not null then
    raise exception 'No encontramos al asociado';
  end if;
  if v_actual.asesor_id = v_uid then
    raise exception 'Es uno de tus clientes: otro administrador debe editar sus datos';
  end if;

  if v_correo is not null then
    if v_actual.institucion is null then
      raise exception 'El asociado no tiene institución registrada: no se puede guardar un correo institucional';
    end if;
    if split_part(v_correo, '@', 2) <> all (public.dominios_correo_institucional(v_actual.institucion)) then
      raise exception 'El correo institucional no es del dominio de su institución';
    end if;
  end if;

  if p_nombre is distinct from v_actual.nombre_completo then
    v_campos := array_append(v_campos, 'nombre');
    v_antes := v_antes || jsonb_build_object('nombre', v_actual.nombre_completo);
    v_despues := v_despues || jsonb_build_object('nombre', p_nombre);
  end if;
  if p_telefono is distinct from v_actual.telefono then
    v_campos := array_append(v_campos, 'celular');
    v_antes := v_antes || jsonb_build_object('celular', v_actual.telefono);
    v_despues := v_despues || jsonb_build_object('celular', p_telefono);
  end if;
  if v_correo is distinct from v_actual.correo_institucional then
    v_campos := array_append(v_campos, 'correo_institucional');
    v_sensibles := array_append(v_sensibles, 'tu correo institucional');
    v_antes := v_antes || jsonb_build_object('correo_institucional', v_actual.correo_institucional);
    v_despues := v_despues || jsonb_build_object('correo_institucional', v_correo);
  end if;
  if (p_nomina_entidad, p_nomina_tipo, p_nomina_numero)
     is distinct from (v_actual.nomina_entidad, v_actual.nomina_tipo, v_actual.nomina_numero) then
    v_campos := array_append(v_campos, 'nomina');
    v_sensibles := array_append(v_sensibles, 'tu cuenta de nómina');
    v_antes := v_antes || jsonb_build_object('nomina_entidad', v_actual.nomina_entidad,
                                             'nomina_tipo', v_actual.nomina_tipo,
                                             'nomina_numero', v_actual.nomina_numero);
    v_despues := v_despues || jsonb_build_object('nomina_entidad', p_nomina_entidad,
                                                 'nomina_tipo', p_nomina_tipo,
                                                 'nomina_numero', p_nomina_numero);
  end if;
  if cardinality(v_campos) = 0 then
    raise exception 'No hay cambios para guardar';
  end if;

  perform set_config('ga.editar_datos_asociado', 'si', true);
  update public.perfiles p
     set nombre_completo = p_nombre,
         telefono = p_telefono,
         correo_institucional = v_correo,
         nomina_entidad = p_nomina_entidad,
         nomina_tipo = p_nomina_tipo,
         nomina_numero = p_nomina_numero
   where p.id = p_asociado_id;
  perform set_config('ga.editar_datos_asociado', '', true);

  insert into public.historial_cambio_datos_perfil (perfil_id, actor_id, campos, valores_anteriores, valores_nuevos)
  values (p_asociado_id, v_uid, v_campos, v_antes, v_despues);

  -- RS-M2: el asociado se entera la próxima vez que entra (sin los valores nuevos).
  if cardinality(v_sensibles) > 0 then
    insert into public.avisos_asociados (titulo, mensaje, creado_por, destinatario_id)
    values (
      'Actualizamos tus datos',
      'El ' || v_fecha || ' la cooperativa actualizó ' || array_to_string(v_sensibles, ' y ') ||
        '. Si no pediste este cambio, escríbenos por WhatsApp.',
      v_uid,
      p_asociado_id
    );
  end if;

  return v_campos;
end;
$$;

-- ------------------------------------------------------------
-- A.3 admin_cambiar_cedula: guarda antes/después
-- (mismo cuerpo de 20261102000000; solo cambia el insert del historial)
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
    raise exception 'Esa cédula ya tiene cuenta u otra solicitud en curso';
  end;

  perform set_config('ga.editar_afiliacion', 'si', true);
  update public.solicitudes_afiliacion s set cedula = v_cedula where s.cedula = v_actual.cedula;
  perform set_config('ga.editar_afiliacion', '', true);

  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('cedula', v_cedula)
   where u.id = p_asociado_id;

  insert into public.historial_cambio_datos_perfil (perfil_id, actor_id, campos, motivo, valores_anteriores, valores_nuevos)
  values (p_asociado_id, v_uid, array['cedula'], v_motivo,
          jsonb_build_object('cedula', v_actual.cedula), jsonb_build_object('cedula', v_cedula));

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

-- ------------------------------------------------------------
-- B.1 Historial de fotos de afiliación
-- ------------------------------------------------------------
create table if not exists public.historial_fotos_afiliacion (
  id            bigint generated always as identity primary key,
  asociado_id   uuid not null references public.perfiles (id) on delete cascade,
  solicitud_id  uuid references public.solicitudes_afiliacion (id) on delete set null,
  campo         text not null check (campo in ('foto_cedula_frente', 'foto_cedula_reverso', 'foto_selfie')),
  ruta_anterior text,
  ruta_nueva    text not null,
  actor_id      uuid references public.perfiles (id),
  motivo        text not null check (char_length(motivo) between 5 and 300),
  created_at    timestamptz not null default now()
);
create index if not exists historial_fotos_afiliacion_asociado_idx
  on public.historial_fotos_afiliacion (asociado_id, created_at desc);
alter table public.historial_fotos_afiliacion enable row level security;
revoke all on public.historial_fotos_afiliacion from anon, authenticated;
grant select on public.historial_fotos_afiliacion to authenticated;
drop policy if exists historial_fotos_afiliacion_select_admin on public.historial_fotos_afiliacion;
create policy historial_fotos_afiliacion_select_admin on public.historial_fotos_afiliacion
  for select to authenticated using ((select public.es_admin()));
comment on table public.historial_fotos_afiliacion is
  'Cambios de las fotos de afiliación (cédula frente/reverso, selfie) hechos por un admin: ruta anterior y nueva («afiliacion-documentos/…») y motivo. Inmutable; se borra con la eliminación del asociado.';

-- ------------------------------------------------------------
-- B.2 Barrera: modo «cambiar foto» en proteger_solicitud_afiliacion
-- ------------------------------------------------------------
create or replace function public.proteger_solicitud_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edicion_admin boolean := coalesce(current_setting('ga.editar_afiliacion', true), '') = 'si' and public.es_admin();
  v_cambio_foto   boolean := coalesce(current_setting('ga.cambiar_foto_afiliacion', true), '') = 'si' and public.es_admin();
begin
  -- admin_cambiar_foto_afiliacion: solo cambian las 3 fotos; todo lo demás queda igual.
  if v_cambio_foto then
    if (new.nombre, new.nombres, new.apellidos, new.cedula, new.grado, new.institucion, new.unidad,
        new.celular, new.nequi, new.email, new.correo_institucional, new.nomina_entidad,
        new.nomina_tipo, new.nomina_numero, new.asesor_id, new.mensaje, new.acepto_datos_at,
        new.created_at, new.estado, new.revisado_por, new.fecha_revision, new.version_politica_datos)
       is distinct from
       (old.nombre, old.nombres, old.apellidos, old.cedula, old.grado, old.institucion, old.unidad,
        old.celular, old.nequi, old.email, old.correo_institucional, old.nomina_entidad,
        old.nomina_tipo, old.nomina_numero, old.asesor_id, old.mensaje, old.acepto_datos_at,
        old.created_at, old.estado, old.revisado_por, old.fecha_revision, old.version_politica_datos) then
      raise exception 'Al cambiar una foto solo pueden cambiar las fotos';
    end if;
    return new;
  end if;

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

-- ------------------------------------------------------------
-- B.3 Solicitud de afiliación vigente del asociado (la que tiene las fotos)
-- ------------------------------------------------------------
-- Misma regla que foto_carne_de_asociado: la aprobada más reciente con su cédula.
create or replace function public.afiliacion_vigente_de_asociado(p_asociado_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
    from public.perfiles p
    join public.solicitudes_afiliacion s on s.cedula = p.cedula and s.estado = 'aprobada'
   where p.id = p_asociado_id and p.eliminado_at is null
   order by s.created_at desc
   limit 1;
$$;
revoke all on function public.afiliacion_vigente_de_asociado(uuid) from public, anon, authenticated;
comment on function public.afiliacion_vigente_de_asociado(uuid) is
  'Interno: id de la solicitud de afiliación aprobada más reciente del asociado (la de sus fotos), o null.';

-- ------------------------------------------------------------
-- B.4 RPC «Cambiar foto de afiliación»
-- ------------------------------------------------------------
create or replace function public.admin_cambiar_foto_afiliacion(
  p_asociado_id uuid,
  p_campo       text,
  p_ruta        text,
  p_motivo      text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_perfil    public.perfiles%rowtype;
  v_sol       public.solicitudes_afiliacion%rowtype;
  v_sol_id    uuid;
  v_motivo    text := btrim(coalesce(p_motivo, ''));
  v_tipo      text := case p_campo
                        when 'foto_cedula_frente'  then 'frente'
                        when 'foto_cedula_reverso' then 'reverso'
                        when 'foto_selfie'         then 'selfie'
                      end;
  v_anterior  text;
  v_nueva     text := 'afiliacion-documentos/' || coalesce(p_ruta, '');
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar las fotos de un asociado';
  end if;
  if p_asociado_id is null or p_asociado_id = v_uid then
    raise exception 'No puedes cambiar tus propias fotos; debe hacerlo otro administrador';
  end if;
  if v_tipo is null then
    raise exception 'Esa foto no existe';
  end if;
  if char_length(v_motivo) not between 5 and 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;

  select * into v_perfil from public.perfiles p where p.id = p_asociado_id;
  if not found or v_perfil.rol <> 'asociado'::public.rol_usuario or v_perfil.eliminado_at is not null then
    raise exception 'No encontramos al asociado';
  end if;
  if v_perfil.asesor_id = v_uid then
    raise exception 'Es uno de tus clientes: otro administrador debe cambiar sus fotos';
  end if;

  v_sol_id := public.afiliacion_vigente_de_asociado(p_asociado_id);
  if v_sol_id is null then
    raise exception 'El asociado no tiene una afiliación aprobada con fotos';
  end if;
  select * into v_sol from public.solicitudes_afiliacion s where s.id = v_sol_id for update;

  if p_ruta is null or p_ruta !~ ('^solicitudes/' || v_sol_id::text || '/' || v_tipo || '-[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'La ruta de la foto no es válida';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'afiliacion-documentos' and o.name = p_ruta) then
    raise exception 'El archivo de la foto no se encontró';
  end if;

  v_anterior := case p_campo
                  when 'foto_cedula_frente'  then v_sol.foto_cedula_frente
                  when 'foto_cedula_reverso' then v_sol.foto_cedula_reverso
                  else v_sol.foto_selfie
                end;
  if v_anterior is not distinct from v_nueva then
    raise exception 'Esa ya es la foto actual';
  end if;

  perform set_config('ga.cambiar_foto_afiliacion', 'si', true);
  update public.solicitudes_afiliacion s
     set foto_cedula_frente  = case when p_campo = 'foto_cedula_frente'  then v_nueva else s.foto_cedula_frente end,
         foto_cedula_reverso = case when p_campo = 'foto_cedula_reverso' then v_nueva else s.foto_cedula_reverso end,
         foto_selfie         = case when p_campo = 'foto_selfie'         then v_nueva else s.foto_selfie end
   where s.id = v_sol_id;
  perform set_config('ga.cambiar_foto_afiliacion', '', true);

  insert into public.historial_fotos_afiliacion (asociado_id, solicitud_id, campo, ruta_anterior, ruta_nueva, actor_id, motivo)
  values (p_asociado_id, v_sol_id, p_campo, v_anterior, v_nueva, v_uid, v_motivo);
end;
$$;
revoke all on function public.admin_cambiar_foto_afiliacion(uuid, text, text, text) from public, anon;
grant execute on function public.admin_cambiar_foto_afiliacion(uuid, text, text, text) to authenticated;
comment on function public.admin_cambiar_foto_afiliacion(uuid, text, text, text) is
  'Solo admin (no a sí mismo ni a sus clientes): reemplaza una foto de la afiliación vigente del asociado por un archivo ya subido al prefijo de esa solicitud. La foto anterior se conserva y queda en historial_fotos_afiliacion con el motivo.';

-- ------------------------------------------------------------
-- C.1 Bucket de documentos del proceso
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('procesos-documentos', 'procesos-documentos', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Ni política de storage.objects ni de storage.buckets: solo service_role.

-- ------------------------------------------------------------
-- C.2 Tabla de documentos
-- ------------------------------------------------------------
create table if not exists public.documentos_proceso (
  id              uuid primary key default gen_random_uuid(),
  asociado_id     uuid not null references public.perfiles (id) on delete cascade,
  nombre          text not null check (char_length(btrim(nombre)) between 3 and 120),
  ruta            text not null unique,
  tamano_bytes    integer not null check (tamano_bytes > 0 and tamano_bytes <= 10485760),
  subido_por      uuid references public.perfiles (id),
  created_at      timestamptz not null default now(),
  quitado_at      timestamptz,
  quitado_por     uuid references public.perfiles (id),
  motivo_quitado  text check (motivo_quitado is null or char_length(motivo_quitado) between 5 and 300),
  constraint documentos_proceso_ruta_chk check (ruta ~ ('^' || asociado_id::text || '/[0-9a-f-]{36}\.pdf$')),
  constraint documentos_proceso_quitado_chk check ((quitado_at is null) = (motivo_quitado is null))
);
create index if not exists documentos_proceso_asociado_idx
  on public.documentos_proceso (asociado_id, created_at desc);
alter table public.documentos_proceso enable row level security;
revoke all on public.documentos_proceso from anon, authenticated;
grant select (id, asociado_id, nombre, tamano_bytes, subido_por, created_at, quitado_at, quitado_por, motivo_quitado)
  on public.documentos_proceso to authenticated;
drop policy if exists documentos_proceso_select_admin on public.documentos_proceso;
create policy documentos_proceso_select_admin on public.documentos_proceso
  for select to authenticated using ((select public.es_admin()));
comment on table public.documentos_proceso is
  'PDF del proceso ejecutivo de cada asociado (bucket privado procesos-documentos). Solo admin: los lista por RLS, los sube y quita por RPC; la ruta no se concede (el servidor firma la descarga con service role).';

-- ------------------------------------------------------------
-- C.3 RPC «Subir documento del proceso»
-- ------------------------------------------------------------
create or replace function public.admin_registrar_documento_proceso(p_asociado_id uuid, p_ruta text, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_tamano bigint;
  v_id     uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede subir documentos del proceso';
  end if;
  if p_asociado_id is null or p_asociado_id = v_uid then
    raise exception 'No puedes subir documentos a tu propio proceso; debe hacerlo otro administrador';
  end if;
  if char_length(v_nombre) not between 3 and 120 then
    raise exception 'El nombre del documento debe tener entre 3 y 120 caracteres';
  end if;
  if not exists (
    select 1 from public.perfiles p
     where p.id = p_asociado_id and p.rol = 'asociado'::public.rol_usuario and p.eliminado_at is null
  ) then
    raise exception 'No encontramos al asociado';
  end if;
  if p_ruta is null or p_ruta !~ ('^' || p_asociado_id::text || '/[0-9a-f-]{36}\.pdf$') then
    raise exception 'La ruta del documento no es válida';
  end if;
  select (o.metadata ->> 'size')::bigint into v_tamano
    from storage.objects o where o.bucket_id = 'procesos-documentos' and o.name = p_ruta;
  if not found then
    raise exception 'El archivo del documento no se encontró';
  end if;
  if coalesce(v_tamano, 0) <= 0 or v_tamano > 10485760 then
    raise exception 'El documento debe pesar máximo 10 MB';
  end if;

  insert into public.documentos_proceso (asociado_id, nombre, ruta, tamano_bytes, subido_por)
  values (p_asociado_id, v_nombre, p_ruta, v_tamano, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_registrar_documento_proceso(uuid, text, text) from public, anon;
grant execute on function public.admin_registrar_documento_proceso(uuid, text, text) to authenticated;
comment on function public.admin_registrar_documento_proceso(uuid, text, text) is
  'Solo admin (no a sí mismo): liga un PDF ya subido a procesos-documentos («<asociado>/<uuid>.pdf») al proceso del asociado. Devuelve el id.';

-- ------------------------------------------------------------
-- C.4 RPC «Quitar documento del proceso»
-- ------------------------------------------------------------
create or replace function public.admin_quitar_documento_proceso(p_documento_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_doc    public.documentos_proceso%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede quitar documentos del proceso';
  end if;
  if char_length(v_motivo) not between 5 and 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  select * into v_doc from public.documentos_proceso d where d.id = p_documento_id for update;
  if not found or v_doc.quitado_at is not null then
    raise exception 'Ese documento ya no está en el proceso';
  end if;
  if v_doc.asociado_id = v_uid then
    raise exception 'No puedes quitar documentos de tu propio proceso; debe hacerlo otro administrador';
  end if;

  update public.documentos_proceso d
     set quitado_at = now(), quitado_por = v_uid, motivo_quitado = v_motivo
   where d.id = p_documento_id;
  -- El servidor borra el archivo con esta ruta.
  return v_doc.ruta;
end;
$$;
revoke all on function public.admin_quitar_documento_proceso(uuid, text) from public, anon;
grant execute on function public.admin_quitar_documento_proceso(uuid, text) to authenticated;
comment on function public.admin_quitar_documento_proceso(uuid, text) is
  'Solo admin: quita un PDF del proceso (queda la fila con quién, cuándo y motivo) y devuelve la ruta para que el servidor borre el archivo.';

-- ------------------------------------------------------------
-- D. «Cambios» de los asociados (solo admin)
-- ------------------------------------------------------------
create or replace function public.admin_cambios_asociados(
  p_asociado uuid    default null,
  p_busqueda text    default null,
  p_desde    date    default null,
  p_hasta    date    default null,
  p_limite   integer default 25,
  p_pagina   integer default 1)
returns table (
  id            text,
  cuando        timestamptz,
  asociado_id   uuid,
  asociado_nombre text,
  actor_nombre  text,
  actor_rol     text,
  tipo          text,
  detalle       jsonb,
  motivo        text,
  total         bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite   integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_pagina   integer := greatest(coalesce(p_pagina, 1), 1);
  v_busqueda text := nullif(lower(btrim(coalesce(p_busqueda, ''))), '');
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede ver los cambios de los asociados' using errcode = '42501';
  end if;

  return query
  with ev as (
    select 'datos-' || h.id::text as id, h.created_at as cuando, h.perfil_id as asociado, h.actor_id as actor,
           case when h.campos = array['cedula'] then 'cedula' else 'datos' end as tipo,
           jsonb_build_object('campos', to_jsonb(h.campos), 'antes', h.valores_anteriores, 'despues', h.valores_nuevos) as detalle,
           h.motivo
      from public.historial_cambio_datos_perfil h
    union all
    select 'foto-' || h.id::text, h.created_at, h.asociado_id, h.actor_id, 'foto_afiliacion',
           jsonb_build_object('campo', h.campo, 'ruta_anterior', h.ruta_anterior, 'ruta_nueva', h.ruta_nueva),
           h.motivo
      from public.historial_fotos_afiliacion h
    union all
    select 'carne-' || h.id::text, h.created_at, h.asociado_id, h.asociado_id, 'foto_carne',
           jsonb_build_object('accion', h.accion), null
      from public.historial_foto_carne h
    union all
    select 'correo-' || h.id::text, h.created_at, h.perfil_id, h.actor_id, 'correo_ingreso',
           jsonb_build_object('origen', h.origen), h.motivo
      from public.historial_cambio_correo_ingreso h
    union all
    select 'asesor-' || h.id::text, h.created_at, h.perfil_id, h.actor_id, 'asesor',
           jsonb_build_object(
             'anterior', (select n.nombre_completo from public.perfiles n where n.id = h.asesor_anterior_id),
             'nuevo',    (select n.nombre_completo from public.perfiles n where n.id = h.asesor_nuevo_id)),
           null
      from public.historial_cambio_asesor h
    union all
    select 'estado-' || h.id::text, h.created_at, h.asociado_id, h.admin_id, 'estado',
           jsonb_build_object('activo', h.activo_nuevo), h.motivo
      from public.historial_estado_asociado h
    union all
    select 'proceso-' || h.id::text, h.created_at, h.asociado_id, coalesce(h.admin_id, h.asesor_id), 'proceso',
           jsonb_build_object('anterior', h.estado_anterior, 'nuevo', h.estado_nuevo, 'fecha_inicio_embargo', h.fecha_inicio_embargo),
           null
      from public.historial_proceso_ejecutivo h
    union all
    select 'doc-' || d.id::text, d.created_at, d.asociado_id, d.subido_por, 'documento_subido',
           jsonb_build_object('nombre', d.nombre, 'tamano', d.tamano_bytes), null
      from public.documentos_proceso d
    union all
    select 'docq-' || d.id::text, d.quitado_at, d.asociado_id, d.quitado_por, 'documento_quitado',
           jsonb_build_object('nombre', d.nombre), d.motivo_quitado
      from public.documentos_proceso d
     where d.quitado_at is not null
  )
  select e.id, e.cuando, e.asociado, a.nombre_completo::text, p.nombre_completo::text, p.rol::text,
         e.tipo, e.detalle, e.motivo, count(*) over ()
    from ev e
    join public.perfiles a on a.id = e.asociado and a.rol = 'asociado'::public.rol_usuario
    left join public.perfiles p on p.id = e.actor
   where (p_asociado is null or e.asociado = p_asociado)
     and (v_busqueda is null
          or strpos(lower(a.nombre_completo), v_busqueda) > 0
          or a.cedula = v_busqueda)
     and (p_desde is null or (e.cuando at time zone 'America/Bogota')::date >= p_desde)
     and (p_hasta is null or (e.cuando at time zone 'America/Bogota')::date <= p_hasta)
   order by e.cuando desc, e.id
   limit v_limite offset (v_pagina - 1) * v_limite;
end;
$$;
revoke all on function public.admin_cambios_asociados(uuid, text, date, date, integer, integer) from public, anon;
grant execute on function public.admin_cambios_asociados(uuid, text, date, date, integer, integer) to authenticated;
comment on function public.admin_cambios_asociados(uuid, text, date, date, integer, integer) is
  'Solo admin: cambios de los asociados (datos y cédula con antes/después, fotos de afiliación y del carné, correo de ingreso, asesor, baja/reactivación, proceso ejecutivo y sus documentos), lo más reciente primero, con filtros por asociado, búsqueda (nombre o cédula exacta) y fechas, y el total para paginar.';

-- ------------------------------------------------------------
-- E. Eliminación del asociado: también fotos del historial, PDF y valores
-- (mismo cuerpo de 20261003300000; cambian v_archivos y la limpieza de filas)
-- ------------------------------------------------------------
create or replace function public.admin_confirmar_eliminacion(p_admin_id uuid, p_solicitud_id uuid, p_codigo_hash text)
returns table (resultado text, intentos_restantes integer, archivos text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol      public.solicitudes_eliminacion_asociado%rowtype;
  v_perfil   public.perfiles%rowtype;
  v_archivos text[];
begin
  select * into v_sol from public.solicitudes_eliminacion_asociado s
   where s.id = p_solicitud_id for update;
  if not found or v_sol.admin_id is distinct from p_admin_id then
    return query select 'no_existe'::text, 0, null::text[];
    return;
  end if;

  if v_sol.estado = 'ejecutada' and v_sol.limpieza_pendiente then
    return query select 'ok'::text, 0, coalesce(v_sol.archivos, '{}'::text[]);
    return;
  end if;
  if v_sol.estado <> 'pendiente' then
    return query select (case when v_sol.estado = 'bloqueada' then 'bloqueada'
                              when v_sol.estado = 'vencida' then 'vencida'
                              else 'no_existe' end)::text, 0, null::text[];
    return;
  end if;
  if v_sol.expira_at < now() then
    update public.solicitudes_eliminacion_asociado s
       set estado = 'vencida', resuelta_at = now(), codigo_hash = null where s.id = v_sol.id;
    return query select 'vencida'::text, 0, null::text[];
    return;
  end if;
  if v_sol.intentos >= 3 then
    update public.solicitudes_eliminacion_asociado s
       set estado = 'bloqueada', resuelta_at = now(), codigo_hash = null where s.id = v_sol.id;
    return query select 'bloqueada'::text, 0, null::text[];
    return;
  end if;

  if p_codigo_hash is distinct from v_sol.codigo_hash then
    if v_sol.intentos + 1 >= 3 then
      update public.solicitudes_eliminacion_asociado s
         set intentos = 3, estado = 'bloqueada', resuelta_at = now(), codigo_hash = null where s.id = v_sol.id;
      return query select 'bloqueada'::text, 0, null::text[];
    else
      update public.solicitudes_eliminacion_asociado s
         set intentos = s.intentos + 1 where s.id = v_sol.id;
      return query select 'codigo_incorrecto'::text, 3 - (v_sol.intentos + 1), null::text[];
    end if;
    return;
  end if;

  -- Código correcto: se vuelven a comprobar las reglas (pudo cambiar algo en 10 minutos).
  perform public.validar_eliminacion_asociado(p_admin_id, v_sol.asociado_id);
  select * into v_perfil from public.perfiles p where p.id = v_sol.asociado_id for update;

  -- Archivos de Storage a borrar ya («bucket/ruta»): fotos de afiliación (las vigentes y las
  -- anteriores del historial), foto del carné y PDF del proceso. Los comprobantes de
  -- desembolso NO van aquí: se guardan 30 días (más abajo).
  select coalesce(array_agg(distinct r.archivo), '{}'::text[]) into v_archivos
    from (
      select 'afiliacion-documentos/' || regexp_replace(f.ruta, '^afiliacion-documentos/', '') as archivo
        from public.solicitudes_afiliacion sa
        cross join lateral unnest(array[sa.foto_cedula_frente, sa.foto_cedula_reverso, sa.foto_selfie]) as f(ruta)
       where sa.cedula = v_perfil.cedula and f.ruta is not null
      union all
      select 'afiliacion-documentos/' || regexp_replace(f.ruta, '^afiliacion-documentos/', '')
        from public.historial_fotos_afiliacion hf
        cross join lateral unnest(array[hf.ruta_anterior, hf.ruta_nueva]) as f(ruta)
       where hf.asociado_id = v_perfil.id and f.ruta is not null
      union all
      select 'fotos-carne/' || fc.ruta
        from public.fotos_carne fc
       where fc.asociado_id = v_perfil.id
      union all
      select 'procesos-documentos/' || d.ruta
        from public.documentos_proceso d
       where d.asociado_id = v_perfil.id and d.quitado_at is null
    ) r;

  -- Datos personales fuera.
  delete from public.historial_fotos_afiliacion hf where hf.asociado_id = v_perfil.id;
  delete from public.documentos_proceso d where d.asociado_id = v_perfil.id;
  update public.historial_cambio_datos_perfil h
     set valores_anteriores = null, valores_nuevos = null, motivo = null
   where h.perfil_id = v_perfil.id;
  delete from public.solicitudes_afiliacion sa where sa.cedula = v_perfil.cedula;
  delete from public.solicitudes_recuperacion_acceso r where r.perfil_id = v_perfil.id;
  delete from public.carne_tokens t where t.asociado_id = v_perfil.id;
  delete from public.fotos_carne fc where fc.asociado_id = v_perfil.id;
  delete from public.historial_foto_carne hf where hf.asociado_id = v_perfil.id;
  update public.historial_cambio_correo_ingreso h
     set motivo = 'Registro anonimizado'
   where h.perfil_id = v_perfil.id;
  -- Comprobantes de desembolso: se conservan 30 días, solo visibles al admin; luego los borra la tarea programada.
  update public.solicitudes_credito sc
     set comprobante_borrar_at = now() + interval '30 days'
   where sc.asociado_id = v_perfil.id and sc.comprobante_path is not null;

  update public.perfiles p
     set nombre_completo = 'Asociado eliminado',
         cedula = 'ELIMINADO-' || substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12),
         telefono = null,
         correo_institucional = null,
         nomina_entidad = null,
         nomina_tipo = null,
         nomina_numero = null,
         avisar_apertura_sorteo = false,
         atiende_asociados = false,
         activo = false,
         eliminado_at = now()
   where p.id = v_perfil.id;

  insert into public.eliminaciones_asociados (asociado_id, solicitud_id, admin_id, motivo)
  values (v_perfil.id, v_sol.id, p_admin_id, v_sol.motivo);

  update public.solicitudes_eliminacion_asociado s
     set estado = 'ejecutada', resuelta_at = now(), codigo_hash = null,
         intentos = s.intentos + 1, limpieza_pendiente = true, archivos = v_archivos
   where s.id = v_sol.id;

  return query select 'ok'::text, 0, v_archivos;
end;
$$;
