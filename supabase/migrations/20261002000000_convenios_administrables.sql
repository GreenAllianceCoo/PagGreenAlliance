-- ============================================================
-- ga-auditor-supabase, 2026-10-01 — Convenios administrables desde /admin
-- (5.9 / P-68) y corrección F2-08 (P-88).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- 1. convenios: columnas para administrarlos (orden, visible, logo_path,
--    video_url, pdf_url, pdf_tamano, creado_en, actualizado_en).
--    Se conservan los nombres existentes para no romper el código:
--      nombre      -> nombre_empresa
--      categoría   -> especialidad
--      beneficio   -> descripcion (+ servicios text[], sedes text[])
--      WhatsApp    -> telefono_contacto
--    `activo` queda como espejo de `visible` (trigger) para que el loader
--    actual (.eq('activo', true)) siga funcionando; lo nuevo usa `visible`.
-- 2. Siembra idempotente (por NIT) de orden y medios de lib/convenios.ts
--    (ORDEN_POR_NIT y MEDIO_POR_NIT). Los textos ya los sembró 20260929100600.
-- 3. RLS: lectura de visibles para anon y authenticated (admin ve todo);
--    escritura solo admin (public.es_admin()). anon solo lee columnas
--    comerciales (privilegio por columna).
-- 4. Storage: bucket público `convenios-logos` (imágenes, 1 MB); escribe
--    solo admin.
-- 5. F2-08: tr_componer_nombre_afiliacion también se dispara con update de
--    `nombre`, así un admin no puede reescribirlo a mano (se recompone).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas
-- ------------------------------------------------------------
alter table public.convenios
  add column if not exists orden          integer     not null default 100,
  add column if not exists visible        boolean     not null default true,
  add column if not exists logo_path      text,
  add column if not exists video_url      text,
  add column if not exists pdf_url        text,
  add column if not exists pdf_tamano     text,
  add column if not exists creado_en      timestamptz not null default now(),
  add column if not exists actualizado_en timestamptz not null default now();

-- visible arranca igual a activo en las filas existentes.
update public.convenios set visible = activo where visible is distinct from activo;

comment on column public.convenios.orden is 'Posición en la presentación (menor primero).';
comment on column public.convenios.visible is 'Si se muestra en la landing y /cuenta. activo es su espejo (legado).';
comment on column public.convenios.logo_path is 'Ruta del logo dentro del bucket convenios-logos (p. ej. amb-movil.webp).';
comment on column public.convenios.video_url is 'Video del detalle: ruta /convenios/… del sitio o URL https.';
comment on column public.convenios.pdf_url is 'PDF del detalle: ruta /convenios/… del sitio o URL https.';
comment on column public.convenios.pdf_tamano is 'Texto del tamaño del PDF que se muestra (p. ej. «3 MB»).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'convenios_admin_chk') then
    alter table public.convenios
      add constraint convenios_admin_chk
      check (
        orden between 0 and 10000
        and (logo_path is null or (char_length(logo_path) <= 200 and logo_path ~ '^[A-Za-z0-9._/-]+$' and logo_path !~ '\.\.'))
        and (video_url is null or (char_length(video_url) <= 500 and video_url ~ '^(/convenios/|https://)'))
        and (pdf_url   is null or (char_length(pdf_url)   <= 500 and pdf_url   ~ '^(/convenios/|https://)'))
        and (pdf_tamano is null or char_length(pdf_tamano) <= 20)
      );
  end if;
end $$;

create index if not exists convenios_visible_orden_idx on public.convenios (orden) where visible;

-- ------------------------------------------------------------
-- Trigger: actualizado_en y espejo activo <-> visible
-- (security invoker; no se puede llamar por RPC)
-- ------------------------------------------------------------
create or replace function public.convenios_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Si alguien (código viejo) inserta activo=false, queda oculto.
    new.visible := new.visible and new.activo;
    new.creado_en := now();
  else
    new.creado_en := old.creado_en;
    -- Código viejo que solo cambia activo: se respeta.
    if new.activo is distinct from old.activo and new.visible is not distinct from old.visible then
      new.visible := new.activo;
    end if;
  end if;
  new.activo := new.visible;
  new.actualizado_en := now();
  return new;
end;
$$;
revoke all on function public.convenios_antes_de_guardar() from public, anon, authenticated;

drop trigger if exists tr_convenios_antes_de_guardar on public.convenios;
create trigger tr_convenios_antes_de_guardar
  before insert or update on public.convenios
  for each row execute function public.convenios_antes_de_guardar();

-- ------------------------------------------------------------
-- 2. Siembra (por NIT; no crea ni borra convenios)
-- ------------------------------------------------------------
with datos (nit, orden, video_url, pdf_url, pdf_tamano) as (
  values
    ('902.038.118-7',   10, '/convenios/amb-movil.mp4',            null, null),
    ('901.865.816-3',   20, '/convenios/locos-por-los-viajes.mp4', null, null),
    ('1.090.464.475-4', 30, '/convenios/dr-ribero.mp4',            null, null),
    ('1.054.095.149-3', 40, null, '/convenios/racing-tours-presentacion.pdf', '3 MB'),
    ('52.953.735-3',    50, '/convenios/dream-go-visas.mp4',       null, null)
)
update public.convenios c
   set orden = d.orden,
       video_url = coalesce(c.video_url, d.video_url),
       pdf_url = coalesce(c.pdf_url, d.pdf_url),
       pdf_tamano = coalesce(c.pdf_tamano, d.pdf_tamano)
  from datos d
 where c.nit = d.nit
   and (c.orden = 100 or c.video_url is null and d.video_url is not null or c.pdf_url is null and d.pdf_url is not null);

-- ------------------------------------------------------------
-- 3. RLS y privilegios
-- ------------------------------------------------------------
drop policy if exists "convenios_select_activos" on public.convenios;
drop policy if exists "convenios_select_visibles" on public.convenios;
-- es_admin() no es ejecutable por anon: una política para cada rol.
drop policy if exists "convenios_select_visibles_anon" on public.convenios;
create policy "convenios_select_visibles_anon" on public.convenios
  for select to anon using (visible);
create policy "convenios_select_visibles" on public.convenios
  for select to authenticated using (visible or (select public.es_admin()));

-- insert/update/delete solo admin: ya existen convenios_insert_admin,
-- convenios_update_admin y convenios_delete_admin (20260923123853).

-- anon: solo columnas comerciales.
revoke select on public.convenios from anon;
grant select (id, nombre_empresa, nit, especialidad, emoji, descripcion, servicios, sedes,
              telefono_contacto, orden, visible, logo_path, video_url, pdf_url, pdf_tamano)
  on public.convenios to anon;

-- ------------------------------------------------------------
-- 4. Storage: convenios-logos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('convenios-logos', 'convenios-logos', true, 1048576, -- 1 MB
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: el bucket es público (URL pública sin política). No se agrega
-- select para anon en storage.objects para no permitir listar el bucket.
drop policy if exists "convenios_logos_admin_select" on storage.objects;
create policy "convenios_logos_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'convenios-logos' and (select public.es_admin()));
drop policy if exists "convenios_logos_admin_insert" on storage.objects;
create policy "convenios_logos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'convenios-logos' and (select public.es_admin()));
drop policy if exists "convenios_logos_admin_update" on storage.objects;
create policy "convenios_logos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'convenios-logos' and (select public.es_admin()))
  with check (bucket_id = 'convenios-logos' and (select public.es_admin()));
drop policy if exists "convenios_logos_admin_delete" on storage.objects;
create policy "convenios_logos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'convenios-logos' and (select public.es_admin()));

-- ------------------------------------------------------------
-- 5. F2-08: nombre de la afiliación siempre compuesto
-- ------------------------------------------------------------
drop trigger if exists tr_componer_nombre_afiliacion on public.solicitudes_afiliacion;
create trigger tr_componer_nombre_afiliacion
  before insert or update of nombres, apellidos, nombre on public.solicitudes_afiliacion
  for each row execute function public.componer_nombre_afiliacion();
