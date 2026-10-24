-- ============================================================
-- Green Alliance · pgTAP · Aviso personal al cambiar datos sensibles
-- (migración 20261022000000, RS-M2).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('35000000-0000-4000-a000-0000000000ad', 'v.ad@prueba.test', '{"cedula":"3500000100"}', '{"nombre_completo":"Admin Treinta y cinco"}'),
  ('35000000-0000-4000-a000-00000000000a', 'v.a1@prueba.test', '{"cedula":"3500000001","grado":"PT"}', '{"nombre_completo":"Ana Avisada"}'),
  ('35000000-0000-4000-a000-00000000000b', 'v.a2@prueba.test', '{"cedula":"3500000002","grado":"PT"}', '{"nombre_completo":"Beto Ajeno"}');
update public.perfiles set rol = 'admin' where id = '35000000-0000-4000-a000-0000000000ad';
update public.perfiles set institucion = 'policia', created_at = now() - interval '1 day'
 where id in ('35000000-0000-4000-a000-00000000000a', '35000000-0000-4000-a000-00000000000b');

set local role authenticated;
set local request.jwt.claims = '{"sub":"35000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

-- Solo el celular: no hay aviso.
select lives_ok($$ select public.admin_editar_datos_asociado('35000000-0000-4000-a000-00000000000a', 'Ana Avisada', '3001112233', null, null, null, null) $$,
  'cambiar solo el celular funciona');
select is((select count(*)::int from public.avisos_asociados where destinatario_id = '35000000-0000-4000-a000-00000000000a'), 0,
  'cambiar solo el celular no crea aviso');

-- Nómina y correo institucional: un aviso personal que nombra ambos.
select lives_ok($$ select public.admin_editar_datos_asociado('35000000-0000-4000-a000-00000000000a', 'Ana Avisada', '3001112233',
                     'ana@policia.gov.co', 'Bancolombia', 'ahorros', '123456') $$,
  'cambiar correo institucional y nómina funciona');
select is((select count(*)::int from public.avisos_asociados where destinatario_id = '35000000-0000-4000-a000-00000000000a'), 1,
  'se crea un aviso personal');
select ok((select mensaje like '%tu correo institucional y tu cuenta de nómina%' and mensaje not like '%123456%' and mensaje not like '%ana@%'
             from public.avisos_asociados where destinatario_id = '35000000-0000-4000-a000-00000000000a'),
  'el aviso dice qué cambió, sin los valores nuevos');
reset role;

-- Ana lo ve; Beto no.
set local role authenticated;
set local request.jwt.claims = '{"sub":"35000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select is((select titulo from public.mis_avisos_pendientes()), 'Actualizamos tus datos', 'el asociado ve su aviso al entrar');
select lives_ok($$ select public.marcar_aviso_visto((select id from public.mis_avisos_pendientes() limit 1)) $$, 'lo marca como visto');
select is((select count(*)::int from public.mis_avisos_pendientes()), 0, 'no vuelve a salir');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"35000000-0000-4000-a000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.mis_avisos_pendientes()), 0, 'otro asociado no ve el aviso personal');
select lives_ok($$ select public.marcar_aviso_visto((select id from public.avisos_asociados limit 1)) $$,
  'marcar un aviso ajeno no falla');
reset role;

select * from finish();
rollback;
