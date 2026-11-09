-- ============================================================
-- Green Alliance · pgTAP · Fotos de afiliación, documentos del proceso,
-- valores antes/después y «Cambios» (migración 20261108000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('39000000-0000-4000-a000-0000000000ad', 'q.ad@prueba.test', '{"cedula":"3900000100"}', '{"nombre_completo":"Admin Treinta y nueve"}'),
  ('39000000-0000-4000-a000-0000000000ae', 'q.ae@prueba.test', '{"cedula":"3900000101"}', '{"nombre_completo":"Admin Que Atiende"}'),
  ('39000000-0000-4000-a000-00000000000a', 'q.a1@prueba.test', '{"cedula":"3900000001","grado":"PT"}', '{"nombre_completo":"Ana Fotos"}'),
  ('39000000-0000-4000-a000-00000000000b', 'q.a2@prueba.test', '{"cedula":"3900000002","grado":"PT"}', '{"nombre_completo":"Beto Cliente"}');
update public.perfiles set rol = 'admin' where id = '39000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '39000000-0000-4000-a000-0000000000ae';
update public.perfiles set asesor_id = '39000000-0000-4000-a000-0000000000ae' where id = '39000000-0000-4000-a000-00000000000b';

insert into public.solicitudes_afiliacion (
  id, nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, estado
) values
  ('39000000-0000-4000-b000-000000000001', 'Ana', 'Fotos', '3900000001', 'PT', 'policia', '3003900001', '3003900001', 'q.a1@gmail.com',
   'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/frente.jpg',
   'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/reverso.jpg',
   'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie.jpg', now(), 'aprobada'),
  ('39000000-0000-4000-b000-000000000002', 'Beto', 'Cliente', '3900000002', 'PT', 'policia', '3003900002', '3003900002', 'q.a2@gmail.com',
   'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now(), 'aprobada');

-- Archivos «subidos» (las RPC exigen que existan en Storage).
insert into storage.objects (bucket_id, name, metadata) values
  ('afiliacion-documentos', 'solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', '{"size":1000}'),
  ('afiliacion-documentos', 'solicitudes/39000000-0000-4000-b000-000000000002/frente-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg', '{"size":1000}'),
  ('procesos-documentos', '39000000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf', '{"size":250000}'),
  ('procesos-documentos', '39000000-0000-4000-a000-00000000000a/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pdf', '{"size":20000000}');

select is(
  (select public::text || '|' || file_size_limit::text || '|' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'procesos-documentos'),
  'false|10485760|application/pdf', 'bucket procesos-documentos: privado, 10 MB, solo PDF'
);

-- ============================================================
-- B. Fotos de afiliación
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_cambiar_foto_afiliacion('39000000-0000-4000-a000-00000000000a', 'foto_selfie',
       'solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', 'Foto borrosa') $$,
  'P0001', 'Solo un administrador puede cambiar las fotos de un asociado', 'el asociado no cambia fotos');
select is_empty($$ select * from public.historial_fotos_afiliacion $$, 'el asociado no ve el historial de fotos');

set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_cambiar_foto_afiliacion('39000000-0000-4000-a000-00000000000a', 'foto_cedula_frente',
       'solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', 'Foto borrosa') $$,
  'P0001', 'La ruta de la foto no es válida', 'la ruta debe ser del mismo campo');
select throws_ok(
  $$ select public.admin_cambiar_foto_afiliacion('39000000-0000-4000-a000-00000000000a', 'foto_selfie',
       'solicitudes/39000000-0000-4000-b000-000000000001/selfie-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.jpg', 'Foto borrosa') $$,
  'P0001', 'El archivo de la foto no se encontró', 'el archivo debe existir en Storage');
select lives_ok(
  $$ select public.admin_cambiar_foto_afiliacion('39000000-0000-4000-a000-00000000000a', 'foto_selfie',
       'solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', 'Foto borrosa') $$,
  'el admin cambia la selfie');
select throws_ok(
  $$ select public.admin_cambiar_foto_afiliacion('39000000-0000-4000-a000-00000000000a', 'foto_selfie',
       'solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', 'Otra vez') $$,
  'P0001', 'Esa ya es la foto actual', 'no repite la misma foto');
select throws_ok(
  $$ update public.solicitudes_afiliacion set foto_selfie = 'x/otra.jpg' where id = '39000000-0000-4000-b000-000000000001' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación', 'ni el admin cambia fotos por UPDATE directo');
select is(
  (select campo || '|' || ruta_anterior || '|' || ruta_nueva || '|' || motivo from public.historial_fotos_afiliacion
    where asociado_id = '39000000-0000-4000-a000-00000000000a'),
  'foto_selfie|afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie.jpg'
    || '|afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg|Foto borrosa',
  'el historial guarda la foto anterior, la nueva y el motivo');

set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-0000000000ae","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_cambiar_foto_afiliacion('39000000-0000-4000-a000-00000000000b', 'foto_cedula_frente',
       'solicitudes/39000000-0000-4000-b000-000000000002/frente-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg', 'Foto borrosa') $$,
  'P0001', 'Es uno de tus clientes: otro administrador debe cambiar sus fotos', 'no las de sus propios clientes');
reset role;

select is(
  (select foto_selfie from public.solicitudes_afiliacion where id = '39000000-0000-4000-b000-000000000001'),
  'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
  'la afiliación queda con la selfie nueva');
select is(
  (select ruta from public.foto_carne_de_asociado('39000000-0000-4000-a000-00000000000a')),
  'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
  'sin foto propia, el carné usa la selfie nueva');

-- ============================================================
-- A. Valores antes/después
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select lives_ok(
  $$ select public.admin_editar_datos_asociado('39000000-0000-4000-a000-00000000000a', 'Ana Fotos Ruiz', '3001112233', null, null, null, null) $$,
  'el admin edita nombre y celular');
select lives_ok($$ select public.admin_cambiar_cedula('39000000-0000-4000-a000-00000000000a', '3900000999', 'Error de digitación') $$,
  'el admin corrige la cédula');
reset role;
select is(
  (select valores_anteriores ->> 'nombre' || '→' || (valores_nuevos ->> 'celular') from public.historial_cambio_datos_perfil
    where perfil_id = '39000000-0000-4000-a000-00000000000a' and campos = array['nombre', 'celular']),
  'Ana Fotos→3001112233', '«Editar datos» guarda el valor anterior y el nuevo');
select is(
  (select (valores_anteriores ->> 'cedula') || '→' || (valores_nuevos ->> 'cedula') from public.historial_cambio_datos_perfil
    where perfil_id = '39000000-0000-4000-a000-00000000000a' and campos = array['cedula']),
  '3900000001→3900000999', '«Corregir cédula» guarda la anterior y la nueva');

-- ============================================================
-- C. Documentos del proceso
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_registrar_documento_proceso('39000000-0000-4000-a000-00000000000a',
       '39000000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf', 'Demanda') $$,
  'P0001', 'Solo un administrador puede subir documentos del proceso', 'el asociado no sube documentos');

set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_registrar_documento_proceso('39000000-0000-4000-a000-00000000000b',
       '39000000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf', 'Demanda') $$,
  'P0001', 'La ruta del documento no es válida', 'la ruta debe ser del mismo asociado');
select throws_ok(
  $$ select public.admin_registrar_documento_proceso('39000000-0000-4000-a000-00000000000a',
       '39000000-0000-4000-a000-00000000000a/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pdf', 'Demanda') $$,
  'P0001', 'El documento debe pesar máximo 10 MB', 'máximo 10 MB');
select lives_ok(
  $$ select public.admin_registrar_documento_proceso('39000000-0000-4000-a000-00000000000a',
       '39000000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf', '  Demanda   ejecutiva ') $$,
  'el admin sube un PDF');
select is(
  (select nombre || '|' || tamano_bytes::text from public.documentos_proceso where asociado_id = '39000000-0000-4000-a000-00000000000a'),
  'Demanda ejecutiva|250000', 'el admin ve el documento (nombre limpio y tamaño de Storage)');
select throws_ok($$ select ruta from public.documentos_proceso $$, '42501', null, 'la ruta del archivo no se concede');

set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select is_empty($$ select id from public.documentos_proceso $$, 'el asociado no ve los documentos');

set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select is(
  public.admin_quitar_documento_proceso((select id from public.documentos_proceso limit 1), 'Se subió por error'),
  '39000000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf',
  'quitar devuelve la ruta para borrar el archivo');
select throws_ok(
  $$ select public.admin_quitar_documento_proceso((select id from public.documentos_proceso limit 1), 'Otra vez') $$,
  'P0001', 'Ese documento ya no está en el proceso', 'no se quita dos veces');

-- ============================================================
-- D. «Cambios»
-- ============================================================
select is(
  (select array_agg(distinct tipo order by tipo) from public.admin_cambios_asociados('39000000-0000-4000-a000-00000000000a', null, null, null, 50, 1)),
  array['cedula', 'datos', 'documento_quitado', 'documento_subido', 'foto_afiliacion'],
  '«Cambios» junta datos, cédula, fotos y documentos del asociado');
select is(
  (select count(*)::int from public.admin_cambios_asociados(null, 'ana fotos', null, null, 50, 1)
    where asociado_id <> '39000000-0000-4000-a000-00000000000a'),
  0, 'la búsqueda por nombre filtra al asociado');
set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok($$ select * from public.admin_cambios_asociados() $$, '42501', null, 'el asociado no ve «Cambios»');
reset role;

-- ============================================================
-- E. Eliminación: borra fotos del historial, PDF y valores
-- ============================================================
insert into storage.objects (bucket_id, name, metadata) values
  ('procesos-documentos', '39000000-0000-4000-a000-00000000000a/ffffffff-ffff-4fff-8fff-ffffffffffff.pdf', '{"size":5000}');
set local role authenticated;
set local request.jwt.claims = '{"sub":"39000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select public.admin_registrar_documento_proceso('39000000-0000-4000-a000-00000000000a',
  '39000000-0000-4000-a000-00000000000a/ffffffff-ffff-4fff-8fff-ffffffffffff.pdf', 'Liquidación');
reset role;
update public.perfiles set activo = false where id = '39000000-0000-4000-a000-00000000000a';
create temp table ids (k text primary key, v uuid);
insert into ids select 's1', public.admin_solicitar_eliminacion('39000000-0000-4000-a000-0000000000ad',
  '39000000-0000-4000-a000-00000000000a', 'Cumplió su ciclo', repeat('a', 64));
create temp table eliminacion as
  select * from public.admin_confirmar_eliminacion('39000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's1'), repeat('a', 64));
select is(
  (select array[
     'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie.jpg',
     'afiliacion-documentos/solicitudes/39000000-0000-4000-b000-000000000001/selfie-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
     'procesos-documentos/39000000-0000-4000-a000-00000000000a/ffffffff-ffff-4fff-8fff-ffffffffffff.pdf'] <@ archivos
     from eliminacion),
  true, 'la eliminación devuelve la foto anterior, la nueva y el PDF para borrarlos');
select is(
  (select count(*)::int from public.historial_fotos_afiliacion where asociado_id = '39000000-0000-4000-a000-00000000000a')
  + (select count(*)::int from public.documentos_proceso where asociado_id = '39000000-0000-4000-a000-00000000000a')
  + (select count(*)::int from public.historial_cambio_datos_perfil
      where perfil_id = '39000000-0000-4000-a000-00000000000a'
        and (valores_anteriores is not null or valores_nuevos is not null or motivo is not null)),
  0, 'la eliminación borra el historial de fotos, los documentos y los valores');

select * from finish();
rollback;
