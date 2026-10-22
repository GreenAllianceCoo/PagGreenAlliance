-- ============================================================
-- Green Alliance · pgTAP · Pausa del ingreso de asociados y avisos al entrar
-- (migración 20261018000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('33000000-0000-4000-a000-0000000000ad', 'p.ad@prueba.test', '{"cedula":"3300000100"}', '{"nombre_completo":"Admin Treinta y tres"}'),
  ('33000000-0000-4000-a000-0000000000e1', 'p.as@prueba.test', '{"cedula":"3300000101"}', '{"nombre_completo":"Asesor Treinta y tres"}'),
  ('33000000-0000-4000-a000-00000000000a', 'p.a1@prueba.test', '{"cedula":"3300000001","grado":"PT"}', '{"nombre_completo":"Ana Pausa"}');
update public.perfiles set rol = 'admin' where id = '33000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'asesor' where id = '33000000-0000-4000-a000-0000000000e1';
-- Ana existía antes de los avisos.
update public.perfiles set created_at = now() - interval '1 day' where id = '33000000-0000-4000-a000-00000000000a';

-- ------------------------------------------------------------
-- Pausa
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select is((select pausada from public.estado_pausa_cuenta()), false, 'sin pausa, el asociado entra');
select throws_ok($$ select public.admin_cambiar_pausa_cuenta(true, null) $$, 'P0001',
  'Solo un administrador puede pausar el ingreso de asociados', 'un asociado no puede pausar');
select is_empty($$ select 1 from public.configuracion_plataforma $$, 'un asociado no lee la configuración');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok($$ select public.admin_cambiar_pausa_cuenta(true, 'no') $$, 'P0001',
  'El mensaje debe tener entre 5 y 300 caracteres', 'el mensaje corto se rechaza');
select lives_ok($$ select public.admin_cambiar_pausa_cuenta(true, 'Volvemos a las 3 p. m.') $$, 'el admin pausa');
select is((select pausada from public.estado_pausa_cuenta()), false, 'el admin no queda fuera aunque haya pausa');
select is((select count(*)::int from public.historial_pausa_cuenta), 1, 'la pausa queda en el historial');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select results_eq($$ select pausada, mensaje from public.estado_pausa_cuenta() $$,
  $$ values (true, 'Volvemos a las 3 p. m.'::text) $$, 'con pausa, el asociado queda fuera y ve el mensaje');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is((select pausada from public.estado_pausa_cuenta()), false, 'el asesor no queda fuera');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select lives_ok($$ select public.admin_cambiar_pausa_cuenta(false, 'ignorado al reanudar') $$, 'el admin reanuda');
select is((select mensaje_pausa from public.configuracion_plataforma), null, 'al reanudar se borra el mensaje');

-- ------------------------------------------------------------
-- Avisos
-- ------------------------------------------------------------
select throws_ok($$ select public.admin_crear_aviso('Hi', 'Mensaje de prueba') $$, 'P0001',
  'El título debe tener entre 3 y 80 caracteres', 'título corto rechazado');
select lives_ok($$ select public.admin_crear_aviso('Nuevo convenio', 'Ya tenemos convenio con una óptica.') $$,
  'el admin publica un aviso');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"33000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select is((select count(*)::int from public.mis_avisos_pendientes()), 1, 'el asociado ve el aviso pendiente');
select throws_ok($$ select public.admin_crear_aviso('Falso aviso', 'Un asociado no publica avisos.') $$, 'P0001',
  'Solo un administrador puede publicar avisos', 'un asociado no publica avisos');
select lives_ok($$ select public.marcar_aviso_visto((select id from public.mis_avisos_pendientes() limit 1)) $$,
  'el asociado marca el aviso como visto');
select is((select count(*)::int from public.mis_avisos_pendientes()), 0, 'un aviso visto no vuelve a salir');
reset role;

select ok(not has_function_privilege('anon', 'public.estado_pausa_cuenta()', 'execute'),
  'anon no consulta la pausa');

select * from finish();
rollback;
