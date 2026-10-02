-- ============================================================
-- ga-funcionalidad-botones, 2026-10-02 — pedidos de Sebas (reunión 1-oct).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
--  A. Comprobante de desembolso
--     * Bucket PRIVADO `comprobantes-desembolso` (5 MB; JPG/PNG/WEBP/PDF).
--       Sin políticas en storage.objects: nadie lo lee ni escribe con la API
--       de usuario. El servidor sube/firma con service role DESPUÉS de comprobar
--       al admin (o, para el asociado, que la solicitud es suya).
--     * solicitudes_credito.comprobante_path / comprobante_subido_at /
--       comprobante_subido_por. El asociado solo puede leer comprobante_subido_at
--       (saber SI hay comprobante); la ruta no se concede.
--     * admin_registrar_comprobante(): admin, solo si ya hay desembolso, no en su
--       propio crédito, la ruta debe ser de esa solicitud y existir en el bucket.
--       Deja historial (subido / reemplazado) y devuelve la ruta anterior para
--       que el servidor borre el archivo viejo. No acepta créditos de un asociado
--       ya eliminado.
--     * solicitudes_credito.comprobante_borrar_at: fecha de borrado programado. La
--       pone la eliminación definitiva (eliminado_at + 30 días); mientras tanto el
--       comprobante sigue en Storage, accesible SOLO al admin (el asociado ya no existe).
--     * Tarea programada (app/api/cron/limpiar-fotos): comprobantes_vencidos() +
--       liberar_comprobantes() borran los vencidos; comprobantes_huerfanos() lista los
--       archivos subidos y nunca ligados con más de 24 h. Todas SOLO service_role.
--
--  B. Eliminar definitivamente = ANONIMIZAR a un asociado (conserva la contabilidad)
--     * perfiles.eliminado_at. La fila de perfiles se queda (créditos, pagos,
--       comisiones e historial siguen ligados a ella) pero sin datos personales:
--       nombre «Asociado eliminado», cédula marcador único «ELIMINADO-xxxxxxxxxxxx»,
--       sin celular, correo institucional ni cuenta de nómina.
--     * Se borran: su afiliación (solicitudes_afiliacion con su cédula), sus
--       solicitudes de recuperación de acceso, su token de carné y (por el servidor)
--       las fotos de Storage y el usuario de Auth. Los COMPROBANTES DE DESEMBOLSO no se
--       borran de inmediato: se guardan 30 días (comprobante_borrar_at) y la tarea
--       programada los borra al vencer (decisión de Sebas, 2-oct).
--     * perfiles.id ya NO referencia a auth.users (si no, borrar el usuario de Auth
--       arrastraría el perfil y sus cifras). La cascada se conserva con el trigger
--       tr_perfil_al_borrar_usuario: borrar un usuario de Auth sigue borrando su
--       perfil, salvo si el perfil está eliminado (anonimizado).
--     * Confirmación por código al correo del admin que lo pide (6 dígitos, 10 min,
--       3 intentos). Las 3 funciones son SOLO service_role: el servidor valida al
--       admin y manda el correo; un admin no puede saltarse el código llamando a
--       la RPC desde el navegador.
--     * eliminaciones_asociados: log inmutable (quién, cuándo, motivo; sin datos
--       personales).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- A.1 Bucket privado de comprobantes
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-desembolso',
  'comprobantes-desembolso',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Ni política de storage.objects ni de storage.buckets: solo service_role.

-- ------------------------------------------------------------
-- A.2 Columnas en solicitudes_credito
-- ------------------------------------------------------------
alter table public.solicitudes_credito
  add column if not exists comprobante_path        text,
  add column if not exists comprobante_subido_at   timestamptz,
  add column if not exists comprobante_subido_por  uuid references public.perfiles (id),
  add column if not exists comprobante_borrar_at   timestamptz;

comment on column public.solicitudes_credito.comprobante_borrar_at is
  'Borrado programado del comprobante (eliminación definitiva del asociado + 30 días). La tarea programada lo borra de Storage y limpia la referencia al vencer.';

comment on column public.solicitudes_credito.comprobante_path is
  'Ruta en el bucket comprobantes-desembolso («<solicitud>/<uuid>.<ext>»). No se concede a authenticated: el servidor la lee con service role.';
comment on column public.solicitudes_credito.comprobante_subido_at is
  'Cuándo se subió (o reemplazó) el comprobante. El asociado lo lee para saber si hay comprobante.';

create index if not exists ix_solicitudes_comprobante_subido_por
  on public.solicitudes_credito (comprobante_subido_por) where comprobante_subido_por is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_comprobante_coherente_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_comprobante_coherente_chk
      check (
        (comprobante_path is null and comprobante_subido_at is null)
        or (comprobante_path is not null
            and comprobante_subido_at is not null
            and fecha_desembolso is not null
            and comprobante_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'))
      );
  end if;
end $$;

grant select (comprobante_subido_at, comprobante_borrar_at) on public.solicitudes_credito to authenticated;

create index if not exists ix_solicitudes_comprobante_borrar_at
  on public.solicitudes_credito (comprobante_borrar_at) where comprobante_borrar_at is not null;

-- ------------------------------------------------------------
-- A.3 RPC del admin: registrar / reemplazar el comprobante
--     Devuelve la ruta ANTERIOR (null si no había) para borrarla de Storage.
-- ------------------------------------------------------------
create or replace function public.admin_registrar_comprobante(p_solicitud_id uuid, p_ruta text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes_credito%rowtype;
  v_anterior text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede subir comprobantes';
  end if;
  if p_solicitud_id is null or p_ruta is null then
    raise exception 'Faltan datos del comprobante';
  end if;

  select * into v_sol from public.solicitudes_credito s where s.id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe';
  end if;
  if v_sol.fecha_desembolso is null then
    raise exception 'Primero marca el desembolso de este crédito';
  end if;
  if v_sol.asociado_id = auth.uid() then
    raise exception 'No puede subir el comprobante de su propio crédito; debe hacerlo otro administrador';
  end if;
  if exists (select 1 from public.perfiles pe where pe.id = v_sol.asociado_id and pe.eliminado_at is not null) then
    raise exception 'Este asociado ya fue eliminado; su comprobante ya no se puede cambiar';
  end if;
  if p_ruta !~ ('^' || p_solicitud_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') then
    raise exception 'La ruta del comprobante no es válida';
  end if;
  if not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'comprobantes-desembolso' and o.name = p_ruta
  ) then
    raise exception 'El archivo del comprobante no se encontró';
  end if;

  v_anterior := v_sol.comprobante_path;

  update public.solicitudes_credito s
     set comprobante_path = p_ruta,
         comprobante_subido_at = now(),
         comprobante_subido_por = auth.uid()
   where s.id = p_solicitud_id;

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values ('solicitud_credito'::public.historial_entidad, p_solicitud_id, auth.uid(),
          'comprobante_desembolso',
          case when v_anterior is null then 'Comprobante subido' else 'Comprobante reemplazado' end);

  return v_anterior;
end;
$$;
revoke all on function public.admin_registrar_comprobante(uuid, text) from public, anon;
grant execute on function public.admin_registrar_comprobante(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- B.1 perfiles: eliminado_at, sin FK a auth.users, cédula marcador
-- ------------------------------------------------------------
alter table public.perfiles add column if not exists eliminado_at timestamptz;
comment on column public.perfiles.eliminado_at is
  'Cuándo se anonimizó («eliminó definitivamente») al asociado. Solo lo pone admin_ejecutar_eliminacion (service_role).';
grant select (eliminado_at) on public.perfiles to authenticated;

-- Nadie (ni el propio asociado, que tiene UPDATE en su fila) cambia eliminado_at con la API.
create or replace function public.proteger_eliminado_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and new.eliminado_at is distinct from old.eliminado_at then
    raise exception 'El estado de eliminación solo lo cambia el proceso de eliminación';
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_eliminado_at() from public, anon, authenticated;
drop trigger if exists tr_proteger_eliminado_at on public.perfiles;
create trigger tr_proteger_eliminado_at
  before update of eliminado_at on public.perfiles
  for each row execute function public.proteger_eliminado_at();

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'perfiles_id_fkey' and conrelid = 'public.perfiles'::regclass) then
    alter table public.perfiles drop constraint perfiles_id_fkey;
  end if;
end $$;

-- Conserva la cascada de antes: borrar un usuario de Auth borra su perfil (con sus
-- dependientes), salvo el perfil ya anonimizado, que debe quedarse con las cifras.
create or replace function public.perfil_al_borrar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.perfiles p where p.id = old.id and p.eliminado_at is null;
  return old;
end;
$$;
revoke all on function public.perfil_al_borrar_usuario() from public, anon, authenticated;
drop trigger if exists tr_perfil_al_borrar_usuario on auth.users;
create trigger tr_perfil_al_borrar_usuario
  after delete on auth.users
  for each row execute function public.perfil_al_borrar_usuario();

alter table public.perfiles drop constraint if exists perfiles_cedula_formato_chk;
alter table public.perfiles
  add constraint perfiles_cedula_formato_chk
  check (cedula ~ '^[0-9]{6,10}$' or cedula ~ '^PENDIENTE-[0-9a-f]{8}$' or cedula ~ '^ELIMINADO-[0-9a-f]{12}$');

-- ------------------------------------------------------------
-- B.2 Solicitudes de eliminación (código por correo) y log inmutable
-- ------------------------------------------------------------
create table if not exists public.solicitudes_eliminacion_asociado (
  id                 uuid primary key default gen_random_uuid(),
  asociado_id        uuid not null references public.perfiles (id),
  admin_id           uuid not null references public.perfiles (id),
  motivo             text not null check (char_length(btrim(motivo)) between 5 and 300),
  codigo_hash        text,
  intentos           integer not null default 0 check (intentos between 0 and 3),
  expira_at          timestamptz not null,
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente', 'ejecutada', 'vencida', 'bloqueada', 'cancelada')),
  limpieza_pendiente boolean not null default false,
  archivos           text[],
  created_at         timestamptz not null default now(),
  resuelta_at        timestamptz
);
comment on table public.solicitudes_eliminacion_asociado is
  'Pedidos de «Eliminar definitivamente» con su código (solo el HMAC) de 6 dígitos enviado al correo del admin. Sin permisos para anon ni authenticated: solo service_role.';
create index if not exists ix_eliminacion_asociado on public.solicitudes_eliminacion_asociado (asociado_id, estado);
create index if not exists ix_eliminacion_admin on public.solicitudes_eliminacion_asociado (admin_id);

alter table public.solicitudes_eliminacion_asociado enable row level security;
revoke all on public.solicitudes_eliminacion_asociado from anon, authenticated;

create table if not exists public.eliminaciones_asociados (
  id           bigint generated always as identity primary key,
  asociado_id  uuid not null references public.perfiles (id),
  solicitud_id uuid not null,
  admin_id     uuid not null references public.perfiles (id),
  motivo       text not null check (char_length(btrim(motivo)) between 5 and 300),
  created_at   timestamptz not null default now()
);
comment on table public.eliminaciones_asociados is
  'Log inmutable de eliminaciones (anonimizaciones): quién, cuándo y por qué. NO guarda datos personales del asociado.';
create index if not exists ix_eliminaciones_asociado on public.eliminaciones_asociados (asociado_id);
create index if not exists ix_eliminaciones_admin on public.eliminaciones_asociados (admin_id);

alter table public.eliminaciones_asociados enable row level security;
revoke all on public.eliminaciones_asociados from anon, authenticated;
grant select on public.eliminaciones_asociados to authenticated;
drop policy if exists "eliminaciones_select_admin" on public.eliminaciones_asociados;
create policy "eliminaciones_select_admin" on public.eliminaciones_asociados
  for select to authenticated using ((select public.es_admin()));

create or replace function public.eliminaciones_inmutables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'El registro de eliminaciones no se puede modificar ni borrar';
end;
$$;
revoke all on function public.eliminaciones_inmutables() from public, anon, authenticated;
drop trigger if exists tr_eliminaciones_inmutables on public.eliminaciones_asociados;
create trigger tr_eliminaciones_inmutables
  before update or delete on public.eliminaciones_asociados
  for each row execute function public.eliminaciones_inmutables();
drop trigger if exists tr_eliminaciones_sin_truncate on public.eliminaciones_asociados;
create trigger tr_eliminaciones_sin_truncate
  before truncate on public.eliminaciones_asociados
  for each statement execute function public.eliminaciones_inmutables();

-- ------------------------------------------------------------
-- B.3 Reglas de quién se puede eliminar (compartidas por pedir y ejecutar)
-- ------------------------------------------------------------
create or replace function public.validar_eliminacion_asociado(p_admin_id uuid, p_asociado_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles%rowtype;
begin
  if p_admin_id is null or not exists (
    select 1 from public.perfiles a where a.id = p_admin_id and a.rol = 'admin'::public.rol_usuario and a.activo
  ) then
    raise exception 'Solo un administrador puede eliminar a un asociado';
  end if;
  if p_asociado_id = p_admin_id then
    raise exception 'No puedes eliminarte a ti mismo; debe hacerlo otro administrador';
  end if;

  select * into v_perfil from public.perfiles p where p.id = p_asociado_id;
  if not found then
    raise exception 'El asociado no existe';
  end if;
  if v_perfil.eliminado_at is not null then
    raise exception 'Este asociado ya fue eliminado';
  end if;
  if v_perfil.rol <> 'asociado'::public.rol_usuario then
    raise exception 'Los asesores y administradores no se eliminan desde aquí';
  end if;
  if v_perfil.activo then
    raise exception 'Primero da de baja al asociado; solo se elimina a un asociado inactivo';
  end if;
  if v_perfil.atiende_asociados or exists (select 1 from public.perfiles c where c.asesor_id = p_asociado_id) then
    raise exception 'Este asociado atiende a otros asociados; reasigna a sus clientes antes de eliminarlo';
  end if;
  if exists (
    select 1 from public.solicitudes_credito s
     where s.asociado_id = p_asociado_id and s.estado = 'pendiente'::public.estado_solicitud
  ) then
    raise exception 'Tiene una solicitud de crédito pendiente; resuélvela antes de eliminarlo';
  end if;
end;
$$;
revoke all on function public.validar_eliminacion_asociado(uuid, uuid) from public, anon, authenticated;
grant execute on function public.validar_eliminacion_asociado(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- B.4 Paso 1: crear la solicitud (el servidor ya generó y envió el código)
-- ------------------------------------------------------------
create or replace function public.admin_solicitar_eliminacion(
  p_admin_id    uuid,
  p_asociado_id uuid,
  p_motivo      text,
  p_codigo_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_id     uuid;
begin
  perform public.validar_eliminacion_asociado(p_admin_id, p_asociado_id);
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_codigo_hash is null or char_length(p_codigo_hash) < 32 then
    raise exception 'Falta el código de confirmación';
  end if;

  -- Un pedido nuevo cancela los anteriores de este asociado.
  update public.solicitudes_eliminacion_asociado s
     set estado = 'cancelada', resuelta_at = now(), codigo_hash = null
   where s.asociado_id = p_asociado_id and s.estado = 'pendiente';

  insert into public.solicitudes_eliminacion_asociado (asociado_id, admin_id, motivo, codigo_hash, expira_at)
  values (p_asociado_id, p_admin_id, v_motivo, p_codigo_hash, now() + interval '10 minutes')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_solicitar_eliminacion(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_solicitar_eliminacion(uuid, uuid, text, text) to service_role;

-- El servidor la llama si el correo con el código no pudo salir.
create or replace function public.admin_cancelar_eliminacion(p_admin_id uuid, p_solicitud_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.solicitudes_eliminacion_asociado s
     set estado = 'cancelada', resuelta_at = now(), codigo_hash = null
   where s.id = p_solicitud_id and s.admin_id = p_admin_id and s.estado = 'pendiente';
$$;
revoke all on function public.admin_cancelar_eliminacion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_cancelar_eliminacion(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- B.5 Paso 2: verificar el código y, si es correcto, anonimizar
--     No lanza por código malo/vencido/bloqueado: devuelve el resultado para
--     que el contador de intentos se guarde. Devuelve las rutas de Storage
--     («bucket/ruta») que el servidor debe borrar, junto con el usuario de Auth.
--     Repetir con la misma solicitud ya ejecutada y con limpieza pendiente
--     reintenta SOLO la limpieza (sin pedir el código otra vez).
-- ------------------------------------------------------------
create or replace function public.admin_confirmar_eliminacion(
  p_admin_id    uuid,
  p_solicitud_id uuid,
  p_codigo_hash text
)
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

  -- Archivos de Storage a borrar ya (afiliación), antes de limpiar las filas.
  -- Los comprobantes de desembolso NO van aquí: se guardan 30 días (más abajo).
  v_archivos :=
    coalesce((
      select array_agg('afiliacion-documentos/' || regexp_replace(f.ruta, '^afiliacion-documentos/', ''))
        from public.solicitudes_afiliacion sa
        cross join lateral unnest(array[sa.foto_cedula_frente, sa.foto_cedula_reverso, sa.foto_selfie]) as f(ruta)
       where sa.cedula = v_perfil.cedula and f.ruta is not null
    ), '{}'::text[]);

  -- Datos personales fuera.
  delete from public.solicitudes_afiliacion sa where sa.cedula = v_perfil.cedula;
  delete from public.solicitudes_recuperacion_acceso r where r.perfil_id = v_perfil.id;
  delete from public.carne_tokens t where t.asociado_id = v_perfil.id;
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
revoke all on function public.admin_confirmar_eliminacion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_confirmar_eliminacion(uuid, uuid, text) to service_role;

-- El servidor la llama cuando ya borró Storage y el usuario de Auth.
create or replace function public.admin_cerrar_limpieza_eliminacion(p_admin_id uuid, p_solicitud_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.solicitudes_eliminacion_asociado s
     set limpieza_pendiente = false, archivos = null
   where s.id = p_solicitud_id and s.admin_id = p_admin_id and s.estado = 'ejecutada';
$$;
revoke all on function public.admin_cerrar_limpieza_eliminacion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_cerrar_limpieza_eliminacion(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- C. Tarea programada: borrar comprobantes vencidos y huérfanos (SOLO service_role)
-- ------------------------------------------------------------
-- Comprobantes de asociados eliminados cuyo plazo de 30 días ya venció.
create or replace function public.comprobantes_vencidos(p_limite integer default 200)
returns table (solicitud_id uuid, ruta text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.comprobante_path
    from public.solicitudes_credito s
   where s.comprobante_path is not null
     and s.comprobante_borrar_at is not null
     and s.comprobante_borrar_at <= now()
   order by s.comprobante_borrar_at, s.id
   limit greatest(coalesce(p_limite, 200), 0);
$$;
revoke all on function public.comprobantes_vencidos(integer) from public, anon, authenticated;
grant execute on function public.comprobantes_vencidos(integer) to service_role;

-- Después de borrar el archivo de Storage: limpia la referencia (solo si ya venció).
create or replace function public.liberar_comprobantes(p_solicitud_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.solicitudes_credito s
     set comprobante_path = null, comprobante_subido_at = null, comprobante_borrar_at = null
   where s.id = any (coalesce(p_solicitud_ids, '{}'::uuid[]))
     and s.comprobante_borrar_at is not null
     and s.comprobante_borrar_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.liberar_comprobantes(uuid[]) from public, anon, authenticated;
grant execute on function public.liberar_comprobantes(uuid[]) to service_role;

-- Archivos subidos y nunca ligados a una solicitud, con más de 24 h.
create or replace function public.comprobantes_huerfanos(p_limite integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'comprobantes-desembolso'
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.solicitudes_credito s where s.comprobante_path = o.name)
   order by o.created_at, o.name
   limit greatest(coalesce(p_limite, 500), 0);
$$;
revoke all on function public.comprobantes_huerfanos(integer) from public, anon, authenticated;
grant execute on function public.comprobantes_huerfanos(integer) to service_role;
