-- ============================================================
-- Green Alliance · pgTAP · Afiliación sin repetidos (migración 20261014000000).
-- Una solicitud nueva se rechaza (23505, mensaje genérico) si la cédula, el
-- correo personal o el institucional ya tienen cuenta o solicitud abierta.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

-- Un asociado ya registrado (cédula 3200000001, correo personal y nómina).
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('32000000-0000-4000-a000-00000000000a', 'registrado@prueba.test', '{"cedula":"3200000001","grado":"PT"}', '{"nombre_completo":"Ana Registrada"}');
update public.perfiles set correo_institucional = 'ana.registrada@policia.gov.co'
where id = '32000000-0000-4000-a000-00000000000a';

-- Una solicitud ya en «contactado».
insert into public.solicitudes_afiliacion (nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  correo_institucional, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, estado)
values ('Beto', 'Contactado', '3200000002', 'PT', 'policia', '3003200002', '3003200002', 'beto@prueba.test',
  'beto.c@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now(), 'contactado');

-- Una rechazada (no bloquea un nuevo intento).
insert into public.solicitudes_afiliacion (nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, estado)
values ('Caro', 'Rechazada', '3200000003', 'PT', 'policia', '3003200003', '3003200003', 'caro@prueba.test',
  'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now(), 'rechazada');

create function pg_temp.nueva(p_cedula text, p_email text, p_institucional text default null)
returns void language sql as $$
  insert into public.solicitudes_afiliacion (nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
    correo_institucional, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at)
  values ('Nueva', 'Persona', p_cedula, 'PT', 'policia', '3009999999', '3009999999', p_email,
    p_institucional, 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now());
$$;

select throws_ok($$ select pg_temp.nueva('3200000001', 'otro1@prueba.test') $$,
  '23505', 'Solicitud de afiliación repetida', 'cédula de un asociado registrado: rechazada');
select throws_ok($$ select pg_temp.nueva('3200000002', 'otro2@prueba.test') $$,
  '23505', 'Solicitud de afiliación repetida', 'cédula con solicitud en «contactado»: rechazada');
select throws_ok($$ select pg_temp.nueva('3200000010', 'registrado@prueba.test') $$,
  '23505', 'Solicitud de afiliación repetida', 'correo personal de una cuenta existente: rechazado');
select throws_ok($$ select pg_temp.nueva('3200000011', 'beto@prueba.test') $$,
  '23505', 'Solicitud de afiliación repetida', 'correo personal de otra solicitud abierta: rechazado');
select throws_ok($$ select pg_temp.nueva('3200000012', 'otro3@prueba.test', 'ana.registrada@policia.gov.co') $$,
  '23505', 'Solicitud de afiliación repetida', 'correo institucional de un asociado: rechazado');
select throws_ok($$ select pg_temp.nueva('3200000013', 'otro4@prueba.test', 'beto.c@policia.gov.co') $$,
  '23505', 'Solicitud de afiliación repetida', 'correo institucional de otra solicitud abierta: rechazado');

select lives_ok($$ select pg_temp.nueva('3200000003', 'caro@prueba.test') $$,
  'una persona rechazada puede volver a solicitar');
select lives_ok($$ select pg_temp.nueva('3200000020', 'nueva@prueba.test', 'nueva@policia.gov.co') $$,
  'una persona nueva puede solicitar');
select throws_ok($$ select pg_temp.nueva('3200000020', 'nueva2@prueba.test') $$,
  '23505', null, 'la misma cédula no puede enviar dos veces');

select ok(not has_function_privilege('anon', 'public.rechazar_afiliacion_repetida()', 'execute'),
  'anon no ejecuta la función del trigger');

select * from finish();
rollback;
