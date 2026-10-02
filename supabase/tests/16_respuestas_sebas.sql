-- ============================================================
-- Green Alliance · pgTAP · Respuestas de Sebas (spec §8, 30-sep):
--   20260930100000 pagos de comisión corregibles con bitácora inmutable
--   20260930100100 la tasa no se lee por la API (salvo asesor/admin por RPC)
--   20260930100200 crédito solo con asociado activo y proceso en «operando»
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('16000000-0000-4000-a000-0000000000e1', 's.as@prueba.test',   '{"cedula":"1600000010"}',              '{"nombre_completo":"Asesor S"}'),
  ('16000000-0000-4000-a000-00000000000a', 's.a@prueba.test',    '{"cedula":"1600000001","grado":"PT"}', '{"nombre_completo":"Asociado Operando"}'),
  ('16000000-0000-4000-a000-00000000000b', 's.b@prueba.test',    '{"cedula":"1600000002","grado":"PT"}', '{"nombre_completo":"Asociado Notificación"}'),
  ('16000000-0000-4000-a000-00000000000c', 's.c@prueba.test',    '{"cedula":"1600000003","grado":"PT"}', '{"nombre_completo":"Asociado Inactivo"}'),
  ('16000000-0000-4000-a000-00000000000d', 's.d@prueba.test',    '{"cedula":"1600000004","grado":"PT"}', '{"nombre_completo":"Asociado Sin Proceso"}'),
  ('16000000-0000-4000-a000-0000000000ad', 's.adm@prueba.test',  '{"cedula":"1600000009"}',              '{"nombre_completo":"Admin S"}');
update public.perfiles set rol = 'asesor' where id = '16000000-0000-4000-a000-0000000000e1';
update public.perfiles set rol = 'admin'  where id = '16000000-0000-4000-a000-0000000000ad';
update public.perfiles set activo = false where id = '16000000-0000-4000-a000-00000000000c';
insert into public.procesos_ejecutivos (asociado_id, estado) values
  ('16000000-0000-4000-a000-00000000000a', 'operando'),
  ('16000000-0000-4000-a000-00000000000b', 'notificacion'),
  ('16000000-0000-4000-a000-00000000000c', 'operando');

-- ============================================================
-- 3. Crédito solo si activo y operando
-- ============================================================
set local role authenticated;

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('16000000-0000-4000-a000-00000000000b', '50', 500000) $$,
  'P0001', 'Podrás pedir tu crédito cuando tu proceso esté operando',
  'con el proceso en «notificación» no se pide crédito'
);

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-00000000000c","role":"authenticated"}';
select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('16000000-0000-4000-a000-00000000000c', '50', 500000) $$,
  'P0001', 'Tu cuenta está inactiva. Comunícate con la cooperativa.',
  'un asociado inactivo no pide crédito aunque su proceso esté operando'
);

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-00000000000d","role":"authenticated"}';
select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('16000000-0000-4000-a000-00000000000d', '50', 500000) $$,
  'P0001', 'Podrás pedir tu crédito cuando tu proceso esté operando',
  'sin proceso ejecutivo no se pide crédito'
);

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('16000000-0000-4000-a000-00000000000a', '50', 500000) $$,
  'activo y operando: sí pide crédito'
);

reset role;
set local request.jwt.claims = '';
select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('16000000-0000-4000-a000-00000000000b', '50', 500000) $$,
  'P0001', 'Podrás pedir tu crédito cuando tu proceso esté operando',
  'la regla también aplica al service role'
);

-- ============================================================
-- 2. La tasa no se lee por la API
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok($$ select tasa_interes_mensual from public.grados_credito $$, '42501', null,
  'un asociado no lee la tasa de grados_credito');
select throws_ok($$ select cuota_mensual from public.grados_credito $$, '42501', null,
  'un asociado no lee cuota_mensual (revela la tasa)');
select throws_ok($$ select total_credito from public.grados_credito $$, '42501', null,
  'un asociado no lee total_credito (revela la tasa)');
select throws_ok($$ select * from public.grados_credito $$, '42501', null,
  'select * sobre grados_credito falla para un asociado');
select is(
  (select count(*)::int from (select grado, porcentaje, capacidad_maxima, plazo_meses from public.grados_credito) x),
  18,
  'el asociado sigue leyendo grado, porcentaje, tope y plazo'
);
select is_empty($$ select * from public.tabla_credito_con_tasa() $$, 'un asociado no obtiene la tasa por la función');

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is(
  (select count(*)::int from public.tabla_credito_con_tasa() where tasa_interes_mensual > 0),
  18,
  'el asesor obtiene los 18 topes con tasa (demo)'
);

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select is(
  (select count(*)::int from public.tabla_credito_con_tasa()),
  18,
  'el admin obtiene los topes con tasa (demo del admin)'
);
select lives_ok(
  $$ update public.grados_credito set capacidad_maxima = capacidad_maxima where grado = 'PT' and porcentaje = '50' $$,
  'el admin sigue pudiendo editar topes'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select tasa_interes_mensual from public.grados_credito $$, '42501', null,
  'anon no lee la tasa');
select ok(not has_function_privilege('anon', 'public.tabla_credito_con_tasa()', 'execute'),
  'anon no ejecuta tabla_credito_con_tasa');

-- ============================================================
-- 1. Pagos de comisión: corregir y anular con bitácora
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

insert into public.pagos_comision (id, asesor_id, periodo_corte, concepto, monto, nota) values
  ('16000000-0000-4000-b000-000000000001', '16000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ingreso_nuevo', 50000, 'mal digitado'),
  ('16000000-0000-4000-b000-000000000002', '16000000-0000-4000-a000-0000000000e1', '2026-09-15', 'embargo_operativo', 100000, null),
  ('16000000-0000-4000-b000-000000000003', '16000000-0000-4000-a000-0000000000e1', '2026-09-15', 'embargo_operativo', 100000, 'duplicado');

select is(
  (select count(*)::int from public.bitacora_pagos_comision
    where pago_id::text like '16000000-0000-4000-b000-%' and accion = 'creacion'),
  3,
  'crear un pago queda en la bitácora'
);

select throws_ok(
  $$ select public.admin_editar_pago_comision('16000000-0000-4000-b000-000000000001', '', 500000) $$,
  'P0001', 'Escribe el motivo de la corrección (5 a 300 caracteres)',
  'editar exige motivo'
);

select is(
  (select monto from public.admin_editar_pago_comision(
     '16000000-0000-4000-b000-000000000001', 'Se digitó 50.000 en vez de 500.000', 500000)),
  500000::numeric,
  'el admin corrige el monto con motivo'
);

select is(
  (select (antes->>'monto') || '>' || (despues->>'monto') || '|' || motivo || '|' || actor_id::text
     from public.bitacora_pagos_comision
    where pago_id = '16000000-0000-4000-b000-000000000001' and accion = 'edicion'),
  '50000>500000|Se digitó 50.000 en vez de 500.000|16000000-0000-4000-a000-0000000000ad',
  'la bitácora guarda antes, después, motivo y quién'
);

select is(
  (select coalesce(nota, 'null') from public.admin_editar_pago_comision(
     '16000000-0000-4000-b000-000000000001', 'Quitar la nota vieja', p_nota => '')),
  'null',
  'p_nota vacía borra la nota'
);

select throws_ok(
  $$ select public.admin_anular_pago_comision('16000000-0000-4000-b000-000000000003', 'no') $$,
  'P0001', 'Escribe el motivo de la anulación (5 a 300 caracteres)',
  'anular exige motivo'
);

select lives_ok(
  $$ select public.admin_anular_pago_comision('16000000-0000-4000-b000-000000000003', 'Pago registrado dos veces') $$,
  'el admin anula un pago con motivo'
);

select is(
  (select anulado::text || '|' || anulado_por::text || '|' || motivo_anulacion
     from public.pagos_comision where id = '16000000-0000-4000-b000-000000000003'),
  'true|16000000-0000-4000-a000-0000000000ad|Pago registrado dos veces',
  'el pago anulado guarda quién y por qué'
);

select is(
  (select accion::text from public.bitacora_pagos_comision
    where pago_id = '16000000-0000-4000-b000-000000000003' order by id desc limit 1),
  'anulacion',
  'la anulación queda en la bitácora'
);

select throws_ok(
  $$ select public.admin_editar_pago_comision('16000000-0000-4000-b000-000000000003', 'Intento sobre anulado', 1) $$,
  'P0001', 'Un pago anulado ya no se puede modificar',
  'un pago anulado no se edita'
);

select throws_ok(
  $$ update public.pagos_comision set monto = 1 where id = '16000000-0000-4000-b000-000000000002' $$,
  '42501', null,
  'el admin no edita pagos directo (solo por la función)'
);

select throws_ok(
  $$ update public.bitacora_pagos_comision set motivo = 'cambiado' $$,
  '42501', null,
  'el admin no edita la bitácora'
);

select throws_ok(
  $$ delete from public.bitacora_pagos_comision $$,
  '42501', null,
  'el admin no borra la bitácora'
);

-- ------------------------------------------------------------
-- El asesor: acumulado solo con pagos vigentes; no usa las funciones del admin
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-0000000000e1","role":"authenticated"}';

select is(public.revelar_acumulado_comision(), 600000::numeric,
  'el acumulado suma solo los vigentes (500.000 + 100.000; el anulado no cuenta)');

select throws_ok(
  $$ select public.admin_anular_pago_comision('16000000-0000-4000-b000-000000000002', 'Me lo quiero quitar') $$,
  'P0001', 'Solo un administrador puede anular pagos de comisión',
  'el asesor no anula pagos'
);

select is_empty($$ select 1 from public.bitacora_pagos_comision $$, 'el asesor no ve la bitácora');

-- ------------------------------------------------------------
-- Ni postgres modifica la bitácora ni borra pagos; un update a mano exige motivo
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ update public.bitacora_pagos_comision set motivo = 'cambiado' where pago_id = '16000000-0000-4000-b000-000000000001' $$,
  'P0001', 'La bitácora no se puede modificar ni borrar',
  'ni el service role/postgres edita la bitácora'
);

select throws_ok(
  $$ delete from public.pagos_comision where id = '16000000-0000-4000-b000-000000000002' $$,
  'P0001', 'Los pagos de comisión no se borran; anúlelos con un motivo',
  'ni postgres borra un pago'
);

select throws_ok(
  $$ update public.pagos_comision set monto = 1 where id = '16000000-0000-4000-b000-000000000002' $$,
  'P0001', 'Para corregir un pago hace falta un motivo (mínimo 5 caracteres)',
  'un update a mano sin motivo falla (no hay cambios sin registro)'
);

-- ============================================================
-- 2b. La tasa de SUS solicitudes tampoco (20260930100300)
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok($$ select tasa_interes_mensual from public.solicitudes_credito $$, '42501', null,
  'el asociado no lee la tasa de su propia solicitud');
select throws_ok($$ select * from public.solicitudes_credito $$, '42501', null,
  'select * sobre solicitudes_credito falla (incluiría la tasa)');
select is(
  (select estado::text || '|' || monto_solicitado::text || '|' || grado::text
     from public.solicitudes_credito where asociado_id = '16000000-0000-4000-a000-00000000000a'),
  'pendiente|500000|PT',
  'el asociado sigue leyendo el resto de su solicitud'
);
select is_empty(
  $$ select * from public.admin_tasas_solicitudes(array(select id from public.solicitudes_credito)) $$,
  'un asociado no obtiene tasas por la función del admin'
);

set local request.jwt.claims = '{"sub":"16000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok($$ select tasa_interes_mensual from public.solicitudes_credito $$, '42501', null,
  'ni el admin lee la columna directo');
select is(
  (select t.tasa_interes_mensual from public.admin_tasas_solicitudes(
     array(select id from public.solicitudes_credito where asociado_id = '16000000-0000-4000-a000-00000000000a')) t),
  0.05076923::numeric,
  'el admin obtiene la tasa con admin_tasas_solicitudes'
);
select ok(not has_function_privilege('anon', 'public.admin_tasas_solicitudes(uuid[])', 'execute'),
  'anon no ejecuta admin_tasas_solicitudes');

select * from finish();
rollback;
