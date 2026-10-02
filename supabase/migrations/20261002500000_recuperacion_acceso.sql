-- ============================================================
-- ga-funcionalidad-botones, 2026-10-02 — Recuperación de acceso (contrato, fase 2).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- El ingreso es cédula + código al correo. Si el asociado perdió el acceso a
-- ese correo (o lo cambió), no puede ingresar. Esta migración agrega:
--
--  1. solicitudes_recuperacion_acceso: la pide una persona SIN sesión desde
--     /ingresar/recuperar (cédula, correo nuevo, celular, motivo). No cambia
--     nada por sí sola: el admin verifica la identidad por fuera y, si
--     corresponde, cambia el correo. Inserción SOLO por
--     crear_solicitud_recuperacion() (service_role): el servidor responde
--     igual exista o no la cédula (S-06), así que aquí también se calla.
--  2. historial_cambio_correo_ingreso: quién cambió el correo de ingreso de
--     quién, cuándo y por qué (sin guardar los correos: son datos personales
--     y viven solo en auth.users).
--  3. Funciones:
--       crear_solicitud_recuperacion()      → solo service_role
--       admin_registrar_cambio_correo()     → admin (valida es_admin)
--       admin_rechazar_recuperacion()       → admin (valida es_admin)
--       admin_validar_cambio_correo()       → admin (todas las reglas, ANTES de tocar Auth)
--       cerrar_sesiones_usuario()           → solo service_role (SEC-REC-04)
--  4. Revisión de seguridad (SEC-REC-02/03): historial_cambio_asesor (quién cambió
--     el asesor de quién) y un trigger sobre auth.users que deja huella de TODO
--     cambio de correo, aunque se haga por la API de GoTrue sin pasar por la app.
--
-- El cambio real del correo (auth.users) lo hace el servidor con service role
-- (auth.admin.updateUserById); la base NO toca auth.users. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- Solicitudes de recuperación
-- ------------------------------------------------------------
create table if not exists public.solicitudes_recuperacion_acceso (
  id                 uuid primary key default gen_random_uuid(),
  perfil_id          uuid not null references public.perfiles (id) on delete cascade,
  cedula             text not null check (cedula ~ '^[0-9]{6,10}$'),
  correo_nuevo       text not null check (char_length(correo_nuevo) between 5 and 254 and position('@' in correo_nuevo) > 1),
  celular            text not null check (celular ~ '^3[0-9]{9}$'),
  -- Ayuda para el admin: el celular escrito es el que la cooperativa tiene en el perfil.
  celular_coincide   boolean not null default false,
  motivo             text not null check (char_length(btrim(motivo)) between 5 and 300),
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'atendida', 'rechazada')),
  created_at         timestamptz not null default now(),
  resuelta_por       uuid references public.perfiles (id) on delete set null,
  resuelta_at        timestamptz,
  motivo_resolucion  text check (motivo_resolucion is null or char_length(motivo_resolucion) <= 300),
  constraint recuperacion_resolucion_chk check (
    (estado = 'pendiente' and resuelta_at is null and resuelta_por is null)
    or (estado <> 'pendiente' and resuelta_at is not null)
  )
);

comment on table public.solicitudes_recuperacion_acceso is
  'Pedidos públicos de «ya no tengo acceso a mi correo». Solo se crean con crear_solicitud_recuperacion() (service_role); solo las lee el admin. No cambian nada por sí solas.';

-- Una sola pendiente por persona: repetir el formulario no llena la bandeja.
create unique index if not exists ux_recuperacion_pendiente_por_perfil
  on public.solicitudes_recuperacion_acceso (perfil_id)
  where estado = 'pendiente';
create index if not exists ix_recuperacion_bandeja
  on public.solicitudes_recuperacion_acceso (estado, created_at desc);
create index if not exists ix_recuperacion_resuelta_por
  on public.solicitudes_recuperacion_acceso (resuelta_por);

alter table public.solicitudes_recuperacion_acceso enable row level security;
revoke all on public.solicitudes_recuperacion_acceso from anon, authenticated;
grant select on public.solicitudes_recuperacion_acceso to authenticated;

drop policy if exists "recuperacion_select_admin" on public.solicitudes_recuperacion_acceso;
create policy "recuperacion_select_admin" on public.solicitudes_recuperacion_acceso
  for select to authenticated
  using ((select public.es_admin()));
-- Sin políticas de insert/update/delete: solo entran y cambian por las funciones.

-- ------------------------------------------------------------
-- Historial de cambios del correo de ingreso
-- ------------------------------------------------------------
create table if not exists public.historial_cambio_correo_ingreso (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.perfiles (id) on delete cascade,
  actor_id     uuid references public.perfiles (id) on delete set null,
  origen       text not null check (origen in ('admin', 'asociado', 'auth')),
  motivo       text not null check (char_length(motivo) between 5 and 300),
  solicitud_id uuid references public.solicitudes_recuperacion_acceso (id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.historial_cambio_correo_ingreso is
  'Quién cambió el correo de ingreso de un asociado, cuándo y por qué. No guarda los correos (viven solo en auth.users). Solo lo escriben funciones; solo lo lee el admin.';

create index if not exists ix_historial_correo_perfil
  on public.historial_cambio_correo_ingreso (perfil_id, created_at desc);
create index if not exists ix_historial_correo_actor
  on public.historial_cambio_correo_ingreso (actor_id);
create index if not exists ix_historial_correo_solicitud
  on public.historial_cambio_correo_ingreso (solicitud_id);

alter table public.historial_cambio_correo_ingreso enable row level security;
revoke all on public.historial_cambio_correo_ingreso from anon, authenticated;
grant select on public.historial_cambio_correo_ingreso to authenticated;

drop policy if exists "historial_correo_select_admin" on public.historial_cambio_correo_ingreso;
create policy "historial_correo_select_admin" on public.historial_cambio_correo_ingreso
  for select to authenticated
  using ((select public.es_admin()));

-- ------------------------------------------------------------
-- 1) Crear la solicitud (solo el servidor, con service role)
--    Devuelve el id, o null si no se creó (cédula inexistente, no es
--    asociado, cuenta inactiva, correo igual al actual o ya hay una pendiente).
--    El servidor IGNORA el resultado para responder siempre lo mismo.
-- ------------------------------------------------------------
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
  if lower(btrim(p_correo_nuevo)) = lower(coalesce(v_actual, '')) then
    return null;  -- pide el mismo correo que ya tiene: nada que revisar
  end if;

  insert into public.solicitudes_recuperacion_acceso
    (perfil_id, cedula, correo_nuevo, celular, celular_coincide, motivo)
  values (
    v_perfil.id,
    v_perfil.cedula,
    lower(btrim(p_correo_nuevo)),
    p_celular,
    coalesce(regexp_replace(coalesce(v_perfil.telefono, ''), '[^0-9]', '', 'g') = p_celular, false),
    btrim(p_motivo)
  )
  on conflict (perfil_id) where estado = 'pendiente' do nothing
  returning id into v_id;

  return v_id;  -- null si ya había una pendiente
end;
$$;
revoke all on function public.crear_solicitud_recuperacion(text, text, text, text) from public, anon, authenticated;
grant execute on function public.crear_solicitud_recuperacion(text, text, text, text) to service_role;
comment on function public.crear_solicitud_recuperacion(text, text, text, text) is
  'Registra un pedido de recuperación de acceso si la cédula es de un asociado activo. Solo service_role. El servidor responde igual exista o no la cédula (anti-enumeración).';

-- ------------------------------------------------------------
-- 2a) Quién cambió el asesor de quién (SEC-REC-03: un admin no puede
--     reasignar el asesor de alguien y enseguida cambiarle el correo).
-- ------------------------------------------------------------
create table if not exists public.historial_cambio_asesor (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles (id) on delete cascade,
  actor_id   uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.historial_cambio_asesor is
  'Cambios de perfiles.asesor_id (quién y cuándo). Lo escribe un trigger; solo lo lee el admin. La recuperación de acceso lo usa para bloquear cambios de correo de quien reasignó el asesor hace menos de 24 h.';
create index if not exists ix_historial_asesor_perfil on public.historial_cambio_asesor (perfil_id, created_at desc);
create index if not exists ix_historial_asesor_actor on public.historial_cambio_asesor (actor_id);
alter table public.historial_cambio_asesor enable row level security;
revoke all on public.historial_cambio_asesor from anon, authenticated;
grant select on public.historial_cambio_asesor to authenticated;
drop policy if exists "historial_asesor_select_admin" on public.historial_cambio_asesor;
create policy "historial_asesor_select_admin" on public.historial_cambio_asesor
  for select to authenticated
  using ((select public.es_admin()));

create or replace function public.registrar_cambio_asesor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asesor_id is distinct from old.asesor_id then
    insert into public.historial_cambio_asesor (perfil_id, actor_id)
    values (new.id, (select p.id from public.perfiles p where p.id = auth.uid()));
  end if;
  return new;
end;
$$;
revoke all on function public.registrar_cambio_asesor() from public, anon, authenticated;
drop trigger if exists tr_registrar_cambio_asesor on public.perfiles;
create trigger tr_registrar_cambio_asesor
  after update of asesor_id on public.perfiles
  for each row execute function public.registrar_cambio_asesor();

-- ------------------------------------------------------------
-- 2b) Validación del cambio de correo por un admin (SEC-REC-03).
--     El servidor la llama ANTES de tocar auth.users; admin_registrar_cambio_correo
--     la repite. Devuelve el id de la solicitud pendiente que se atenderá.
--     Exige: admin, motivo, no sobre sí mismo, asociado, no su cliente (RS-01),
--     que el admin no haya cambiado el asesor de esa persona en 24 h y que haya
--     una solicitud de recuperación PENDIENTE.
-- ------------------------------------------------------------
create or replace function public.admin_validar_cambio_correo(
  p_asociado_id uuid,
  p_motivo      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_sol    uuid;
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
  -- RS-01: quien atiende al asociado no puede cambiarle el correo (podría
  -- quedarse con su cuenta); debe hacerlo otro administrador.
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

  select s.id into v_sol
    from public.solicitudes_recuperacion_acceso s
   where s.perfil_id = p_asociado_id and s.estado = 'pendiente'
   limit 1;
  if v_sol is null then
    raise exception 'No hay una solicitud de recuperación pendiente de esta persona';
  end if;
  return v_sol;
end;
$$;
revoke all on function public.admin_validar_cambio_correo(uuid, text) from public, anon;
grant execute on function public.admin_validar_cambio_correo(uuid, text) to authenticated;
comment on function public.admin_validar_cambio_correo(uuid, text) is
  'Solo admin: valida (sin cambiar nada) que se pueda cambiar el correo de ingreso: motivo, no a sí mismo, asociado, no su cliente, sin cambio de asesor propio en 24 h y con solicitud de recuperación pendiente. Devuelve el id de la solicitud.';

-- ------------------------------------------------------------
-- 2c) El admin cambió el correo de ingreso (después de actualizar auth.users)
--     Deja el historial y cierra la solicitud pendiente de esa persona.
--     Si el trigger de auth.users ya dejó una fila 'auth' en los últimos 2
--     minutos, la completa en vez de duplicarla.
-- ------------------------------------------------------------
create or replace function public.admin_registrar_cambio_correo(
  p_asociado_id uuid,
  p_motivo      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_sol    uuid;
  v_id     uuid;
begin
  v_sol := public.admin_validar_cambio_correo(p_asociado_id, v_motivo);

  update public.solicitudes_recuperacion_acceso
     set estado = 'atendida',
         resuelta_por = auth.uid(),
         resuelta_at = now(),
         motivo_resolucion = v_motivo
   where id = v_sol and estado = 'pendiente';

  update public.historial_cambio_correo_ingreso
     set actor_id = auth.uid(), origen = 'admin', motivo = v_motivo, solicitud_id = v_sol
   where id = (
     select h.id from public.historial_cambio_correo_ingreso h
      where h.perfil_id = p_asociado_id and h.origen = 'auth'
        and h.created_at > now() - interval '2 minutes'
      order by h.created_at desc limit 1
   )
  returning id into v_id;

  if v_id is null then
    insert into public.historial_cambio_correo_ingreso (perfil_id, actor_id, origen, motivo, solicitud_id)
    values (p_asociado_id, auth.uid(), 'admin', v_motivo, v_sol)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
revoke all on function public.admin_registrar_cambio_correo(uuid, text) from public, anon;
grant execute on function public.admin_registrar_cambio_correo(uuid, text) to authenticated;
comment on function public.admin_registrar_cambio_correo(uuid, text) is
  'Solo admin (valida con admin_validar_cambio_correo): deja en el historial el cambio del correo de ingreso y cierra la solicitud de recuperación pendiente de esa persona. El cambio en auth.users lo hace el servidor.';

-- ------------------------------------------------------------
-- 2d) Huella de TODO cambio de correo en auth.users (SEC-REC-02): aunque se
--     haga directo contra GoTrue (sesión robada), queda registrado cuándo.
--     No guarda los correos. La app lo completa con actor y motivo.
-- ------------------------------------------------------------
create or replace function public.registrar_cambio_correo_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     and exists (select 1 from public.perfiles p where p.id = new.id) then
    insert into public.historial_cambio_correo_ingreso (perfil_id, actor_id, origen, motivo)
    values (new.id, null, 'auth', 'Cambio de correo detectado en Auth (sin pasar por la app)');
  end if;
  return new;
end;
$$;
revoke all on function public.registrar_cambio_correo_auth() from public, anon, authenticated;
drop trigger if exists tr_registrar_cambio_correo_auth on auth.users;
create trigger tr_registrar_cambio_correo_auth
  after update of email on auth.users
  for each row execute function public.registrar_cambio_correo_auth();

-- ------------------------------------------------------------
-- 3) El admin rechaza la solicitud (no cambia ningún correo)
-- ------------------------------------------------------------
create or replace function public.admin_rechazar_recuperacion(
  p_solicitud_id uuid,
  p_motivo       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede rechazar solicitudes de recuperación';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;

  update public.solicitudes_recuperacion_acceso
     set estado = 'rechazada',
         resuelta_por = auth.uid(),
         resuelta_at = now(),
         motivo_resolucion = v_motivo
   where id = p_solicitud_id
     and estado = 'pendiente';

  if not found then
    raise exception 'La solicitud no existe o ya fue resuelta';
  end if;
end;
$$;
revoke all on function public.admin_rechazar_recuperacion(uuid, text) from public, anon;
grant execute on function public.admin_rechazar_recuperacion(uuid, text) to authenticated;
comment on function public.admin_rechazar_recuperacion(uuid, text) is
  'Solo admin (lo revisa la función): rechaza una solicitud de recuperación pendiente con motivo (5 a 300).';

-- ------------------------------------------------------------
-- 5) Cerrar todas las sesiones de un usuario (SEC-REC-04): tras cambiarle el
--    correo, un intruso con la sesión del correo viejo queda fuera. Borra las
--    sesiones y los refresh tokens; un access token ya emitido vale hasta que
--    vence (1 h por defecto). Solo service_role.
-- ------------------------------------------------------------
create or replace function public.cerrar_sesiones_usuario(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.refresh_tokens where user_id = p_user_id::text;
  delete from auth.sessions where user_id = p_user_id;
end;
$$;
revoke all on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;
comment on function public.cerrar_sesiones_usuario(uuid) is
  'Borra todas las sesiones y refresh tokens de un usuario (auth.sessions / auth.refresh_tokens). Solo service_role.';
