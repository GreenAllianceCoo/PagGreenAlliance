-- ============================================================
-- Green Alliance · pgTAP · grados_credito, convenios,
-- handle_new_user (registro) y correo_por_cedula (login)
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ------------------------------------------------------------
-- Datos de prueba
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

insert into public.convenios (id, nombre_empresa, emoji, especialidad, activo) values
  ('40000000-0000-4000-a000-000000000001', 'AMB Móvil S.A.S.', '📱', 'Tecnología', true),
  ('40000000-0000-4000-a000-000000000002', 'Convenio Vencido S.A.S.', null, null, false);

-- ------------------------------------------------------------
-- Sesión: asociado A
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.grados_credito),
  10,
  'un asociado puede leer los 10 topes de crédito'
);

with u as (
  update public.grados_credito set capacidad_maxima = 99999999 returning 1
) select is(count(*)::int, 0, 'un asociado no puede cambiar los topes') from u;

select throws_ok(
  $$ insert into public.grados_credito (grado, porcentaje, capacidad_maxima, cuota_mensual, total_credito, tasa_interes_mensual)
     values ('PP', '50', 99999999, 1, 1, 0.01) $$,
  '42501', null,
  'un asociado no puede insertar topes'
);

with d as (
  delete from public.grados_credito returning 1
) select is(count(*)::int, 0, 'un asociado no puede borrar topes') from d;

select results_eq(
  $$ select nombre_empresa from public.convenios
      where id in ('40000000-0000-4000-a000-000000000001', '40000000-0000-4000-a000-000000000002') $$,
  array['AMB Móvil S.A.S.'],
  'un asociado solo ve convenios activos'
);

select throws_ok(
  $$ insert into public.convenios (nombre_empresa) values ('Convenio Falso') $$,
  '42501', null,
  'un asociado no puede crear convenios'
);

-- ------------------------------------------------------------
-- Sesión: anon
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is_empty($$ select 1 from public.grados_credito $$, 'anon no ve los topes de crédito');
select is_empty($$ select 1 from public.convenios $$, 'anon no ve los convenios (NIT y teléfono incluidos)');

-- ------------------------------------------------------------
-- Sesión: admin
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.convenios
    where id in ('40000000-0000-4000-a000-000000000001', '40000000-0000-4000-a000-000000000002')),
  2,
  'admin ve también los convenios inactivos'
);

with u as (
  update public.grados_credito set capacidad_maxima = capacidad_maxima
   where grado = 'PP' and porcentaje = '50' returning 1
) select is(count(*)::int, 1, 'admin puede editar los topes') from u;

-- ------------------------------------------------------------
-- handle_new_user: cédula y grado solo desde app_metadata (servidor)
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

-- Alguien se registra mandando grado, cédula y rol en user_metadata (lo controla el cliente)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('e1000000-0000-4000-a000-0000000000e1', 'atacante@prueba.test', '{}',
   '{"nombre_completo":"Atacante","grado":"OF","cedula":"1000000001","rol":"admin"}');

select is(
  (select grado::text from public.perfiles where id = 'e1000000-0000-4000-a000-0000000000e1'),
  null::text,
  'el grado enviado en user_metadata se ignora'
);

select is(
  (select rol::text from public.perfiles where id = 'e1000000-0000-4000-a000-0000000000e1'),
  'asociado',
  'el rol enviado en user_metadata se ignora (queda asociado)'
);

select ok(
  (select cedula like 'PENDIENTE-%' from public.perfiles where id = 'e1000000-0000-4000-a000-0000000000e1'),
  'la cédula enviada en user_metadata se ignora (queda PENDIENTE-…)'
);

insert into auth.users (id, email, raw_app_meta_data) values
  ('e2000000-0000-4000-a000-0000000000e2', 'cedula.corta@prueba.test', '{"cedula":"12345"}');

select ok(
  (select cedula like 'PENDIENTE-%' from public.perfiles where id = 'e2000000-0000-4000-a000-0000000000e2'),
  'una cédula de 5 dígitos en app_metadata queda como PENDIENTE-…'
);

select lives_ok(
  $$ insert into auth.users (id, email, raw_app_meta_data) values
       ('e3000000-0000-4000-a000-0000000000e3', 'grado.malo@prueba.test', '{"cedula":"1000000007","grado":"XX"}') $$,
  'un grado inválido en app_metadata no rompe el registro'
);

select is(
  (select grado::text from public.perfiles where id = 'e3000000-0000-4000-a000-0000000000e3'),
  null::text,
  'un grado inválido en app_metadata queda en null'
);

insert into auth.users (id, email, raw_app_meta_data) values
  ('e4000000-0000-4000-a000-0000000000e4', 'valido@prueba.test', '{"cedula":"1098765432","grado":"IT"}');

select is(
  (select cedula from public.perfiles where id = 'e4000000-0000-4000-a000-0000000000e4'),
  '1098765432',
  'una cédula válida en app_metadata se usa en el perfil'
);

select is(
  (select grado::text from public.perfiles where id = 'e4000000-0000-4000-a000-0000000000e4'),
  'IT',
  'un grado válido en app_metadata se usa en el perfil'
);

-- ------------------------------------------------------------
-- correo_por_cedula (solo la usa el servidor del login)
-- ------------------------------------------------------------
select is(
  public.correo_por_cedula('1000000001'),
  'asociado.a@prueba.test',
  'correo_por_cedula devuelve el correo de una cédula registrada'
);

select is(
  public.correo_por_cedula(' 1000000001 '),
  'asociado.a@prueba.test',
  'correo_por_cedula tolera espacios alrededor de la cédula'
);

select is(
  public.correo_por_cedula('abc123'),
  null::text,
  'correo_por_cedula no devuelve nada para una cédula con letras'
);

select is(
  public.correo_por_cedula('9999999999'),
  null::text,
  'correo_por_cedula no devuelve nada para una cédula no registrada'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select public.correo_por_cedula('1000000001') $$,
  '42501', null,
  'un asociado no puede llamar correo_por_cedula (evita enumerar correos)'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select public.correo_por_cedula('1000000001') $$,
  '42501', null,
  'anon no puede llamar correo_por_cedula (evita enumerar correos)'
);

select * from finish();
rollback;
