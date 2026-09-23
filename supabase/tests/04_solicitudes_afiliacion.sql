-- ============================================================
-- Green Alliance · pgTAP · solicitudes_afiliacion
-- Insert solo desde el servidor (service role). Sin acceso anon.
-- El admin lee y cambia el estado; nadie cambia los datos enviados.
-- Reglas de los campos según docs/spec-afiliacion-y-login.md.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- ------------------------------------------------------------
-- Datos de prueba
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

-- Una solicitud de afiliación, insertada como lo haría el servidor
insert into public.solicitudes_afiliacion (id, nombre, cedula, grado, celular, email, acepto_datos_at) values
  ('30000000-0000-4000-a000-000000000001', 'Pedro Pérez', '1234567890', 'PP', '3001234567', 'pedro@correo.com', now());

-- ------------------------------------------------------------
-- Sesión: anon
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.solicitudes_afiliacion $$,
  '42501', null,
  'anon no puede leer solicitudes de afiliación'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Ana Ruiz', '1122334455', 'PT', '3109876543', 'ana@correo.com', now()) $$,
  '42501', null,
  'anon no puede insertar directo en solicitudes de afiliación'
);

-- ------------------------------------------------------------
-- Sesión: asociado A (authenticated sin rol admin)
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.solicitudes_afiliacion $$,
  'un asociado no ve solicitudes de afiliación'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Ana Ruiz', '1122334455', 'PT', '3109876543', 'ana@correo.com', now()) $$,
  '42501', null,
  'un asociado no puede insertar directo en solicitudes de afiliación'
);

with u as (
  update public.solicitudes_afiliacion set estado = 'aprobada'
   where id = '30000000-0000-4000-a000-000000000001' returning 1
) select is(count(*)::int, 0, 'un asociado no puede cambiar el estado de una afiliación') from u;

-- ------------------------------------------------------------
-- Sesión: admin
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.solicitudes_afiliacion where id = '30000000-0000-4000-a000-000000000001'),
  1,
  'admin lee las solicitudes de afiliación'
);

with u as (
  update public.solicitudes_afiliacion set estado = 'contactado'
   where id = '30000000-0000-4000-a000-000000000001' returning 1
) select is(count(*)::int, 1, 'admin puede cambiar el estado de una afiliación') from u;

select is(
  (select revisado_por from public.solicitudes_afiliacion where id = '30000000-0000-4000-a000-000000000001'),
  '00000000-0000-4000-a000-0000000000ad'::uuid,
  'al cambiar el estado queda registrado el admin que revisó'
);

select throws_ok(
  $$ update public.solicitudes_afiliacion set cedula = '9999999999' where id = '30000000-0000-4000-a000-000000000001' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'admin no puede cambiar la cédula que envió el solicitante'
);

select throws_ok(
  $$ delete from public.solicitudes_afiliacion where id = '30000000-0000-4000-a000-000000000001' $$,
  '42501', null,
  'nadie borra solicitudes de afiliación desde la API (ni el admin)'
);

-- ------------------------------------------------------------
-- Reglas de los datos (como postgres, equivalente a service role)
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
values ('Luis Gómez', '1111111111', 'SI', '3111111111', 'luis@correo.com', now());

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Luis Gómez', '1111111111', 'SI', '3111111111', 'luis@correo.com', now()) $$,
  '23505', null,
  'no se permiten dos solicitudes pendientes con la misma cédula'
);

-- Nombre: 3 a 120 caracteres
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Al', '2000000001', 'PP', '3000000001', 'n2@correo.com', now()) $$,
  '23514', null,
  'rechaza nombre de 2 caracteres'
);
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Ana', '2000000002', 'PP', '3000000002', 'n3@correo.com', now()) $$,
  'acepta nombre de 3 caracteres'
);
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values (repeat('a', 120), '2000000003', 'PP', '3000000003', 'n120@correo.com', now()) $$,
  'acepta nombre de 120 caracteres'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values (repeat('a', 121), '2000000004', 'PP', '3000000004', 'n121@correo.com', now()) $$,
  '23514', null,
  'rechaza nombre de 121 caracteres'
);

-- Cédula: solo dígitos, 6 a 10 (la normalización de puntos/espacios es de la app)
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Cédula Corta', '12345', 'PP', '3000000005', 'c5@correo.com', now()) $$,
  '23514', null,
  'rechaza cédula de 5 dígitos'
);
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Cédula Seis', '123456', 'PP', '3000000006', 'c6@correo.com', now()) $$,
  'acepta cédula de 6 dígitos'
);
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Cédula Diez', '2222222222', 'PP', '3000000007', 'c10@correo.com', now()) $$,
  'acepta cédula de 10 dígitos'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Cédula Larga', '12345678901', 'PP', '3000000008', 'c11@correo.com', now()) $$,
  '23514', null,
  'rechaza cédula de 11 dígitos'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Cédula Puntos', '1.234.567', 'PP', '3000000009', 'cp@correo.com', now()) $$,
  '23514', null,
  'rechaza cédula con puntos sin normalizar'
);

-- Celular: 10 dígitos que empiezan por 3
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Celular Fijo', '2000000010', 'PP', '2001234567', 'cf@correo.com', now()) $$,
  '23514', null,
  'rechaza celular que no empieza por 3'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Celular Corto', '2000000011', 'PP', '300123456', 'cc@correo.com', now()) $$,
  '23514', null,
  'rechaza celular de 9 dígitos'
);

-- Correo: formato válido y en minúsculas
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Correo Mayus', '2000000012', 'PP', '3000000012', 'Pedro@Correo.com', now()) $$,
  '23514', null,
  'rechaza correo con mayúsculas (la app debe guardarlo en minúsculas)'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Correo Malo', '2000000013', 'PP', '3000000013', 'pedro@correo', now()) $$,
  '23514', null,
  'rechaza correo sin dominio válido'
);

-- Mensaje: hasta 500
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, mensaje, acepto_datos_at)
     values ('Mensaje 500', '2000000014', 'PP', '3000000014', 'm500@correo.com', repeat('x', 500), now()) $$,
  'acepta mensaje de 500 caracteres'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, mensaje, acepto_datos_at)
     values ('Mensaje 501', '2000000015', 'PP', '3000000015', 'm501@correo.com', repeat('x', 501), now()) $$,
  '23514', null,
  'rechaza mensaje de 501 caracteres'
);

-- Autorización de datos (Ley 1581 de 2012) obligatoria
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Sin Autorizar', '2000000016', 'PP', '3000000016', 'sa@correo.com', null) $$,
  '23502', null,
  'rechaza la solicitud sin autorización de tratamiento de datos'
);

-- Grado: solo los del enum
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombre, cedula, grado, celular, email, acepto_datos_at)
     values ('Grado Malo', '2000000017', 'XX', '3000000017', 'gm@correo.com', now()) $$,
  '22P02', null,
  'rechaza un grado que no existe'
);

select * from finish();
rollback;
