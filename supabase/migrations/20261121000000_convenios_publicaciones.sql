-- ============================================================
-- Módulo de convenios · B1 · rol «convenio», cuentas, publicaciones,
-- métricas y storage (docs/spec-convenios.md §B1).
-- APLICADA en producción el 2026-11-21 (autorizada por Sebas).
--
-- NOTA SOBRE EL ENUM (igual que 20261003100000_secretario…): un valor nuevo
-- de enum no se puede USAR en la misma transacción en que se agrega. Por eso
-- en todo este archivo el rol se compara como texto (`p.rol::text =
-- 'convenio'`) y nunca con un literal del enum.
--
-- 1) rol_usuario += 'convenio'; perfiles acepta la cédula CONVENIO-xxxxxxxx.
-- 2) convenios: nit_base (generada, única) y eliminado_en (eliminar =
--    desactivar cuando tiene cuenta o publicaciones).
-- 3) convenio_cuentas: la cuenta de Auth de cada convenio (solo admin la lee).
-- 4) Helpers: hoy_bogota, dv_nit, publicacion_vigente, es_asociado_activo,
--    convenio_del_usuario, correo_por_nit (solo service_role) y
--    vincular_cuenta_convenio (solo service_role).
-- 5) convenio_publicaciones (promociones y catálogos) con RLS, guardas y
--    topes (10 promociones / 5 catálogos no vencidos ni ocultos).
-- 6) convenio_publicacion_eventos + registrar_evento_publicacion +
--    metricas_publicaciones (vistas y clics: totales y únicos).
-- 7) Bucket privado convenios-publicaciones y sus políticas.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Rol y cédula del perfil del convenio
-- ------------------------------------------------------------
alter type public.rol_usuario add value if not exists 'convenio';

alter table public.perfiles drop constraint if exists perfiles_cedula_formato_chk;
alter table public.perfiles
  add constraint perfiles_cedula_formato_chk
  check (
    cedula ~ '^[0-9]{6,10}$'
    or cedula ~ '^PENDIENTE-[0-9a-f]{8}$'
    or cedula ~ '^ELIMINADO-[0-9a-f]{12}$'
    or cedula ~ '^CONVENIO-[0-9a-f]{8}$'
  );

-- ------------------------------------------------------------
-- 2) convenios: nit_base y eliminado_en
-- ------------------------------------------------------------
-- NIT sin dígito de verificación y sin puntos: «902.038.118-7» -> «902038118».
alter table public.convenios
  add column if not exists nit_base text
    generated always as (nullif(regexp_replace(split_part(coalesce(nit, ''), '-', 1), '[^0-9]', '', 'g'), '')) stored,
  add column if not exists eliminado_en timestamptz;

comment on column public.convenios.nit_base is
  'NIT sin puntos ni dígito de verificación (generada desde nit). Llave del ingreso del convenio.';
comment on column public.convenios.eliminado_en is
  'Eliminado por el admin pero conservado (tiene cuenta o publicaciones). Siempre queda no visible.';

create unique index if not exists convenios_nit_base_key on public.convenios (nit_base) where nit_base is not null;

-- Un convenio eliminado nunca queda visible. Corre después de
-- tr_convenios_antes_de_guardar (orden alfabético), que copia visible -> activo.
create or replace function public.convenios_eliminado_no_visible()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.eliminado_en is not null then
    new.visible := false;
    new.activo := false;
  end if;
  return new;
end;
$$;
revoke all on function public.convenios_eliminado_no_visible() from public, anon, authenticated;

drop trigger if exists tr_convenios_eliminado on public.convenios;
create trigger tr_convenios_eliminado
  before insert or update on public.convenios
  for each row execute function public.convenios_eliminado_no_visible();

-- ------------------------------------------------------------
-- 3) convenio_cuentas
-- ------------------------------------------------------------
create table if not exists public.convenio_cuentas (
  convenio_id   uuid primary key references public.convenios (id) on delete restrict,
  usuario_id    uuid not null unique references auth.users (id) on delete cascade,
  correo_acceso text not null,
  creada_en     timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint convenio_cuentas_correo_chk check (
    correo_acceso = lower(correo_acceso)
    and char_length(correo_acceso) <= 254
    and correo_acceso ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);
comment on table public.convenio_cuentas is
  'Cuenta de Auth de cada convenio. correo_acceso es copia para mostrar en el admin; la fuente es auth.users.';
create unique index if not exists convenio_cuentas_correo_key on public.convenio_cuentas (correo_acceso);

alter table public.convenio_cuentas enable row level security;
revoke all on table public.convenio_cuentas from anon, authenticated;
grant select on table public.convenio_cuentas to authenticated;

drop policy if exists convenio_cuentas_select_admin on public.convenio_cuentas;
create policy convenio_cuentas_select_admin on public.convenio_cuentas
  for select to authenticated
  using ((select public.es_admin()));
-- Sin políticas de escritura: solo vincular_cuenta_convenio / service role.

-- ------------------------------------------------------------
-- 4) Helpers
-- ------------------------------------------------------------
create or replace function public.hoy_bogota()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;
revoke all on function public.hoy_bogota() from public, anon;
grant execute on function public.hoy_bogota() to authenticated;

-- Dígito de verificación DIAN de un NIT (sin DV). null si no son dígitos.
create or replace function public.dv_nit(p_base text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when t.s % 11 in (0, 1) then t.s % 11 else 11 - t.s % 11 end
  from (
    select sum(substr(reverse(p_base), i, 1)::int
               * (array[3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71])[i]) as s
    from generate_series(1, char_length(p_base)) as i
  ) t
  where p_base ~ '^[0-9]{1,15}$';
$$;
revoke all on function public.dv_nit(text) from public, anon, authenticated;

create or replace function public.publicacion_vigente(p_oculta_en timestamptz, p_inicia_el date, p_termina_el date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_oculta_en is null
     and (p_inicia_el is null or p_inicia_el <= public.hoy_bogota())
     and (p_termina_el is null or p_termina_el >= public.hoy_bogota());
$$;
revoke all on function public.publicacion_vigente(timestamptz, date, date) from public, anon;
grant execute on function public.publicacion_vigente(timestamptz, date, date) to authenticated;

create or replace function public.es_asociado_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and p.rol::text = 'asociado'
      and p.activo
      and p.eliminado_at is null
  );
$$;
revoke all on function public.es_asociado_activo() from public, anon;
grant execute on function public.es_asociado_activo() to authenticated;

-- Convenio del usuario actual si su cuenta y su convenio están activos; si no, null.
create or replace function public.convenio_del_usuario()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.convenio_cuentas cc
  join public.convenios c on c.id = cc.convenio_id
  join public.perfiles p on p.id = cc.usuario_id
  where cc.usuario_id = auth.uid()
    and p.rol::text = 'convenio'
    and p.activo
    and c.visible
    and c.eliminado_en is null
  limit 1;
$$;
revoke all on function public.convenio_del_usuario() from public, anon;
grant execute on function public.convenio_del_usuario() to authenticated;
comment on function public.convenio_del_usuario() is
  'Id del convenio del usuario autenticado (rol convenio, convenio visible y no eliminado); null si no aplica.';

-- Correo de Auth del convenio por NIT. Acepta «902038118», «902.038.118-7»
-- y «9020381187» (el último dígito se acepta como DV solo si coincide).
-- Solo service_role (Server Action del ingreso), igual que correo_por_cedula.
create or replace function public.correo_por_nit(p_nit text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with entrada as (
    select regexp_replace(split_part(coalesce(p_nit, ''), '-', 1), '[^0-9]', '', 'g') as d,
           position('-' in coalesce(p_nit, '')) > 0 as con_guion
    where coalesce(p_nit, '') ~ '^[0-9. -]{6,20}$'
  ),
  candidatos as (
    select e.d as base from entrada e where char_length(e.d) between 6 and 10
    union all
    select left(e.d, char_length(e.d) - 1)
    from entrada e
    where not e.con_guion
      and char_length(e.d) between 7 and 11
      and nullif(right(e.d, 1), '')::int = public.dv_nit(left(e.d, greatest(char_length(e.d) - 1, 0)))
  )
  select u.email::text
  from public.convenios c
  join public.convenio_cuentas cc on cc.convenio_id = c.id
  join public.perfiles p on p.id = cc.usuario_id
  join auth.users u on u.id = cc.usuario_id
  where c.nit_base in (select base from candidatos)
    and c.visible
    and c.eliminado_en is null
    and p.rol::text = 'convenio'
    and p.activo
  order by (c.nit_base = (select e.d from entrada e)) desc
  limit 1;
$$;
revoke all on function public.correo_por_nit(text) from public, anon, authenticated;
grant execute on function public.correo_por_nit(text) to service_role;
comment on function public.correo_por_nit(text) is
  'Correo de Auth de la cuenta de un convenio activo, por NIT. Solo service_role (login por OTP).';

-- Vincula una cuenta de Auth recién creada (o ya de convenio) a un convenio.
-- Nunca convierte a un asociado real: solo perfiles con cédula PENDIENTE-…
-- (recién creados por handle_new_user) o que ya son de convenio.
create or replace function public.vincular_cuenta_convenio(p_convenio uuid, p_usuario uuid, p_correo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_cedula text;
begin
  select p.rol::text, p.cedula into v_rol, v_cedula from public.perfiles p where p.id = p_usuario for update;
  if v_rol is null then
    raise exception 'No existe el perfil de la cuenta';
  end if;
  if not (v_rol = 'convenio' or (v_rol = 'asociado' and v_cedula ~ '^PENDIENTE-')) then
    raise exception 'Ese correo ya pertenece a otra cuenta de Green Alliance';
  end if;
  if exists (select 1 from public.convenio_cuentas cc where cc.usuario_id = p_usuario and cc.convenio_id <> p_convenio) then
    raise exception 'Esa cuenta ya está vinculada a otro convenio';
  end if;
  if not exists (select 1 from public.convenios c where c.id = p_convenio) then
    raise exception 'No existe el convenio';
  end if;

  if v_rol <> 'convenio' then
    perform set_config('ga.motivo_cambio_rol', 'Cuenta de convenio', true);
    update public.perfiles
       set rol = 'convenio'::text::public.rol_usuario,
           cedula = 'CONVENIO-' || left(p_usuario::text, 8)
     where id = p_usuario;
  end if;

  insert into public.convenio_cuentas (convenio_id, usuario_id, correo_acceso)
  values (p_convenio, p_usuario, lower(btrim(p_correo)))
  on conflict (convenio_id) do update
    set usuario_id = excluded.usuario_id,
        correo_acceso = excluded.correo_acceso,
        actualizada_en = now();
end;
$$;
revoke all on function public.vincular_cuenta_convenio(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.vincular_cuenta_convenio(uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 5) convenio_publicaciones
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_publicacion' and typnamespace = 'public'::regnamespace) then
    create type public.tipo_publicacion as enum ('promocion', 'catalogo');
  end if;
end $$;

-- Rutas del bucket: <convenio_id>/<publicacion_id>/<archivo>.
create or replace function public.rutas_publicacion_validas(p_convenio uuid, p_id uuid, p_imagenes text[], p_pdf text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(r ~ ('^' || p_convenio::text || '/' || p_id::text || '/[A-Za-z0-9._-]{1,80}$') and r !~ '\.\.'), true)
  from unnest(array_cat(coalesce(p_imagenes, '{}'::text[]), case when p_pdf is null then '{}'::text[] else array[p_pdf] end)) as r;
$$;
revoke all on function public.rutas_publicacion_validas(uuid, uuid, text[], text) from public, anon;
grant execute on function public.rutas_publicacion_validas(uuid, uuid, text[], text) to authenticated;

create table if not exists public.convenio_publicaciones (
  id             uuid primary key default gen_random_uuid(),
  convenio_id    uuid not null references public.convenios (id) on delete restrict,
  tipo           public.tipo_publicacion not null,
  titulo         text not null,
  descripcion    text,
  beneficio      text,
  imagenes       text[] not null default '{}',
  pdf_path       text,
  inicia_el      date,
  termina_el     date,
  oculta_en      timestamptz,
  oculta_por     uuid references public.perfiles (id) on delete set null,
  oculta_motivo  text,
  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint convenio_publicaciones_textos_chk check (
    char_length(btrim(titulo)) between 3 and 80
    and (descripcion is null or char_length(descripcion) <= 600)
    and (beneficio is null or char_length(btrim(beneficio)) between 1 and 30)
    and (oculta_motivo is null or char_length(oculta_motivo) <= 200)
  ),
  constraint convenio_publicaciones_tipo_chk check (
    case tipo
      when 'promocion' then
        descripcion is not null and char_length(btrim(descripcion)) >= 1
        and cardinality(imagenes) = 1
        and pdf_path is null
        and inicia_el is not null and termina_el is not null
        and termina_el - inicia_el <= 366
      when 'catalogo' then
        beneficio is null
        and ((pdf_path is not null and cardinality(imagenes) = 0)
             or (pdf_path is null and cardinality(imagenes) between 1 and 10))
    end
  ),
  constraint convenio_publicaciones_fechas_chk check (
    inicia_el is null or termina_el is null or termina_el >= inicia_el
  ),
  constraint convenio_publicaciones_rutas_chk check (
    public.rutas_publicacion_validas(convenio_id, id, imagenes, pdf_path)
  )
);
comment on table public.convenio_publicaciones is
  'Promociones y catálogos que publica cada convenio (sin aprobación). Activa = convenio visible + publicacion_vigente().';

create index if not exists convenio_publicaciones_convenio_idx on public.convenio_publicaciones (convenio_id, tipo);
create index if not exists convenio_publicaciones_feed_idx on public.convenio_publicaciones (creada_en desc) where oculta_en is null;
create index if not exists convenio_publicaciones_oculta_por_idx on public.convenio_publicaciones (oculta_por) where oculta_por is not null;

-- Guardas, sellos de ocultamiento y topes. Security invoker: cuenta lo que
-- el usuario ve (el convenio, sus propias filas).
create or replace function public.convenio_publicaciones_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_staff boolean := v_uid is not null and coalesce(public.es_admin_o_secretario(), false);
  v_activas integer;
  v_tope integer;
begin
  if tg_op = 'INSERT' then
    new.creada_en := now();
    if v_uid is not null and not v_staff
       and (new.oculta_en is not null or new.oculta_por is not null or new.oculta_motivo is not null) then
      raise exception 'Solo Green Alliance puede ocultar una publicación';
    end if;
  else
    new.creada_en := old.creada_en;
    if new.convenio_id is distinct from old.convenio_id then
      raise exception 'No se puede cambiar el convenio de una publicación';
    end if;
    if new.tipo is distinct from old.tipo then
      raise exception 'No se puede cambiar el tipo de una publicación';
    end if;
    if v_uid is not null and not v_staff
       and (new.oculta_en, new.oculta_por, new.oculta_motivo) is distinct from (old.oculta_en, old.oculta_por, old.oculta_motivo) then
      raise exception 'Solo Green Alliance puede ocultar o volver a mostrar una publicación';
    end if;
    if v_staff
       and (new.titulo, new.descripcion, new.beneficio, new.imagenes, new.pdf_path, new.inicia_el, new.termina_el)
           is distinct from
           (old.titulo, old.descripcion, old.beneficio, old.imagenes, old.pdf_path, old.inicia_el, old.termina_el) then
      raise exception 'Green Alliance solo puede ocultar o volver a mostrar una publicación';
    end if;
  end if;

  -- Sellos: quién y cuándo se ocultó (no se confía en lo que manda el cliente).
  if new.oculta_en is not null and (tg_op = 'INSERT' or old.oculta_en is null) then
    new.oculta_en := now();
    new.oculta_por := coalesce(v_uid, new.oculta_por);
  elsif new.oculta_en is not null then
    new.oculta_en := old.oculta_en;
    new.oculta_por := old.oculta_por;
  else
    new.oculta_por := null;
    new.oculta_motivo := null;
  end if;
  new.oculta_motivo := nullif(btrim(new.oculta_motivo), '');
  new.actualizada_en := now();

  -- Topes: 10 promociones y 5 catálogos no vencidos ni ocultos (publicadas +
  -- programadas). Green Alliance puede volver a mostrar aunque se pase.
  if new.oculta_en is null
     and (new.termina_el is null or new.termina_el >= public.hoy_bogota())
     and not (tg_op = 'UPDATE' and v_staff) then
    perform pg_advisory_xact_lock(hashtextextended('convenio_publicaciones:' || new.convenio_id::text, 0));
    select count(*) into v_activas
    from public.convenio_publicaciones p
    where p.convenio_id = new.convenio_id
      and p.tipo = new.tipo
      and p.id <> new.id
      and p.oculta_en is null
      and (p.termina_el is null or p.termina_el >= public.hoy_bogota());
    v_tope := case new.tipo::text when 'promocion' then 10 else 5 end;
    if v_activas >= v_tope then
      raise exception using
        errcode = 'P0001',
        message = format('Ya tienes %s %s activas o programadas, el máximo. Retira una o espera a que venza.',
                         v_tope, case new.tipo::text when 'promocion' then 'promociones' else 'catálogos' end);
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.convenio_publicaciones_antes_de_guardar() from public, anon, authenticated;

drop trigger if exists tr_convenio_publicaciones_antes_de_guardar on public.convenio_publicaciones;
create trigger tr_convenio_publicaciones_antes_de_guardar
  before insert or update on public.convenio_publicaciones
  for each row execute function public.convenio_publicaciones_antes_de_guardar();

alter table public.convenio_publicaciones enable row level security;
revoke all on table public.convenio_publicaciones from anon, authenticated;
grant select, insert, update, delete on table public.convenio_publicaciones to authenticated;

-- Convenio: solo lo suyo; no toca las ocultas.
drop policy if exists convenio_publicaciones_select_propias on public.convenio_publicaciones;
create policy convenio_publicaciones_select_propias on public.convenio_publicaciones
  for select to authenticated
  using (convenio_id = (select public.convenio_del_usuario()));

drop policy if exists convenio_publicaciones_insert_propias on public.convenio_publicaciones;
create policy convenio_publicaciones_insert_propias on public.convenio_publicaciones
  for insert to authenticated
  with check (convenio_id = (select public.convenio_del_usuario()));

drop policy if exists convenio_publicaciones_update_propias on public.convenio_publicaciones;
create policy convenio_publicaciones_update_propias on public.convenio_publicaciones
  for update to authenticated
  using (convenio_id = (select public.convenio_del_usuario()) and oculta_en is null)
  with check (convenio_id = (select public.convenio_del_usuario()) and oculta_en is null);

drop policy if exists convenio_publicaciones_delete_propias on public.convenio_publicaciones;
create policy convenio_publicaciones_delete_propias on public.convenio_publicaciones
  for delete to authenticated
  using (convenio_id = (select public.convenio_del_usuario()) and oculta_en is null);

-- Asociado activo: solo vigentes de convenios visibles.
drop policy if exists convenio_publicaciones_select_asociado on public.convenio_publicaciones;
create policy convenio_publicaciones_select_asociado on public.convenio_publicaciones
  for select to authenticated
  using (
    (select public.es_asociado_activo())
    and public.publicacion_vigente(oculta_en, inicia_el, termina_el)
    and exists (
      select 1 from public.convenios c
      where c.id = convenio_id and c.visible and c.eliminado_en is null
    )
  );

-- Admin y secretario: ven todo y ocultan / muestran (el trigger impide
-- que cambien el contenido). No borran.
drop policy if exists convenio_publicaciones_select_staff on public.convenio_publicaciones;
create policy convenio_publicaciones_select_staff on public.convenio_publicaciones
  for select to authenticated
  using ((select public.es_admin_o_secretario()));

drop policy if exists convenio_publicaciones_update_staff on public.convenio_publicaciones;
create policy convenio_publicaciones_update_staff on public.convenio_publicaciones
  for update to authenticated
  using ((select public.es_admin_o_secretario()))
  with check ((select public.es_admin_o_secretario()));

-- ------------------------------------------------------------
-- 6) Métricas
-- ------------------------------------------------------------
-- Una fila por publicación, tipo, asociado y día; `cantidad` suma las
-- repeticiones (tope 20 por día para que recargar no infle el total).
create table if not exists public.convenio_publicacion_eventos (
  publicacion_id uuid not null references public.convenio_publicaciones (id) on delete cascade,
  tipo           text not null check (tipo in ('vista', 'whatsapp')),
  asociado_id    uuid not null references public.perfiles (id) on delete cascade,
  dia            date not null default public.hoy_bogota(),
  cantidad       integer not null default 1 check (cantidad between 1 and 20),
  primary key (publicacion_id, tipo, asociado_id, dia)
);
create index if not exists convenio_publicacion_eventos_asociado_idx on public.convenio_publicacion_eventos (asociado_id);

alter table public.convenio_publicacion_eventos enable row level security;
revoke all on table public.convenio_publicacion_eventos from anon, authenticated;
-- Sin políticas: se escribe y se lee solo por las funciones de abajo.

create or replace function public.registrar_evento_publicacion(p_publicacion uuid, p_tipo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_asociado_activo() then
    raise exception 'Solo los asociados registran vistas';
  end if;
  if p_tipo not in ('vista', 'whatsapp') then
    raise exception 'Tipo de evento no válido';
  end if;
  if not exists (
    select 1
    from public.convenio_publicaciones p
    join public.convenios c on c.id = p.convenio_id
    where p.id = p_publicacion
      and c.visible and c.eliminado_en is null
      and public.publicacion_vigente(p.oculta_en, p.inicia_el, p.termina_el)
  ) then
    raise exception 'La publicación no está disponible';
  end if;

  insert into public.convenio_publicacion_eventos (publicacion_id, tipo, asociado_id, dia)
  values (p_publicacion, p_tipo, auth.uid(), public.hoy_bogota())
  on conflict (publicacion_id, tipo, asociado_id, dia) do update
    set cantidad = least(public.convenio_publicacion_eventos.cantidad + 1, 20);
end;
$$;
revoke all on function public.registrar_evento_publicacion(uuid, text) from public, anon;
grant execute on function public.registrar_evento_publicacion(uuid, text) to authenticated;

-- Totales y únicos (asociados distintos) por publicación. El convenio ve
-- los suyos; admin y secretario, los del convenio que pidan (o todos).
create or replace function public.metricas_publicaciones(p_convenio uuid default null)
returns table (publicacion_id uuid, vistas bigint, vistas_unicas bigint, clics bigint, clics_unicos bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := coalesce(public.es_admin_o_secretario(), false);
  v_convenio uuid := public.convenio_del_usuario();
begin
  if not v_staff and v_convenio is null then
    return;
  end if;
  return query
  select p.id,
         coalesce(sum(e.cantidad) filter (where e.tipo = 'vista'), 0)::bigint,
         count(distinct e.asociado_id) filter (where e.tipo = 'vista'),
         coalesce(sum(e.cantidad) filter (where e.tipo = 'whatsapp'), 0)::bigint,
         count(distinct e.asociado_id) filter (where e.tipo = 'whatsapp')
  from public.convenio_publicaciones p
  left join public.convenio_publicacion_eventos e on e.publicacion_id = p.id
  where case when v_staff then (p_convenio is null or p.convenio_id = p_convenio)
             else p.convenio_id = v_convenio end
  group by p.id;
end;
$$;
revoke all on function public.metricas_publicaciones(uuid) from public, anon;
grant execute on function public.metricas_publicaciones(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7) Storage: bucket privado convenios-publicaciones
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('convenios-publicaciones', 'convenios-publicaciones', false, 15728640, array['image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists convenios_publicaciones_select on storage.objects;
create policy convenios_publicaciones_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'convenios-publicaciones'
    and (
      (storage.foldername(name))[1] = (select public.convenio_del_usuario())::text
      or (select public.es_admin_o_secretario())
      or (
        (select public.es_asociado_activo())
        and exists (
          select 1
          from public.convenio_publicaciones p
          join public.convenios c on c.id = p.convenio_id
          where p.id::text = (storage.foldername(name))[2]
            and c.visible and c.eliminado_en is null
            and public.publicacion_vigente(p.oculta_en, p.inicia_el, p.termina_el)
            and (name = any (p.imagenes) or name = p.pdf_path)
        )
      )
    )
  );

drop policy if exists convenios_publicaciones_insert on storage.objects;
create policy convenios_publicaciones_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'convenios-publicaciones'
    and (storage.foldername(name))[1] = (select public.convenio_del_usuario())::text
  );

drop policy if exists convenios_publicaciones_delete on storage.objects;
create policy convenios_publicaciones_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'convenios-publicaciones'
    and (storage.foldername(name))[1] = (select public.convenio_del_usuario())::text
    and not exists (
      select 1 from public.convenio_publicaciones p
      where p.id::text = (storage.foldername(name))[2]
        and p.oculta_en is not null
    )
  );
-- Sin update: cada archivo nuevo es un nombre nuevo.
