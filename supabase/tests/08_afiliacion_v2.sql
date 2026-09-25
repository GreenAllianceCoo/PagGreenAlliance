-- ============================================================
-- Green Alliance · pgTAP · Fase 2 · solicitudes_afiliacion v2
-- nombres/apellidos separados, institución + correo institucional, nequi,
-- asesor_id, fotos obligatorias. Todo se inserta como lo haría el servidor
-- (service role): RLS de esta tabla ya se prueba en 04_solicitudes_afiliacion.sql.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000e1', 'asesor.1@prueba.test', '{"cedula":"1000000010"}', '{"nombre_completo":"Asesor Uno"}'),
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}');
update public.perfiles set rol = 'asesor' where id = '00000000-0000-4000-a000-0000000000e1';

reset role;
set local request.jwt.claims = '';

-- ------------------------------------------------------------
-- Caso válido base (policía)
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Pedro', 'Pérez Ruiz', '3000000001', 'PP', 'policia', '3001234567', '3001234567',
       'pedro.perez@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'acepta una solicitud completa de policía con correo institucional'
);

select is(
  (select nombre from public.solicitudes_afiliacion where cedula = '3000000001'),
  'Pedro Pérez Ruiz',
  'la columna nombre se calcula sola desde nombres + apellidos'
);

-- ------------------------------------------------------------
-- Caso válido: ejército, con los dos dominios permitidos
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Ana', 'Ruiz', '3000000002', 'PT', 'ejercito', '3001234568', '3001234568',
       'ana.ruiz@buzonejercito.mil.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'acepta ejército con correo @buzonejercito.mil.co'
);

select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Luis', 'Gómez', '3000000003', 'PT', 'ejercito', '3001234569', '3001234569',
       'luis.gomez@ejercito.mil.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'acepta ejército con correo @ejercito.mil.co'
);

-- ------------------------------------------------------------
-- Correo institucional cruzado: rechazado
-- ------------------------------------------------------------
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cruzado', 'Malo', '3000000004', 'PT', 'policia', '3001234570', '3001234570',
       'cruzado@ejercito.mil.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza correo de ejército cuando la institución es policía'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Cruzado', 'Malo', '3000000005', 'PT', 'ejercito', '3001234571', '3001234571',
       'cruzado@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza correo de policía cuando la institución es ejército'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Sin', 'Institucional', '3000000006', 'PT', 'policia', '3001234572', '3001234572',
       'sin.institucional@gmail.com', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza un correo que no es institucional'
);

-- ------------------------------------------------------------
-- Nombres / apellidos: solo letras, tildes y ñ; 2 a 60
-- ------------------------------------------------------------
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'A', 'Pérez', '3000000007', 'PP', 'policia', '3001234573', '3001234573',
       'a1@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza nombres de 1 caracter'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Pedro3', 'Pérez', '3000000008', 'PP', 'policia', '3001234574', '3001234574',
       'a2@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza nombres con números'
);

select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'José Ñoño', 'Muñóz Peña', '3000000009', 'PP', 'policia', '3001234575', '3001234575',
       'a3@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'acepta tildes, ñ y espacios en nombres y apellidos'
);

-- ------------------------------------------------------------
-- Nequi: 10 dígitos que empiezan por 3
-- ------------------------------------------------------------
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Nequi', 'Malo', '3000000010', 'PP', 'policia', '3001234576', '2001234576',
       'a4@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza nequi que no empieza por 3'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Nequi', 'Corto', '3000000011', 'PP', 'policia', '3001234577', '300123457',
       'a5@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza nequi de 9 dígitos'
);

-- ------------------------------------------------------------
-- Fotos: las 3 son obligatorias
-- ------------------------------------------------------------
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Sin', 'Fotos', '3000000012', 'PP', 'policia', '3001234578', '3001234578',
       'a6@policia.gov.co', null, 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  '23514', null,
  'rechaza sin foto de cédula frente'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Sin', 'Selfie', '3000000013', 'PP', 'policia', '3001234579', '3001234579',
       'a7@policia.gov.co', 'a/f.jpg', 'a/r.jpg', null, now()
     ) $$,
  '23514', null,
  'rechaza sin selfie'
);

-- ------------------------------------------------------------
-- asesor_id: opcional; si viene, debe ser un perfil con rol asesor
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       asesor_id, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Con', 'Asesor', '3000000014', 'PP', 'policia', '3001234580', '3001234580',
       'a8@policia.gov.co', '00000000-0000-4000-a000-0000000000e1', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'acepta un asesor_id que sí es rol asesor'
);

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       asesor_id, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Con', 'AsesorFalso', '3000000015', 'PP', 'policia', '3001234581', '3001234581',
       'a9@policia.gov.co', '00000000-0000-4000-a000-00000000000a', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'P0001', 'asesor_id debe ser un perfil con rol asesor',
  'rechaza un asesor_id que no es rol asesor'
);

-- ------------------------------------------------------------
-- El admin solo cambia el estado (los campos nuevos también quedan blindados)
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test', '{"cedula":"1000000003"}', '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select throws_ok(
  $$ update public.solicitudes_afiliacion set nequi = '3009999999' where cedula = '3000000001' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'el admin no puede cambiar el nequi que envió el solicitante'
);

select throws_ok(
  $$ update public.solicitudes_afiliacion set institucion = 'ejercito' where cedula = '3000000001' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'el admin no puede cambiar la institución que envió el solicitante'
);

select lives_ok(
  $$ update public.solicitudes_afiliacion set estado = 'contactado' where cedula = '3000000001' $$,
  'el admin sí puede cambiar el estado'
);

-- ------------------------------------------------------------
-- unidad sigue existiendo (en desuso) y sigue siendo opcional
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, unidad, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values (
       'Con', 'Unidad', '3000000016', 'PP', 'policia', 'DEPRO', '3001234582', '3001234582',
       'a10@policia.gov.co', 'a/f.jpg', 'a/r.jpg', 'a/s.jpg', now()
     ) $$,
  'unidad se puede seguir mandando (en desuso, pero no se borró la columna)'
);

select * from finish();
rollback;
