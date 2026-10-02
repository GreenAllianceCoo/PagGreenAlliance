-- ============================================================
-- ga-funcionalidad-botones, 2026-10-02 — pedido de Sebas: foto del asociado en el carné.
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
--  * Por defecto el carné usa la selfie de la afiliación (solicitudes_afiliacion.foto_selfie,
--    bucket privado `afiliacion-documentos`). El asociado puede cambiarla por otra foto suya.
--  * Bucket PRIVADO nuevo `fotos-carne` (5 MB; JPG/PNG/WEBP). Sin políticas en
--    storage.objects: solo el servidor (service role) sube, firma y borra, DESPUÉS de
--    comprobar la sesión del asociado. Ruta: «<asociado>/<uuid>.<ext>».
--  * fotos_carne: UNA fila por asociado (reemplazar = actualizar; el servidor borra el
--    archivo anterior). historial_foto_carne: log de cambios (sin datos personales).
--  * Funciones SOLO service_role (el servidor valida sesión/rol antes). Ninguna se concede a
--    anon ni authenticated, así que no entran a la lista blanca de funciones security definer.
--  * Tope de cambios: 5 por hora por asociado (lo exige la base, no solo el navegador).
--  * Eliminar definitivamente (anonimizar) también borra la foto de carné y su log:
--    se reemplaza admin_confirmar_eliminacion (copia de 20261003000000 + estas líneas).
--    Los comprobantes de desembolso se conservan 30 días (comprobante_borrar_at), no se borran aquí.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bucket privado
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-carne', 'fotos-carne', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Ni política de storage.objects ni de storage.buckets: solo service_role.

-- ------------------------------------------------------------
-- 2. Tablas (sin permisos para anon ni authenticated)
-- ------------------------------------------------------------
create table if not exists public.fotos_carne (
  asociado_id uuid primary key references public.perfiles (id) on delete cascade,
  ruta        text not null,
  updated_at  timestamptz not null default now(),
  constraint fotos_carne_ruta_chk
    check (ruta ~ ('^' || asociado_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
comment on table public.fotos_carne is
  'Foto propia del asociado para su carné (bucket fotos-carne). Una por asociado. Sin permisos para anon ni authenticated: solo service_role.';
alter table public.fotos_carne enable row level security;
revoke all on public.fotos_carne from anon, authenticated;

create table if not exists public.historial_foto_carne (
  id          bigint generated always as identity primary key,
  asociado_id uuid not null references public.perfiles (id) on delete cascade,
  accion      text not null check (accion in ('subida', 'reemplazo', 'quitada')),
  created_at  timestamptz not null default now()
);
comment on table public.historial_foto_carne is
  'Log de cambios de la foto del carné (cuándo y qué; sin la foto ni datos personales). Solo service_role.';
create index if not exists ix_historial_foto_carne_asociado on public.historial_foto_carne (asociado_id, created_at desc);
alter table public.historial_foto_carne enable row level security;
revoke all on public.historial_foto_carne from anon, authenticated;

-- ------------------------------------------------------------
-- 3. Qué foto muestra el carné: la propia o, si no hay, la selfie de la afiliación
--    Devuelve «bucket/ruta» y el origen ('propia' | 'afiliacion'); 0 filas si no hay foto.
-- ------------------------------------------------------------
create or replace function public.foto_carne_de_asociado(p_asociado_id uuid)
returns table (ruta text, origen text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'fotos-carne/' || f.ruta, 'propia'::text
    from public.fotos_carne f
    join public.perfiles p on p.id = f.asociado_id and p.eliminado_at is null
   where f.asociado_id = p_asociado_id
  union all
  select 'afiliacion-documentos/' || regexp_replace(sa.foto_selfie, '^afiliacion-documentos/', ''), 'afiliacion'::text
    from public.perfiles p
    join lateral (
      select s.foto_selfie
        from public.solicitudes_afiliacion s
       where s.cedula = p.cedula and s.foto_selfie is not null and s.estado = 'aprobada'
       order by s.created_at desc
       limit 1
    ) sa on true
   where p.id = p_asociado_id and p.eliminado_at is null
     and not exists (select 1 from public.fotos_carne f2 where f2.asociado_id = p_asociado_id)
  limit 1;
$$;
revoke all on function public.foto_carne_de_asociado(uuid) from public, anon, authenticated;
grant execute on function public.foto_carne_de_asociado(uuid) to service_role;

-- Verificación pública: solo si el token es válido y el asociado está activo.
create or replace function public.foto_carne_por_token(p_token uuid)
returns table (ruta text, origen text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.ruta, r.origen
    from public.carne_tokens t
    join public.perfiles p on p.id = t.asociado_id
         and p.rol = 'asociado'::public.rol_usuario and p.activo and p.eliminado_at is null
    cross join lateral public.foto_carne_de_asociado(p.id) r
   where p_token is not null and t.token = p_token;
$$;
revoke all on function public.foto_carne_por_token(uuid) from public, anon, authenticated;
grant execute on function public.foto_carne_por_token(uuid) to service_role;

-- ------------------------------------------------------------
-- 4. Guardar / quitar la foto propia (devuelven la ruta ANTERIOR para borrarla de Storage)
-- ------------------------------------------------------------
create or replace function public.registrar_foto_carne(p_asociado_id uuid, p_ruta text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text;
begin
  if p_asociado_id is null or p_ruta is null then
    raise exception 'Faltan datos de la foto';
  end if;
  if not exists (
    select 1 from public.perfiles p
     where p.id = p_asociado_id and p.rol = 'asociado'::public.rol_usuario and p.activo and p.eliminado_at is null
  ) then
    raise exception 'No se puede guardar la foto de este usuario';
  end if;
  if p_ruta !~ ('^' || p_asociado_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'La ruta de la foto no es válida';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'fotos-carne' and o.name = p_ruta) then
    raise exception 'El archivo de la foto no se encontró';
  end if;
  if (select count(*) from public.historial_foto_carne h
       where h.asociado_id = p_asociado_id and h.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Cambiaste la foto muchas veces seguidas';
  end if;

  select f.ruta into v_anterior from public.fotos_carne f where f.asociado_id = p_asociado_id for update;

  insert into public.fotos_carne (asociado_id, ruta) values (p_asociado_id, p_ruta)
  on conflict (asociado_id) do update set ruta = excluded.ruta, updated_at = now();

  insert into public.historial_foto_carne (asociado_id, accion)
  values (p_asociado_id, case when v_anterior is null then 'subida' else 'reemplazo' end);
  return v_anterior;
end;
$$;
revoke all on function public.registrar_foto_carne(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_foto_carne(uuid, text) to service_role;

create or replace function public.quitar_foto_carne(p_asociado_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text;
begin
  delete from public.fotos_carne f where f.asociado_id = p_asociado_id returning f.ruta into v_anterior;
  if v_anterior is not null then
    insert into public.historial_foto_carne (asociado_id, accion) values (p_asociado_id, 'quitada');
  end if;
  return v_anterior;
end;
$$;
revoke all on function public.quitar_foto_carne(uuid) from public, anon, authenticated;
grant execute on function public.quitar_foto_carne(uuid) to service_role;

-- ------------------------------------------------------------
-- 5. Eliminar definitivamente: también la foto del carné
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

  -- Archivos de Storage a borrar ya (afiliación y foto del carné), antes de limpiar las filas.
  -- Los comprobantes de desembolso NO van aquí: se guardan 30 días (más abajo).
  v_archivos :=
    coalesce((
      select array_agg('afiliacion-documentos/' || regexp_replace(f.ruta, '^afiliacion-documentos/', ''))
        from public.solicitudes_afiliacion sa
        cross join lateral unnest(array[sa.foto_cedula_frente, sa.foto_cedula_reverso, sa.foto_selfie]) as f(ruta)
       where sa.cedula = v_perfil.cedula and f.ruta is not null
    ), '{}'::text[])
    || coalesce((
      select array_agg('fotos-carne/' || fc.ruta)
        from public.fotos_carne fc
       where fc.asociado_id = v_perfil.id
    ), '{}'::text[]);

  -- Datos personales fuera.
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
revoke all on function public.admin_confirmar_eliminacion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_confirmar_eliminacion(uuid, uuid, text) to service_role;

