-- ============================================================
-- Green Alliance · pgTAP · Fase 2 · storage privado de afiliación
-- Bucket 'afiliacion-documentos': privado, 5 MB, solo jpeg/png/webp.
-- Sin políticas de storage.objects para anon/authenticated: nadie sube ni
-- lee por la API salvo el servidor con service role.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select is(
  (select public from storage.buckets where id = 'afiliacion-documentos'),
  false,
  'el bucket afiliacion-documentos es privado'
);

select is(
  (select file_size_limit from storage.buckets where id = 'afiliacion-documentos'),
  5242880::bigint,
  'el límite de tamaño es 5 MB'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'afiliacion-documentos'),
  array['image/jpeg', 'image/png', 'image/webp'],
  'solo se permiten jpeg, png y webp'
);

-- Usuario admin de prueba, insertado ANTES de bajar a anon/authenticated
-- (solo postgres/service role puede escribir en auth.users).
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test', '{"cedula":"1000000003"}', '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

-- ------------------------------------------------------------
-- Sesión: anon
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'afiliacion-documentos' $$,
  'anon no puede listar objetos del bucket de afiliación (sin política = niega)'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('afiliacion-documentos', 'x/y.jpg') $$,
  '42501', null,
  'anon no puede subir un archivo al bucket de afiliación'
);

-- ------------------------------------------------------------
-- Sesión: authenticated (admin de prueba, para probar que ni el admin
-- entra directo por RLS de storage)
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'afiliacion-documentos' $$,
  'ni siquiera el admin lee objetos del bucket por RLS directo (se usa service_role + URL firmada desde el servidor)'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('afiliacion-documentos', 'x/y.jpg') $$,
  '42501', null,
  'el admin tampoco puede subir directo por la API; solo el servidor (service role)'
);

-- ------------------------------------------------------------
-- Sesión: service_role (como la Server Action que sube las fotos)
-- ------------------------------------------------------------
reset role;
set local role service_role;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('afiliacion-documentos', 'pgtap/prueba.jpg') $$,
  'service_role sí puede subir al bucket de afiliación'
);

select * from finish();
rollback;
