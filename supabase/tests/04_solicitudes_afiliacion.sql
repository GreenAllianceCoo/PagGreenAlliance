-- ============================================================
-- Green Alliance · pgTAP · solicitudes_afiliacion
-- Insert solo desde el servidor (service role). Sin acceso anon.
-- El admin lee y cambia el estado; nadie cambia los datos enviados.
-- RLS y reglas generales (dedupe por cédula, mensaje, autorización, grado).
-- Las reglas de los campos nuevos de Fase 2 (nombres/apellidos, institución
-- + correo institucional, nequi, asesor_id, fotos) están en
-- 08_afiliacion_v2.sql; aquí se usan valores válidos "de relleno" para no
-- repetir esa cobertura.
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

-- Una solicitud de afiliación, insertada como lo haría el servidor
insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
) values (
  'Pedro', 'Pérez', '1234567890', 'PP', 'policia', '3001234567', '3001234567',
  'pedro.perez@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
);

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
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Ana', 'Ruiz', '1122334455', 'PT', 'policia', '3109876543', '3109876543',
       'ana.ruiz@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
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
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Ana', 'Ruiz', '1122334455', 'PT', 'policia', '3109876543', '3109876543',
       'ana.ruiz@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '42501', null,
  'un asociado no puede insertar directo en solicitudes de afiliación'
);

with u as (
  update public.solicitudes_afiliacion set estado = 'aprobada'
   where cedula = '1234567890' returning 1
) select is(count(*)::int, 0, 'un asociado no puede cambiar el estado de una afiliación') from u;

-- ------------------------------------------------------------
-- Sesión: admin
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.solicitudes_afiliacion where cedula = '1234567890'),
  1,
  'admin lee las solicitudes de afiliación'
);

with u as (
  update public.solicitudes_afiliacion set estado = 'contactado'
   where cedula = '1234567890' returning 1
) select is(count(*)::int, 1, 'admin puede cambiar el estado de una afiliación') from u;

select is(
  (select revisado_por from public.solicitudes_afiliacion where cedula = '1234567890'),
  '00000000-0000-4000-a000-0000000000ad'::uuid,
  'al cambiar el estado queda registrado el admin que revisó'
);

select throws_ok(
  $$ update public.solicitudes_afiliacion set cedula = '9999999999' where cedula = '1234567890' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'admin no puede cambiar la cédula que envió el solicitante'
);

select throws_ok(
  $$ delete from public.solicitudes_afiliacion where cedula = '1234567890' $$,
  '42501', null,
  'nadie borra solicitudes de afiliación desde la API (ni el admin)'
);

-- ------------------------------------------------------------
-- Reglas de los datos (como postgres, equivalente a service role)
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
) values (
  'Luis', 'Gómez', '1111111111', 'SI', 'policia', '3111111111', '3111111111',
  'luis.gomez@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Luis', 'Gómez', '1111111111', 'SI', 'policia', '3111111111', '3111111111',
       'luis.gomez@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23505', null,
  'no se permiten dos solicitudes pendientes con la misma cédula'
);

-- Cédula: solo dígitos, 6 a 10 (la normalización de puntos/espacios es de la app)
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cédula', 'Corta', '12345', 'PP', 'policia', '3000000005', '3000000005',
       'c5@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza cédula de 5 dígitos'
);
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cédula', 'Seis', '123456', 'PP', 'policia', '3000000006', '3000000006',
       'c6@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  'acepta cédula de 6 dígitos'
);
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cédula', 'Diez', '2222222222', 'PP', 'policia', '3000000007', '3000000007',
       'c10@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  'acepta cédula de 10 dígitos'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cédula', 'Larga', '12345678901', 'PP', 'policia', '3000000008', '3000000008',
       'c11@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza cédula de 11 dígitos'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cédula', 'Puntos', '1.234.567', 'PP', 'policia', '3000000009', '3000000009',
       'cp@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza cédula con puntos sin normalizar'
);

-- Celular: 10 dígitos que empiezan por 3
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Celular', 'Fijo', '2000000010', 'PP', 'policia', '2001234567', '3000000010',
       'cf@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza celular que no empieza por 3'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Celular', 'Corto', '2000000011', 'PP', 'policia', '300123456', '3000000011',
       'cc@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza celular de 9 dígitos'
);

-- Correo: formato válido y en minúsculas (además del dominio institucional, ver 08)
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Correo', 'Mayus', '2000000012', 'PP', 'policia', '3000000012', '3000000012',
       'Pedro@Policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza correo con mayúsculas (la app debe guardarlo en minúsculas)'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Correo', 'Malo', '2000000013', 'PP', 'policia', '3000000013', '3000000013',
       'pedro@policia', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza correo sin dominio válido'
);

-- Mensaje: hasta 500
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email, mensaje,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Mensaje', 'Quinientos', '2000000014', 'PP', 'policia', '3000000014', '3000000014',
       'm500@policia.gov.co', repeat('x', 500), 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  'acepta mensaje de 500 caracteres'
);
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email, mensaje,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Mensaje', 'QuinientosUno', '2000000015', 'PP', 'policia', '3000000015', '3000000015',
       'm501@policia.gov.co', repeat('x', 501), 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza mensaje de 501 caracteres'
);

-- Autorización de datos (Ley 1581 de 2012) obligatoria
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Sin', 'Autorizar', '2000000016', 'PP', 'policia', '3000000016', '3000000016',
       'sa@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', null
     ) $$,
  '23502', null,
  'rechaza la solicitud sin autorización de tratamiento de datos'
);

-- Grado: solo los del enum
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Grado', 'Malo', '2000000017', 'XX', 'policia', '3000000017', '3000000017',
       'gm@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()
     ) $$,
  '22P02', null,
  'rechaza un grado que no existe'
);

select * from finish();
rollback;
