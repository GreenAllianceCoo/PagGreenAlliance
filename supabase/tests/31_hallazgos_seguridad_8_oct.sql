-- ============================================================
-- Green Alliance · pgTAP · Hallazgos de la revisión de seguridad del 8-oct
-- (migración 20261009000000): H-01 (WhatsApp de convenios), H-02 (cédula exacta
-- en la búsqueda general) y H-07 (no desactivar admins).
-- H-03 y H-05 (recuperación de acceso) se prueban en 27_recuperacion_acceso.sql.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('31000000-0000-4000-a000-0000000000ad', 'h.ad@prueba.test', '{"cedula":"3100000100"}', '{"nombre_completo":"Admin Treinta y uno"}'),
  ('31000000-0000-4000-a000-0000000000ae', 'h.ae@prueba.test', '{"cedula":"3100000101"}', '{"nombre_completo":"Otro Admin Treinta y uno"}'),
  ('31000000-0000-4000-a000-0000000000e1', 'h.as@prueba.test', '{"cedula":"3100000102"}', '{"nombre_completo":"Asesor Treinta y uno"}'),
  ('31000000-0000-4000-a000-00000000000a', 'h.a1@prueba.test', '{"cedula":"3100000001","grado":"PT"}', '{"nombre_completo":"Ana Exacta"}'),
  ('31000000-0000-4000-a000-00000000000b', 'h.a2@prueba.test', '{"cedula":"3100000012","grado":"PT"}', '{"nombre_completo":"Beto Parecido"}');
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '31000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'admin' where id = '31000000-0000-4000-a000-0000000000ae';
update public.perfiles set rol = 'asesor' where id = '31000000-0000-4000-a000-0000000000e1';

insert into public.convenios (id, nombre_empresa, telefono_contacto, visible) values
  ('43000000-0000-4000-a000-000000000001', 'Convenio Treinta y uno S.A.S.', '3001234567', true);

-- ------------------------------------------------------------
-- H-01: anon no lee el WhatsApp; con sesión sí
-- ------------------------------------------------------------
select ok(not has_column_privilege('anon', 'public.convenios', 'telefono_contacto', 'select'),
  'H-01: anon no tiene select sobre telefono_contacto');
select ok(has_column_privilege('anon', 'public.convenios', 'nombre_empresa', 'select'),
  'H-01: anon sigue leyendo las columnas comerciales');
select ok(has_column_privilege('authenticated', 'public.convenios', 'telefono_contacto', 'select'),
  'H-01: authenticated sí lee telefono_contacto');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select telefono_contacto from public.convenios $$, '42501', null,
  'H-01: anon pidiendo telefono_contacto recibe permiso denegado');
select isnt_empty($$ select nombre_empresa, nit, logo_path from public.convenios where visible $$,
  'H-01: anon lee los convenios visibles sin el WhatsApp');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select is(
  (select telefono_contacto from public.convenios where id = '43000000-0000-4000-a000-000000000001'),
  '3001234567', 'H-01: el asociado con sesión ve el WhatsApp del convenio visible'
);
reset role;

-- ------------------------------------------------------------
-- H-02: la búsqueda por cédula es exacta
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is((select count(*)::int from public.buscar_asociados_general('3100000001')), 1,
  'H-02: la cédula completa encuentra al asociado');
select is((select count(*)::int from public.buscar_asociados_general('3.100.000.001')), 1,
  'H-02: la cédula con puntos se normaliza y sigue siendo exacta');
select is((select count(*)::int from public.buscar_asociados_general('0000001')), 0,
  'H-02: un fragmento de 7 dígitos no devuelve nada (antes coincidía por «like»)');
select is((select count(*)::int from public.buscar_asociados_general('310000')), 0,
  'H-02: un prefijo de 6 dígitos que no es una cédula no devuelve nada');
select is((select count(*)::int from public.buscar_asociados_general('31000')), 0,
  'H-02: menos de 6 dígitos no devuelve nada');
select is((select count(*)::int from public.buscar_asociados_general('31000000012')), 0,
  'H-02: más de 10 dígitos no devuelve nada');
reset role;

-- ------------------------------------------------------------
-- H-07: un admin no desactiva a otro admin
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok(
  $$ select * from public.admin_cambiar_estado_asociado('31000000-0000-4000-a000-0000000000ae', false, 'Intento de baja a un admin') $$,
  'P0001', 'No se puede desactivar a un administrador desde la app; pídelo al equipo técnico',
  'H-07: no se desactiva a otro administrador'
);
select lives_ok(
  $$ select * from public.admin_cambiar_estado_asociado('31000000-0000-4000-a000-00000000000b', false, 'Baja de un asociado normal') $$,
  'H-07: dar de baja a un asociado sigue funcionando'
);
reset role;

-- Un admin que quedó inactivo (por SQL del equipo técnico) sí se puede reactivar desde la app
select set_config('request.jwt.claims', '', true);
update public.perfiles set activo = false where id = '31000000-0000-4000-a000-0000000000ae';
set local role authenticated;
set local request.jwt.claims = '{"sub":"31000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select lives_ok(
  $$ select * from public.admin_cambiar_estado_asociado('31000000-0000-4000-a000-0000000000ae', true, 'Reactivación de un admin') $$,
  'H-07: reactivar a un administrador inactivo sí se permite'
);
reset role;

select * from finish();
rollback;
