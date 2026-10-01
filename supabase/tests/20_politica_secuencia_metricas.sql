-- Green Alliance · pgTAP · 20261001000000 (version politica, P-55, metricas 4.7/4.8)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('20000000-0000-4000-a000-0000000000ad', 'm.adm@prueba.test', '{"cedula":"2000000009"}', '{"nombre_completo":"Admin M"}'),
  ('20000000-0000-4000-a000-0000000000e1', 'm.as@prueba.test',  '{"cedula":"2000000010"}', '{"nombre_completo":"Asesor M"}'),
  ('20000000-0000-4000-a000-00000000000a', 'm.a@prueba.test',   '{"cedula":"2000000001","grado":"PP"}', '{"nombre_completo":"Cliente M"}');
update public.perfiles set rol = 'admin'  where id = '20000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'asesor' where id = '20000000-0000-4000-a000-0000000000e1';
update public.perfiles set asesor_id = '20000000-0000-4000-a000-0000000000e1' where id = '20000000-0000-4000-a000-00000000000a';

-- 1) version_politica_datos
select has_column('public', 'solicitudes_afiliacion', 'version_politica_datos', 'existe version_politica_datos');
insert into public.solicitudes_afiliacion (nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at)
values ('Uno', 'Sinversion', '2000000020', 'PP', 'policia', '3002000020', '3002000020', 'uno@correo.test', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now());
select is((select version_politica_datos from public.solicitudes_afiliacion where cedula = '2000000020'), '1.0',
  'sin version enviada se sella la vigente');
insert into public.solicitudes_afiliacion (nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, version_politica_datos)
values ('Dos', 'Conversion', '2000000021', 'PP', 'policia', '3002000021', '3002000021', 'dos@correo.test', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now(), '2.1');
select is((select version_politica_datos from public.solicitudes_afiliacion where cedula = '2000000021'), '2.1',
  'la version enviada por el servidor se respeta');
select throws_ok(
  $$ insert into public.solicitudes_afiliacion (nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, version_politica_datos)
     values ('Tres', 'Mala', '2000000022', 'PP', 'policia', '3002000022', '3002000022', 'tres@correo.test', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now(), 'v1; drop') $$,
  '23514', null, 'version con formato invalido se rechaza');
select throws_ok(
  $$ update public.solicitudes_afiliacion set version_politica_datos = '9.9' where cedula = '2000000020' $$,
  'P0001', 'version_politica_datos no se puede modificar', 'la version es inmutable');

-- 2) P-55
select ok(not has_sequence_privilege('anon', 'public.limites_intentos_id_seq', 'usage'), 'anon sin usage en la secuencia');
select ok(not has_sequence_privilege('authenticated', 'public.limites_intentos_id_seq', 'usage'), 'authenticated sin usage en la secuencia');
select ok(not has_sequence_privilege('authenticated', 'public.limites_intentos_id_seq', 'select'), 'authenticated sin select en la secuencia');
select lives_ok($$ select public.registrar_intento('prueba:p55', 5, 60) $$, 'el limitador sigue funcionando (security definer)');

-- 3) Metricas
select ok(not has_function_privilege('anon', 'public.admin_metricas_dashboard()', 'execute'), 'anon no ejecuta admin_metricas_dashboard');
select ok(not has_function_privilege('anon', 'public.asesor_metricas_dashboard()', 'execute'), 'anon no ejecuta asesor_metricas_dashboard');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select is(public.admin_metricas_dashboard(), null, 'un asociado recibe null en metricas de admin');
select is(public.asesor_metricas_dashboard(), null, 'un asociado recibe null en metricas de asesor');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select ok((public.admin_metricas_dashboard() ->> 'afiliaciones_pendientes')::int >= 2, 'el admin ve conteos agregados');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true);
select is((public.asesor_metricas_dashboard() ->> 'clientes_total')::int, 1, 'el asesor ve solo sus clientes');
select is(public.asesor_metricas_dashboard() -> 'clientes_por_estado_credito' ->> 'sin_solicitud', '1', 'desglose por estado de credito');
reset role;

select * from finish();
rollback;
