-- ============================================================
-- Green Alliance · pgTAP · Foto del asociado en el carné (20261003200000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('30000000-0000-4000-a000-0000000000ad', 'f.ad@prueba.test', '{"cedula":"3000000009","grado":"PT"}', '{"nombre_completo":"Admin F"}'),
  ('30000000-0000-4000-a000-00000000000a', 'f.a@prueba.test',  '{"cedula":"3000000001","grado":"PT"}', '{"nombre_completo":"Asociado A Foto"}'),
  ('30000000-0000-4000-a000-00000000000b', 'f.b@prueba.test',  '{"cedula":"3000000002","grado":"PT"}', '{"nombre_completo":"Asociado B Sin Foto"}'),
  ('30000000-0000-4000-a000-00000000000c', 'f.c@prueba.test',  '{"cedula":"3000000003","grado":"PT"}', '{"nombre_completo":"Asociado C Inactivo"}');
update public.perfiles set rol = 'admin' where id = '30000000-0000-4000-a000-0000000000ad';
update public.perfiles set activo = false where id in ('30000000-0000-4000-a000-00000000000c');

-- Selfie de afiliación aprobada de A (con y sin el prefijo del bucket) y de C
insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, estado
) values
  ('Asociado', 'Alvarez', '3000000001', 'PT', 'policia', '3002000001', '3002000001', 'f.a@gmail.com',
   'solicitudes/30a/f.jpg', 'solicitudes/30a/r.jpg', 'solicitudes/30a/s.jpg', now(), 'aprobada'),
  ('Asociado', 'Castro', '3000000003', 'PT', 'policia', '3002000003', '3002000003', 'f.c@gmail.com',
   'solicitudes/30c/f.jpg', 'solicitudes/30c/r.jpg', 'afiliacion-documentos/solicitudes/30c/s.jpg', now(), 'aprobada');

insert into public.carne_tokens (asociado_id, token) values
  ('30000000-0000-4000-a000-00000000000a', '30000000-aaaa-4000-a000-00000000000a'),
  ('30000000-0000-4000-a000-00000000000b', '30000000-aaaa-4000-a000-00000000000b'),
  ('30000000-0000-4000-a000-00000000000c', '30000000-aaaa-4000-a000-00000000000c');

-- ------------------------------------------------------------
-- Estructura y permisos
-- ------------------------------------------------------------
select is(
  (select public::text || '|' || file_size_limit::text || '|' || array_to_string(allowed_mime_types, ',')
     from storage.buckets where id = 'fotos-carne'),
  'false|5242880|image/jpeg,image/png,image/webp', 'bucket fotos-carne: privado, 5 MB, JPG/PNG/WEBP'
);
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and qual ilike '%fotos-carne%' $$,
  'el bucket no tiene políticas: solo el servidor lo toca'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.fotos_carne'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.historial_foto_carne'::regclass),
  'las 2 tablas tienen RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.fotos_carne', 'select')
  and not has_table_privilege('anon', 'public.fotos_carne', 'select')
  and not has_table_privilege('authenticated', 'public.historial_foto_carne', 'select')
  and not has_table_privilege('authenticated', 'public.fotos_carne', 'insert'),
  'ni authenticated ni anon leen ni escriben las tablas'
);
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('foto_carne_de_asociado', 'foto_carne_por_token', 'registrar_foto_carne', 'quitar_foto_carne')
        and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')) $$,
  'las 4 funciones no las ejecuta ni authenticated ni anon'
);
select ok(
  has_function_privilege('service_role', 'public.foto_carne_de_asociado(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.foto_carne_por_token(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.registrar_foto_carne(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.quitar_foto_carne(uuid)', 'execute'),
  'service_role sí las ejecuta'
);

-- ------------------------------------------------------------
-- Qué foto sale
-- ------------------------------------------------------------
select is(
  (select ruta || '|' || origen from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000a')),
  'afiliacion-documentos/solicitudes/30a/s.jpg|afiliacion', 'sin foto propia: la selfie de la afiliación'
);
select is(
  (select ruta from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000c')),
  'afiliacion-documentos/solicitudes/30c/s.jpg', 'la ruta de la selfie no duplica el prefijo del bucket'
);
select is_empty(
  $$ select * from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000b') $$,
  'sin selfie ni foto propia: sin foto'
);
-- Una afiliación rechazada o pendiente no cuenta
update public.solicitudes_afiliacion set estado = 'rechazada' where cedula = '3000000001';
select is_empty(
  $$ select * from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000a') $$,
  'una afiliación que no está aprobada no aporta foto'
);
update public.solicitudes_afiliacion set estado = 'aprobada' where cedula = '3000000001';

-- ------------------------------------------------------------
-- Guardar la foto propia
-- ------------------------------------------------------------
select throws_ok(
  $$ select public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
       '30000000-0000-4000-a000-00000000000b/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg') $$,
  'P0001', 'La ruta de la foto no es válida', 'no acepta una ruta de otro asociado'
);
select throws_ok(
  $$ select public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
       '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.gif') $$,
  'P0001', 'La ruta de la foto no es válida', 'no acepta otras extensiones'
);
select throws_ok(
  $$ select public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
       '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg') $$,
  'P0001', 'El archivo de la foto no se encontró', 'el archivo debe existir en Storage'
);
insert into storage.objects (bucket_id, name, owner) values
  ('fotos-carne', '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', null),
  ('fotos-carne', '30000000-0000-4000-a000-00000000000a/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png', null),
  ('fotos-carne', '30000000-0000-4000-a000-00000000000c/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg', null);
select is(
  public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
    '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'),
  null, 'la primera foto no tiene anterior'
);
select is(
  (select ruta || '|' || origen from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000a')),
  'fotos-carne/30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg|propia',
  'la foto propia reemplaza a la selfie'
);
select is(
  public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
    '30000000-0000-4000-a000-00000000000a/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png'),
  '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
  'reemplazar devuelve la ruta anterior (para borrarla de Storage)'
);
select is(
  (select count(*)::int from public.fotos_carne where asociado_id = '30000000-0000-4000-a000-00000000000a'),
  1, 'una sola foto por asociado'
);
select is(
  (select string_agg(accion, ',' order by id) from public.historial_foto_carne where asociado_id = '30000000-0000-4000-a000-00000000000a'),
  'subida,reemplazo', 'el log distingue subida de reemplazo'
);
select throws_ok(
  $$ select public.registrar_foto_carne('30000000-0000-4000-a000-00000000000c',
       '30000000-0000-4000-a000-00000000000c/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg') $$,
  'P0001', 'No se puede guardar la foto de este usuario', 'un asociado inactivo no cambia su foto'
);
select throws_ok(
  $$ select public.registrar_foto_carne('30000000-0000-4000-a000-0000000000ad',
       '30000000-0000-4000-a000-0000000000ad/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg') $$,
  'P0001', 'No se puede guardar la foto de este usuario', 'un admin no usa esta función'
);
-- Tope: 5 cambios por hora (ya van 2)
insert into public.historial_foto_carne (asociado_id, accion)
select '30000000-0000-4000-a000-00000000000a', 'reemplazo' from generate_series(1, 3);
select throws_ok(
  $$ select public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
       '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg') $$,
  'P0001', 'Cambiaste la foto muchas veces seguidas', 'tope de 5 cambios por hora'
);
delete from public.historial_foto_carne where asociado_id = '30000000-0000-4000-a000-00000000000a';

-- ------------------------------------------------------------
-- Verificación pública por token
-- ------------------------------------------------------------
select is(
  (select origen from public.foto_carne_por_token('30000000-aaaa-4000-a000-00000000000a')),
  'propia', 'token válido y asociado activo: sale su foto'
);
select is_empty(
  $$ select * from public.foto_carne_por_token('30000000-aaaa-4000-a000-00000000000c') $$,
  'asociado inactivo: no sale la foto aunque el token exista'
);
select is_empty(
  $$ select * from public.foto_carne_por_token('30000000-aaaa-4000-a000-00000000000b') $$,
  'activo pero sin foto: sin foto'
);
select is_empty(
  $$ select * from public.foto_carne_por_token('99999999-aaaa-4000-a000-00000000000a') $$,
  'token inexistente (o regenerado): sin foto'
);
select is_empty(
  $$ select * from public.foto_carne_por_token(null) $$,
  'token nulo: sin foto'
);

-- ------------------------------------------------------------
-- Quitar la foto propia (vuelve a la selfie)
-- ------------------------------------------------------------
select is(
  public.quitar_foto_carne('30000000-0000-4000-a000-00000000000a'),
  '30000000-0000-4000-a000-00000000000a/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
  'quitar devuelve la ruta para borrar el archivo'
);
select is(
  (select origen from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000a')),
  'afiliacion', 'tras quitarla, vuelve la selfie de la afiliación'
);
select is(public.quitar_foto_carne('30000000-0000-4000-a000-00000000000a'), null, 'quitar sin foto propia no falla');
select is(
  (select accion from public.historial_foto_carne where asociado_id = '30000000-0000-4000-a000-00000000000a' order by id desc limit 1),
  'quitada', 'el log registra «quitada»'
);

-- ------------------------------------------------------------
-- Eliminar definitivamente: borra la foto de carné y devuelve su archivo
-- ------------------------------------------------------------
select public.registrar_foto_carne('30000000-0000-4000-a000-00000000000a',
  '30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg');
update public.perfiles set activo = false where id = '30000000-0000-4000-a000-00000000000a';
create temp table ids (k text primary key, v uuid);
insert into ids select 's1', public.admin_solicitar_eliminacion('30000000-0000-4000-a000-0000000000ad',
  '30000000-0000-4000-a000-00000000000a', 'Cumplió su ciclo', repeat('a', 64));
select is(
  (select 'fotos-carne/30000000-0000-4000-a000-00000000000a/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' = any(archivos)
     from public.admin_confirmar_eliminacion('30000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's1'), repeat('a', 64))),
  true, 'la eliminación devuelve el archivo de la foto del carné para borrarlo'
);
select is(
  (select count(*)::int from public.fotos_carne where asociado_id = '30000000-0000-4000-a000-00000000000a')
  + (select count(*)::int from public.historial_foto_carne where asociado_id = '30000000-0000-4000-a000-00000000000a'),
  0, 'la eliminación borra la foto y su log'
);
select is_empty(
  $$ select * from public.foto_carne_de_asociado('30000000-0000-4000-a000-00000000000a') $$,
  'un asociado eliminado no tiene foto'
);

select * from finish();
rollback;
