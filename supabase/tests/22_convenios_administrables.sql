-- ============================================================
-- Green Alliance · pgTAP · convenios administrables (20261002000000)
-- y F2-08 (nombre de afiliación siempre compuesto).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000022a1', 'asoc22@prueba.test',  '{"cedula":"1000002201","grado":"PT"}', '{"nombre_completo":"Asociado 22"}'),
  ('00000000-0000-4000-a000-0000000022ad', 'admin22@prueba.test', '{"cedula":"1000002203"}',             '{"nombre_completo":"Admin 22"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000022ad';

insert into public.convenios (id, nombre_empresa, visible) values
  ('42000000-0000-4000-a000-000000000001', 'Oculto 22 S.A.S.', false);

-- ------------------------------------------------------------
-- Esquema y siembra
-- ------------------------------------------------------------
select has_column('public', 'convenios', c, 'convenios.' || c)
  from unnest(array['orden','visible','logo_path','video_url','pdf_url','pdf_tamano','creado_en','actualizado_en']) c;
select is(
  (select string_agg(nit, ',' order by orden) from public.convenios
    where nit in ('902.038.118-7','901.865.816-3','1.090.464.475-4','1.054.095.149-3','52.953.735-3')),
  '902.038.118-7,901.865.816-3,1.090.464.475-4,1.054.095.149-3,52.953.735-3',
  'orden sembrado igual a lib/convenios.ts'
);
select is(
  (select pdf_url || '|' || pdf_tamano from public.convenios where nit = '1.054.095.149-3'),
  '/convenios/racing-tours-presentacion.pdf|3 MB', 'Racing Tours: PDF sembrado'
);
select is(
  (select video_url from public.convenios where nit = '902.038.118-7'),
  '/convenios/amb-movil.mp4', 'AMB Móvil: video sembrado'
);
select is((select activo from public.convenios where id = '42000000-0000-4000-a000-000000000001'), false,
  'activo es espejo de visible');
update public.convenios set activo = true where id = '42000000-0000-4000-a000-000000000001';
select is((select visible from public.convenios where id = '42000000-0000-4000-a000-000000000001'), true,
  'código viejo que cambia activo también cambia visible');
update public.convenios set visible = false where id = '42000000-0000-4000-a000-000000000001';
select throws_ok(
  $$ update public.convenios set logo_path = '../x.png' where id = '42000000-0000-4000-a000-000000000001' $$,
  '23514', null, 'logo_path sin ..'
);
select is(
  (select public::text || '|' || file_size_limit || '|' || array_to_string(allowed_mime_types, ',')
     from storage.buckets where id = 'convenios-logos'),
  'true|1048576|image/png,image/jpeg,image/webp', 'bucket convenios-logos público, 1 MB, solo imágenes'
);

-- ------------------------------------------------------------
-- anon
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is_empty($$ select 1 from public.convenios where id = '42000000-0000-4000-a000-000000000001' $$,
  'anon no ve convenios ocultos');
select isnt_empty($$ select 1 from public.convenios where nit = '902.038.118-7' $$, 'anon ve los visibles');
select throws_ok($$ select creado_en from public.convenios $$, '42501', null, 'anon no lee columnas fuera de la lista');
select throws_ok($$ insert into public.convenios (nombre_empresa) values ('X') $$, '42501', null, 'anon no inserta');
reset role;

-- ------------------------------------------------------------
-- asociado
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000022a1","role":"authenticated"}';
select is_empty($$ select 1 from public.convenios where id = '42000000-0000-4000-a000-000000000001' $$,
  'asociado no ve convenios ocultos');
update public.convenios set orden = 1 where nit = '902.038.118-7';
reset role;
select is((select orden from public.convenios where nit = '902.038.118-7'), 10, 'asociado no edita convenios');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000022a1","role":"authenticated"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('convenios-logos', 'x.png') $$,
  '42501', null, 'asociado no sube logos'
);

-- ------------------------------------------------------------
-- admin
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000022ad","role":"authenticated"}';
select isnt_empty($$ select 1 from public.convenios where id = '42000000-0000-4000-a000-000000000001' $$,
  'admin ve los ocultos');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('convenios-logos', 'prueba22.png') $$,
  'admin sube logos'
);
reset role;

-- ------------------------------------------------------------
-- F2-08
-- ------------------------------------------------------------
select is(
  (select tgtype::int & 16 > 0 and pg_get_triggerdef(oid) like '%UPDATE OF nombres, apellidos, nombre%'
     from pg_trigger where tgname = 'tr_componer_nombre_afiliacion'),
  true, 'tr_componer_nombre_afiliacion cubre update de nombre (F2-08)'
);

select * from finish();
rollback;
