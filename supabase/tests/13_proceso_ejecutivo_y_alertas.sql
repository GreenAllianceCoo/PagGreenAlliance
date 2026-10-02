-- ============================================================
-- Green Alliance · pgTAP · Requerimientos de Ricardo · proceso ejecutivo
-- (20260929100300) y alertas del asociado (20260929100400).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('13000000-0000-4000-a000-00000000000a', 'p.a@prueba.test',   '{"cedula":"1300000001","grado":"PT"}', '{"nombre_completo":"Asociado A"}'),
  ('13000000-0000-4000-a000-00000000000b', 'p.b@prueba.test',   '{"cedula":"1300000002","grado":"PT"}', '{"nombre_completo":"Asociado B"}'),
  ('13000000-0000-4000-a000-0000000000ad', 'p.adm@prueba.test', '{"cedula":"1300000009"}',              '{"nombre_completo":"Admin Proceso"}');
update public.perfiles set rol = 'admin' where id = '13000000-0000-4000-a000-0000000000ad';

create temporary table ctx (hoy date);
insert into ctx values ((now() at time zone 'America/Bogota')::date);
grant select on ctx to authenticated, anon;

-- ------------------------------------------------------------
-- Asociado A: no escribe su proceso
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo)
     values ('13000000-0000-4000-a000-00000000000a', 'operando', '2020-01-01') $$,
  '42501', null,
  'un asociado no puede crear su proceso ejecutivo'
);

select throws_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000a', 'operando') $$,
  'P0001', 'Solo un administrador puede cambiar el proceso ejecutivo',
  'un asociado no puede usar la función del admin'
);

-- ------------------------------------------------------------
-- Admin: crea y avanza procesos
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select estado::text || '|' || coalesce(fecha_inicio_embargo::text, 'null')
     from public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000a', 'reparto')),
  'reparto|null',
  'el admin crea el proceso en «reparto», sin fecha de inicio'
);

select is(
  (select fecha_inicio_embargo from public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000a', 'operando')),
  (select hoy from ctx),
  'al pasar a «operando» sin fecha, se fija hoy (hora Colombia)'
);

select is(
  (select count(*)::int from public.historial_proceso_ejecutivo
    where asociado_id = '13000000-0000-4000-a000-00000000000a'
      and admin_id = '13000000-0000-4000-a000-0000000000ad'),
  2,
  'cada cambio queda en el historial con el admin que lo hizo'
);

select throws_ok(
  $$ update public.procesos_ejecutivos set estado = 'terminado'
      where asociado_id = '13000000-0000-4000-a000-00000000000a' $$,
  '42501', null,
  'ni el admin escribe la tabla directo (solo por la función)'
);

select throws_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000a', 'sentencia', '2024-01-01') $$,
  'P0001', 'La fecha de inicio del embargo solo se registra desde el paso «Operando»',
  'no se registra fecha de inicio antes de «operando»'
);

select throws_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000a', 'operando',
       ((now() at time zone 'America/Bogota')::date + 60)) $$,
  'P0001', 'La fecha de inicio del embargo no puede estar a más de un mes en el futuro',
  'la fecha de inicio no puede estar muy en el futuro'
);

select is(
  (select fecha_inicio_embargo from public.admin_actualizar_proceso_ejecutivo(
     '13000000-0000-4000-a000-00000000000a', 'operando', ((select hoy from ctx) - interval '25 months')::date)),
  ((select hoy from ctx) - interval '25 months')::date,
  'el admin ajusta la fecha de inicio del embargo'
);

select is(
  (select estado_anterior::text || '>' || estado_nuevo::text from public.historial_proceso_ejecutivo
    where asociado_id = '13000000-0000-4000-a000-00000000000a'
    order by id desc limit 1),
  'operando>operando',
  'el ajuste de fecha también queda en el historial'
);

select lives_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000b', 'notificacion') $$,
  'el admin crea el proceso del asociado B'
);

-- ------------------------------------------------------------
-- Asociado A (operando hace 25 meses): lee lo suyo y avisa
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select asociado_id from public.procesos_ejecutivos $$,
  array['13000000-0000-4000-a000-00000000000a'::uuid],
  'el asociado solo ve su propio proceso'
);

select is_empty($$ select 1 from public.historial_proceso_ejecutivo $$, 'el asociado no ve el historial');

select is(
  (select fecha_fin_embargo::text || '|' || conteo_activo::text || '|' || puede_pedir_retiro::text || '|' || puede_pedir_renovacion::text
     from public.mi_proceso_ejecutivo()),
  ((select hoy from ctx) - interval '25 months' + interval '36 months')::date::text || '|true|true|true',
  'mi_proceso_ejecutivo: fin = inicio + 36 meses; a los 25 meses puede pedir retiro y renovación'
);

select lives_ok(
  $$ select public.crear_alerta_asociado('renovacion') $$,
  'el asociado avisa que quiere renovar (pasaron 24 meses)'
);

select throws_ok(
  $$ select public.crear_alerta_asociado('renovacion') $$,
  'P0001', 'Ya avisaste al administrador; te contactará pronto',
  'no se repite una alerta mientras haya una pendiente del mismo tipo'
);

select lives_ok(
  $$ select public.crear_alerta_asociado('retiro_anticipado') $$,
  'el asociado avisa un retiro anticipado (operando y conteo activo)'
);

select is(
  (select renovacion_pendiente::text || '|' || puede_pedir_renovacion::text from public.mi_proceso_ejecutivo()),
  'true|false',
  'con una renovación pendiente, el botón queda desactivado'
);

select throws_ok(
  $$ insert into public.alertas_asociado (asociado_id, tipo) values ('13000000-0000-4000-a000-00000000000a', 'renovacion') $$,
  '42501', null,
  'el asociado no inserta alertas directo (solo por la función)'
);

select throws_ok(
  $$ update public.alertas_asociado set estado = 'atendida', atendida_at = now()
      where asociado_id = '13000000-0000-4000-a000-00000000000a' $$,
  '42501', null,
  'el asociado no puede marcar sus alertas como atendidas'
);

select throws_ok(
  $$ select public.admin_marcar_alerta_atendida((select id from public.alertas_asociado limit 1)) $$,
  'P0001', 'Solo un administrador puede atender alertas',
  'un asociado no puede usar la función de atender alertas'
);

-- ------------------------------------------------------------
-- Asociado B (notificación): no puede avisar todavía
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$ select public.crear_alerta_asociado('retiro_anticipado') $$,
  'P0001', 'Esta opción se habilita cuando tu proceso esté operando',
  'antes de «operando» no hay retiro anticipado'
);

select is_empty($$ select 1 from public.alertas_asociado $$, 'B no ve las alertas de A');

-- Admin pasa a B a operando hoy: la renovación aún no aplica
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000b', 'operando');
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$ select public.crear_alerta_asociado('renovacion') $$,
  'P0001', 'La renovación se habilita cuando pasen 24 meses desde el inicio de tu embargo',
  'la renovación solo se habilita a los 24 meses'
);

-- ------------------------------------------------------------
-- Admin: bandeja y «atendida»
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"13000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.alertas_asociado
    where asociado_id = '13000000-0000-4000-a000-00000000000a' and estado = 'pendiente'),
  2,
  'el admin ve las alertas pendientes'
);

select lives_ok(
  $$ select public.admin_marcar_alerta_atendida(
       (select id from public.alertas_asociado
         where asociado_id = '13000000-0000-4000-a000-00000000000a' and tipo = 'renovacion')) $$,
  'el admin marca una alerta como atendida'
);

select is(
  (select atendida_por from public.alertas_asociado
    where asociado_id = '13000000-0000-4000-a000-00000000000a' and tipo = 'renovacion'),
  '13000000-0000-4000-a000-0000000000ad'::uuid,
  'la alerta atendida guarda qué admin la atendió'
);

select throws_ok(
  $$ select public.admin_marcar_alerta_atendida(
       (select id from public.alertas_asociado
         where asociado_id = '13000000-0000-4000-a000-00000000000a' and tipo = 'renovacion')) $$,
  'P0001', 'La alerta no existe o ya estaba atendida',
  'una alerta atendida no se vuelve a atender'
);

select is(
  (select fecha_inicio_embargo from public.admin_actualizar_proceso_ejecutivo('13000000-0000-4000-a000-00000000000b', 'sentencia')),
  null::date,
  'si el proceso vuelve a un paso anterior, la fecha de inicio se borra'
);

-- ------------------------------------------------------------
-- anon: nada
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select ok(
  not has_function_privilege('anon', 'public.crear_alerta_asociado(public.tipo_alerta_asociado)', 'execute')
  and not has_function_privilege('anon', 'public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date)', 'execute'),
  'anon no ejecuta las funciones del proceso ni de alertas'
);

select throws_ok(
  $$ select 1 from public.procesos_ejecutivos $$,
  '42501', null,
  'anon no lee procesos ejecutivos'
);

select * from finish();
rollback;
