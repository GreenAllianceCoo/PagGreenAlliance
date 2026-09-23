-- ============================================================
-- Green Alliance · pgTAP · limites_intentos / registrar_intento()
-- Límite de frecuencia que usan /afiliacion e /ingresar.
-- Solo service_role ejecuta la función; nadie lee la tabla por la API.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'limites_intentos', 'existe la tabla limites_intentos');

select ok(
  not has_function_privilege('anon', 'public.registrar_intento(text, integer, integer)', 'execute'),
  'anon no puede ejecutar registrar_intento'
);
select ok(
  not has_function_privilege('authenticated', 'public.registrar_intento(text, integer, integer)', 'execute'),
  'authenticated no puede ejecutar registrar_intento'
);
select ok(
  has_function_privilege('service_role', 'public.registrar_intento(text, integer, integer)', 'execute'),
  'service_role sí puede ejecutar registrar_intento'
);

-- ------------------------------------------------------------
-- Sesión: anon / authenticated no leen la tabla
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select * from public.limites_intentos $$,
  '42501', null,
  'anon no puede leer limites_intentos'
);
select throws_ok(
  $$ select public.registrar_intento('prueba', 1, 60) $$,
  '42501', null,
  'anon no puede llamar registrar_intento por la API'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select * from public.limites_intentos $$,
  '42501', null,
  'authenticated no puede leer limites_intentos'
);

-- ------------------------------------------------------------
-- Sesión: service_role (como la Server Action)
-- ------------------------------------------------------------
reset role;
set local role service_role;

select is(public.registrar_intento('pgtap:clave-a', 2, 60), true, '1.er intento dentro del límite');
select is(public.registrar_intento('pgtap:clave-a', 2, 60), true, '2.º intento dentro del límite');
select is(public.registrar_intento('pgtap:clave-a', 2, 60), false, '3.er intento supera el límite de 2');
select is(public.registrar_intento('pgtap:clave-b', 2, 60), true, 'otra clave tiene su propio contador');

select throws_ok(
  $$ select public.registrar_intento('', 1, 60) $$,
  'P0001', 'Clave de límite inválida',
  'una clave vacía se rechaza'
);

select * from finish();
rollback;
