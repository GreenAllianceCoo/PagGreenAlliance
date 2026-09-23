-- ============================================================
-- Green Alliance · pgTAP · RLS y protección de campos en perfiles
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- ------------------------------------------------------------
-- Datos de prueba
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-00000000000b', 'asociado.b@prueba.test', '{"cedula":"1000000002","grado":"OF"}', '{"nombre_completo":"Asociado B"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

-- ------------------------------------------------------------
-- Sesión: asociado A
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select id from public.perfiles $$,
  array['00000000-0000-4000-a000-00000000000a'::uuid],
  'A solo ve su propio perfil'
);

select throws_ok(
  $$ update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su propio rol',
  'A no puede cambiarse el rol a admin'
);

select throws_ok(
  $$ update public.perfiles set grado = 'OF' where id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su propio grado; solicítelo a la administración',
  'A no puede cambiarse el grado'
);

select throws_ok(
  $$ update public.perfiles set cedula = '1000000009' where id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su número de cédula',
  'A no puede cambiarse la cédula'
);

select lives_ok(
  $$ update public.perfiles set telefono = '3001234567' where id = '00000000-0000-4000-a000-00000000000a' $$,
  'A puede actualizar su teléfono (sin error)'
);

select is(
  (select telefono from public.perfiles where id = '00000000-0000-4000-a000-00000000000a'),
  '3001234567',
  'el teléfono de A quedó actualizado'
);

with u as (
  update public.perfiles set telefono = '3000000000'
   where id = '00000000-0000-4000-a000-00000000000b' returning 1
) select is(count(*)::int, 0, 'A no puede editar el perfil de B') from u;

select throws_ok(
  $$ insert into public.perfiles (id, cedula, nombre_completo, rol)
     values ('00000000-0000-4000-a000-0000000000ff', '1000000099', 'Intruso', 'admin') $$,
  '42501', null,
  'A no puede insertar perfiles'
);

with d as (
  delete from public.perfiles where id = '00000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 0, 'A no puede borrar su perfil') from d;

select is(
  (select rol::text || '|' || grado::text from public.perfiles where id = '00000000-0000-4000-a000-00000000000a'),
  'asociado|PP',
  'A sigue siendo asociado PP tras los intentos'
);

-- ------------------------------------------------------------
-- Sesión: anon
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.perfiles $$,
  '42501', null,
  'anon no puede leer perfiles'
);

-- ------------------------------------------------------------
-- Sesión: admin
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.perfiles where id in (
     '00000000-0000-4000-a000-00000000000a',
     '00000000-0000-4000-a000-00000000000b',
     '00000000-0000-4000-a000-0000000000ad')),
  3,
  'admin ve todos los perfiles'
);

with u as (
  update public.perfiles set grado = 'IT' where id = '00000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 1, 'admin sí puede cambiar el grado de un asociado') from u;

select * from finish();
rollback;
