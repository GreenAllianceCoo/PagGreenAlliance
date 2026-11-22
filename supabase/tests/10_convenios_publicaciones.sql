-- ============================================================
-- Green Alliance · pgTAP · Módulo de convenios (B1)
-- Cuentas de convenio, correo_por_nit, convenio_publicaciones (RLS,
-- guardas y topes), métricas y bucket convenios-publicaciones.
-- Migración: 20261121000000_convenios_publicaciones.sql
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

-- ------------------------------------------------------------
-- Datos de prueba (como postgres, antes de bajar de rol)
-- NIT ficticios (811…, 822…, 833…) para no chocar con los reales.
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}', '{"nombre_completo":"Admin Prueba"}'),
  ('00000000-0000-4000-a000-00000000005e', 'secre@prueba.test',      '{"cedula":"1000000004"}', '{"nombre_completo":"Secretario Prueba"}'),
  ('c1000000-0000-4000-a000-0000000000c1', 'conv1@prueba.test',      '{}', '{"nombre_completo":"Convenio Uno"}'),
  ('c2000000-0000-4000-a000-0000000000c2', 'conv2@prueba.test',      '{}', '{"nombre_completo":"Convenio Dos"}'),
  ('c3000000-0000-4000-a000-0000000000c3', 'conv3@prueba.test',      '{}', '{"nombre_completo":"Convenio Tres"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'secretario' where id = '00000000-0000-4000-a000-00000000005e';

insert into public.convenios (id, nombre_empresa, nit, visible) values
  ('41000000-0000-4000-a000-000000000001', 'Convenio Uno S.A.S.',  '811.111.111-' || public.dv_nit('811111111'), true),
  ('41000000-0000-4000-a000-000000000002', 'Convenio Dos S.A.S.',  '822.222.222-' || public.dv_nit('822222222'), true),
  ('41000000-0000-4000-a000-000000000003', 'Convenio Tres S.A.S.', '833.333.333-' || public.dv_nit('833333333'), true);

select public.vincular_cuenta_convenio('41000000-0000-4000-a000-000000000001', 'c1000000-0000-4000-a000-0000000000c1', 'conv1@prueba.test');
select public.vincular_cuenta_convenio('41000000-0000-4000-a000-000000000002', 'c2000000-0000-4000-a000-0000000000c2', 'conv2@prueba.test');
select public.vincular_cuenta_convenio('41000000-0000-4000-a000-000000000003', 'c3000000-0000-4000-a000-0000000000c3', 'conv3@prueba.test');

-- Publicaciones de partida (k1: vigente, programada, vencida, oculta; k2: vigente; k3: vigente).
insert into public.convenio_publicaciones (id, convenio_id, tipo, titulo, descripcion, imagenes, pdf_path, inicia_el, termina_el, oculta_en) values
  ('50000000-0000-4000-a000-000000000001', '41000000-0000-4000-a000-000000000001', 'promocion', 'Vigente', 'x',
   array['41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000001/a.webp'], null,
   public.hoy_bogota() - 1, public.hoy_bogota() + 5, null),
  ('50000000-0000-4000-a000-000000000002', '41000000-0000-4000-a000-000000000001', 'promocion', 'Programada', 'x',
   array['41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000002/a.webp'], null,
   public.hoy_bogota() + 3, public.hoy_bogota() + 10, null),
  ('50000000-0000-4000-a000-000000000003', '41000000-0000-4000-a000-000000000001', 'promocion', 'Vencida', 'x',
   array['41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000003/a.webp'], null,
   public.hoy_bogota() - 10, public.hoy_bogota() - 1, null),
  ('50000000-0000-4000-a000-000000000004', '41000000-0000-4000-a000-000000000001', 'catalogo', 'Oculta', null,
   '{}', '41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000004/c.pdf',
   null, null, now()),
  ('50000000-0000-4000-a000-000000000005', '41000000-0000-4000-a000-000000000002', 'catalogo', 'Catálogo dos', null,
   array['41000000-0000-4000-a000-000000000002/50000000-0000-4000-a000-000000000005/a.webp'], null,
   null, null, null),
  ('50000000-0000-4000-a000-000000000006', '41000000-0000-4000-a000-000000000003', 'promocion', 'De un convenio eliminado', 'x',
   array['41000000-0000-4000-a000-000000000003/50000000-0000-4000-a000-000000000006/a.webp'], null,
   public.hoy_bogota() - 1, public.hoy_bogota() + 5, null);

insert into storage.objects (bucket_id, name) values
  ('convenios-publicaciones', '41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000001/a.webp'),
  ('convenios-publicaciones', '41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000004/c.pdf');

-- ------------------------------------------------------------
-- Como postgres: NIT, cuentas, bucket y convenio eliminado
-- ------------------------------------------------------------
select is(public.dv_nit('860007322'), 9, 'dv_nit calcula el DV DIAN (860.007.322-9)');
select is(public.dv_nit('902038118'), 7, 'dv_nit calcula el DV DIAN (902.038.118-7)');

select is(
  (select rol::text from public.perfiles where id = 'c1000000-0000-4000-a000-0000000000c1'),
  'convenio',
  'vincular_cuenta_convenio deja el perfil con rol convenio'
);

select is(public.correo_por_nit('811111111'), 'conv1@prueba.test', 'correo_por_nit acepta el NIT sin DV');
select is(public.correo_por_nit('811.111.111-' || public.dv_nit('811111111')), 'conv1@prueba.test',
  'correo_por_nit acepta el NIT con puntos y guion');
select is(public.correo_por_nit('811111111' || public.dv_nit('811111111')), 'conv1@prueba.test',
  'correo_por_nit acepta el NIT con el DV pegado');
select is(public.correo_por_nit('811111111' || ((public.dv_nit('811111111') + 1) % 10)), null,
  'correo_por_nit rechaza un DV pegado que no coincide');

select throws_ok(
  $$ select public.vincular_cuenta_convenio('41000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test') $$,
  'P0001', 'Ese correo ya pertenece a otra cuenta de Green Alliance',
  'vincular_cuenta_convenio nunca convierte a un asociado real'
);

select is(
  (select public from storage.buckets where id = 'convenios-publicaciones'),
  false,
  'el bucket convenios-publicaciones es privado'
);

update public.convenios set eliminado_en = now(), visible = true where id = '41000000-0000-4000-a000-000000000003';
select is(
  (select visible from public.convenios where id = '41000000-0000-4000-a000-000000000003'),
  false,
  'un convenio eliminado queda no visible aunque se pida visible'
);
select is(public.correo_por_nit('833333333'), null, 'correo_por_nit no responde para un convenio eliminado');

-- ------------------------------------------------------------
-- Sesión: anon
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select 1 from public.convenio_publicaciones $$, '42501', null,
  'anon no puede leer publicaciones');
select throws_ok($$ select public.correo_por_nit('811111111') $$, '42501', null,
  'anon no puede llamar correo_por_nit');
select throws_ok($$ select 1 from public.convenio_cuentas $$, '42501', null,
  'anon no puede leer las cuentas de convenio');

-- ------------------------------------------------------------
-- Sesión: convenio 1
-- ------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-4000-a000-0000000000c1","role":"authenticated"}';

select is(public.convenio_del_usuario(), '41000000-0000-4000-a000-000000000001'::uuid,
  'convenio_del_usuario devuelve el convenio de la cuenta');
select is((select count(*)::int from public.convenio_publicaciones), 4,
  'el convenio ve solo sus 4 publicaciones (incluidas vencida y oculta)');
select throws_ok($$ select public.correo_por_nit('811111111') $$, '42501', null,
  'un usuario con sesión no puede llamar correo_por_nit');

-- Tope: ya tiene 2 promociones contando (vigente + programada); sube 8 más.
select lives_ok(
  $$ insert into public.convenio_publicaciones (id, convenio_id, tipo, titulo, descripcion, imagenes, inicia_el, termina_el)
     select g.id, '41000000-0000-4000-a000-000000000001', 'promocion', 'Promo ' || g.n, 'x',
            array['41000000-0000-4000-a000-000000000001/' || g.id || '/a.webp'],
            public.hoy_bogota(), public.hoy_bogota() + 5
     from (select gen_random_uuid() as id, n from generate_series(1, 8) as n) g $$,
  'el convenio publica sus propias promociones hasta 10'
);
select throws_ok(
  $$ insert into public.convenio_publicaciones (id, convenio_id, tipo, titulo, descripcion, imagenes, inicia_el, termina_el)
     values ('50000000-0000-4000-a000-0000000000aa', '41000000-0000-4000-a000-000000000001', 'promocion', 'Once', 'x',
             array['41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-0000000000aa/a.webp'],
             public.hoy_bogota(), public.hoy_bogota() + 5) $$,
  'P0001', null,
  'la promoción número 11 se rechaza (tope de 10)'
);
select throws_ok(
  $$ insert into public.convenio_publicaciones (id, convenio_id, tipo, titulo, imagenes)
     values ('50000000-0000-4000-a000-0000000000ab', '41000000-0000-4000-a000-000000000002', 'catalogo', 'Ajeno',
             array['41000000-0000-4000-a000-000000000002/50000000-0000-4000-a000-0000000000ab/a.webp']) $$,
  '42501', null,
  'el convenio no puede publicar a nombre de otro'
);
select throws_ok(
  $$ insert into public.convenio_publicaciones (id, convenio_id, tipo, titulo, imagenes, oculta_en)
     values ('50000000-0000-4000-a000-0000000000ac', '41000000-0000-4000-a000-000000000001', 'catalogo', 'Oculto',
             array['41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-0000000000ac/a.webp'], now()) $$,
  'P0001', 'Solo Green Alliance puede ocultar una publicación',
  'el convenio no puede crear una publicación oculta'
);

with u as (
  update public.convenio_publicaciones set oculta_en = null
  where id = '50000000-0000-4000-a000-000000000004' returning 1
) select is(count(*)::int, 0, 'el convenio no puede volver a mostrar una oculta') from u;

with d as (
  delete from public.convenio_publicaciones where id = '50000000-0000-4000-a000-000000000004' returning 1
) select is(count(*)::int, 0, 'el convenio no puede borrar una oculta') from d;

with u as (
  update public.convenio_publicaciones set titulo = 'Vigente editada'
  where id = '50000000-0000-4000-a000-000000000001' returning 1
) select is(count(*)::int, 1, 'el convenio edita sus publicaciones visibles') from u;

select throws_ok(
  $$ update public.convenio_publicaciones set oculta_en = now() where id = '50000000-0000-4000-a000-000000000001' $$,
  'P0001', 'Solo Green Alliance puede ocultar o volver a mostrar una publicación',
  'el convenio no puede ocultar por su cuenta'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('convenios-publicaciones', '41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-0000000000ff/b.webp') $$,
  'el convenio sube archivos a su carpeta'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('convenios-publicaciones', '41000000-0000-4000-a000-000000000002/50000000-0000-4000-a000-0000000000ff/b.webp') $$,
  '42501', null,
  'el convenio no sube archivos a la carpeta de otro'
);

-- ------------------------------------------------------------
-- Sesión: convenio 2
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c2000000-0000-4000-a000-0000000000c2","role":"authenticated"}';

select is((select count(*)::int from public.convenio_publicaciones), 1,
  'el convenio 2 no ve las publicaciones del convenio 1');
with u as (
  update public.convenio_publicaciones set titulo = 'Hackeada'
  where id = '50000000-0000-4000-a000-000000000001' returning 1
) select is(count(*)::int, 0, 'el convenio 2 no edita publicaciones del convenio 1') from u;

-- ------------------------------------------------------------
-- Sesión: asociado
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select set_eq(
  $$ select id from public.convenio_publicaciones
     where id in ('50000000-0000-4000-a000-000000000001', '50000000-0000-4000-a000-000000000002',
                  '50000000-0000-4000-a000-000000000003', '50000000-0000-4000-a000-000000000004',
                  '50000000-0000-4000-a000-000000000005', '50000000-0000-4000-a000-000000000006') $$,
  $$ values ('50000000-0000-4000-a000-000000000001'::uuid), ('50000000-0000-4000-a000-000000000005'::uuid) $$,
  'el asociado ve solo las vigentes de convenios activos (no programadas, vencidas, ocultas ni de eliminados)'
);
select throws_ok(
  $$ insert into public.convenio_publicaciones (id, convenio_id, tipo, titulo, imagenes)
     values ('50000000-0000-4000-a000-0000000000ad', '41000000-0000-4000-a000-000000000001', 'catalogo', 'Del asociado',
             array['41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-0000000000ad/a.webp']) $$,
  '42501', null,
  'el asociado no puede publicar'
);
with u as (
  update public.convenio_publicaciones set titulo = 'Cambiada'
  where id = '50000000-0000-4000-a000-000000000001' returning 1
) select is(count(*)::int, 0, 'el asociado no edita publicaciones') from u;

select lives_ok(
  $$ select public.registrar_evento_publicacion('50000000-0000-4000-a000-000000000001', 'vista'),
            public.registrar_evento_publicacion('50000000-0000-4000-a000-000000000001', 'vista'),
            public.registrar_evento_publicacion('50000000-0000-4000-a000-000000000001', 'whatsapp') $$,
  'el asociado registra vistas y clics de una publicación vigente'
);
select throws_ok(
  $$ select public.registrar_evento_publicacion('50000000-0000-4000-a000-000000000004', 'vista') $$,
  'P0001', 'La publicación no está disponible',
  'no se registran vistas de una publicación oculta'
);
select throws_ok($$ select 1 from public.convenio_publicacion_eventos $$, '42501', null,
  'el asociado no lee la tabla de eventos');
select is_empty($$ select 1 from public.convenio_cuentas $$,
  'el asociado no ve las cuentas de convenio');

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'convenios-publicaciones'
     and name = '41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000001/a.webp'),
  1,
  'el asociado puede leer el archivo de una publicación vigente'
);
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'convenios-publicaciones'
     and name = '41000000-0000-4000-a000-000000000001/50000000-0000-4000-a000-000000000004/c.pdf'),
  0,
  'el asociado no puede leer el archivo de una publicación oculta'
);

-- ------------------------------------------------------------
-- Sesión: secretario
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000005e","role":"authenticated"}';

with u as (
  update public.convenio_publicaciones set oculta_en = now(), oculta_motivo = 'Prueba'
  where id = '50000000-0000-4000-a000-000000000005' returning oculta_por
) select is(
  (select oculta_por from u),
  '00000000-0000-4000-a000-00000000005e'::uuid,
  'el secretario oculta una publicación y queda como quien la ocultó'
);
select throws_ok(
  $$ update public.convenio_publicaciones set titulo = 'Cambio de staff' where id = '50000000-0000-4000-a000-000000000001' $$,
  'P0001', 'Green Alliance solo puede ocultar o volver a mostrar una publicación',
  'el staff no puede cambiar el contenido'
);

-- ------------------------------------------------------------
-- Sesión: admin
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.convenio_publicaciones
   where id::text like '50000000-0000-4000-a000-00000000000_'),
  6,
  'el admin ve todas las publicaciones'
);
with u as (
  update public.convenio_publicaciones set oculta_en = null
  where id = '50000000-0000-4000-a000-000000000005' returning oculta_motivo
) select is((select oculta_motivo from u), null, 'el admin vuelve a mostrar y se borra el motivo');
with d as (
  delete from public.convenio_publicaciones where id = '50000000-0000-4000-a000-000000000001' returning 1
) select is(count(*)::int, 0, 'el admin no borra publicaciones') from d;
select is(
  (select count(*)::int from public.convenio_cuentas
   where convenio_id::text like '41000000-0000-4000-a000-00000000000_'),
  3,
  'el admin ve las cuentas de convenio'
);

-- ------------------------------------------------------------
-- Métricas y convenio eliminado
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c1000000-0000-4000-a000-0000000000c1","role":"authenticated"}';

select results_eq(
  $$ select vistas, vistas_unicas, clics, clics_unicos from public.metricas_publicaciones()
     where publicacion_id = '50000000-0000-4000-a000-000000000001' $$,
  $$ values (2::bigint, 1::bigint, 1::bigint, 1::bigint) $$,
  'el convenio ve vistas y clics, totales y únicos'
);

set local request.jwt.claims = '{"sub":"c2000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.metricas_publicaciones() where publicacion_id = '50000000-0000-4000-a000-000000000001' $$,
  'el convenio 2 no ve las métricas del convenio 1'
);

set local request.jwt.claims = '{"sub":"c3000000-0000-4000-a000-0000000000c3","role":"authenticated"}';
select is(public.convenio_del_usuario(), null, 'la cuenta de un convenio eliminado queda sin convenio');
select is((select count(*)::int from public.convenio_publicaciones), 0,
  'la cuenta de un convenio eliminado no ve ni sus publicaciones');

select * from finish();
rollback;
