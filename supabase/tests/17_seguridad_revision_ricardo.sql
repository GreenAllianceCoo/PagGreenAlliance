-- ============================================================
-- Green Alliance · pgTAP · Revisión de seguridad 2026-09-30
-- (20260930100400): RS-01, RS-05, RS-09, RS-10, RS-11, RS-12.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('17000000-0000-4000-a000-0000000000a1', 'r.ric@prueba.test',  '{"cedula":"1700000001"}',              '{"nombre_completo":"Admin Que Atiende"}'),
  ('17000000-0000-4000-a000-0000000000a2', 'r.adm@prueba.test',  '{"cedula":"1700000002"}',              '{"nombre_completo":"Otro Admin"}'),
  ('17000000-0000-4000-a000-0000000000a3', 'r.baja@prueba.test', '{"cedula":"1700000003"}',              '{"nombre_completo":"Admin De Baja"}'),
  ('17000000-0000-4000-a000-0000000000e1', 'r.as@prueba.test',   '{"cedula":"1700000010"}',              '{"nombre_completo":"Asesor R"}'),
  ('17000000-0000-4000-a000-00000000000c', 'r.cli@prueba.test',  '{"cedula":"1234567890123"}',           '{"nombre_completo":"Cliente de Ricardo"}'),
  ('17000000-0000-4000-a000-00000000000d', 'r.cli2@prueba.test', '{"cedula":"1700000020","grado":"PT"}', '{"nombre_completo":"Cliente del Asesor"}');
-- (La cédula de 13 dígitos no pasa el formato: queda PENDIENTE-…; se fija abajo.)
update public.perfiles set cedula = '1700000019', grado = 'PT' where id = '17000000-0000-4000-a000-00000000000c';
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '17000000-0000-4000-a000-0000000000a1';
update public.perfiles set rol = 'admin' where id in ('17000000-0000-4000-a000-0000000000a2', '17000000-0000-4000-a000-0000000000a3');
update public.perfiles set activo = false where id = '17000000-0000-4000-a000-0000000000a3';
update public.perfiles set rol = 'asesor' where id = '17000000-0000-4000-a000-0000000000e1';
update public.perfiles set asesor_id = '17000000-0000-4000-a000-0000000000a1' where id = '17000000-0000-4000-a000-00000000000c';
update public.perfiles set asesor_id = '17000000-0000-4000-a000-0000000000e1' where id = '17000000-0000-4000-a000-00000000000d';
insert into public.procesos_ejecutivos (asociado_id, estado) values
  ('17000000-0000-4000-a000-00000000000c', 'operando'),
  ('17000000-0000-4000-a000-00000000000d', 'operando');
insert into public.pagos_comision (id, asesor_id, periodo_corte, concepto, monto) values
  ('17000000-0000-4000-b000-000000000001', '17000000-0000-4000-a000-0000000000a1', '2026-09-15', 'ingreso_nuevo', 500000),
  ('17000000-0000-4000-b000-000000000003', '17000000-0000-4000-a000-0000000000a1', '2026-09-15', 'embargo_operativo', 100000);
insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
values ('17000000-0000-4000-a000-00000000000d', '50', 500000);

-- ------------------------------------------------------------
-- RS-05: admin de baja
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000a3","role":"authenticated"}';
select is(public.es_admin(), false, 'un admin con activo = false ya no es admin');
select is(
  (select count(*)::int from public.perfiles),
  1,
  'el admin de baja solo ve su propio perfil'
);
select throws_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('17000000-0000-4000-a000-00000000000d', 'terminado') $$,
  'P0001', 'Solo un administrador puede cambiar el proceso ejecutivo',
  'el admin de baja no cambia procesos'
);

set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select is(public.es_admin(), true, 'un admin activo sigue siendo admin');

-- ------------------------------------------------------------
-- RS-01 (regla cambiada 2026-10-01): el admin que atiende sí registra y corrige sus comisiones; el asesor no
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000a1","role":"authenticated"}';

select lives_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('17000000-0000-4000-a000-0000000000a1', '2026-08-15', 'ingreso_nuevo', 5000000) $$,
  'el admin que atiende sí se registra un pago a su propio nombre (aprobado por Sebas 2026-10-01)'
);
select lives_ok(
  $$ select public.admin_editar_pago_comision('17000000-0000-4000-b000-000000000001', 'Corrección de mi propio pago', 550000) $$,
  'el admin que atiende sí corrige un pago propio'
);
select lives_ok(
  $$ select public.admin_anular_pago_comision('17000000-0000-4000-b000-000000000003', 'Anular el mío por error') $$,
  'el admin que atiende sí anula un pago propio'
);
select lives_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('17000000-0000-4000-a000-00000000000c', 'terminado') $$,
  'el admin que atiende sí cambia el proceso de sus propios clientes (aprobado por Sebas 2026-10-01)'
);
select throws_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('17000000-0000-4000-a000-0000000000a1', 'reparto') $$,
  'P0001', 'Otro administrador debe actualizar tu propio proceso',
  'nadie cambia su propio proceso'
);
select lives_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('17000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ingreso_nuevo', 500000) $$,
  'sí registra pagos de otro asesor'
);
select lives_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('17000000-0000-4000-a000-00000000000d', 'operando') $$,
  'sí cambia el proceso de clientes de otro asesor'
);

-- Otro admin sí puede con lo de Ricardo
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.admin_editar_pago_comision('17000000-0000-4000-b000-000000000001', 'Corrección hecha por otro admin', 600000) $$,
  'otro admin corrige el pago del admin que atiende'
);
select lives_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('17000000-0000-4000-a000-00000000000c', 'terminado') $$,
  'otro admin cambia el proceso de los clientes del admin que atiende'
);

-- El asesor (aunque sea el dueño del cliente) sigue sin poder nada de esto
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_actualizar_proceso_ejecutivo('17000000-0000-4000-a000-00000000000d', 'terminado') $$,
  'P0001', 'Solo un administrador puede cambiar el proceso ejecutivo',
  'el asesor no cambia el proceso ejecutivo de sus clientes'
);
select throws_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('17000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ingreso_nuevo', 500000) $$,
  '42501', null,
  'el asesor no se registra pagos de comisión a sí mismo'
);
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000a2","role":"authenticated"}';

-- ------------------------------------------------------------
-- RS-10: un pago nace vigente y con tope
-- ------------------------------------------------------------
insert into public.pagos_comision (id, asesor_id, periodo_corte, concepto, monto, anulado, anulado_por, anulado_at, motivo_anulacion)
values ('17000000-0000-4000-b000-000000000002', '17000000-0000-4000-a000-0000000000e1', '2026-09-15', 'embargo_operativo', 100000,
        true, '17000000-0000-4000-a000-0000000000a1', now(), 'Anulación falsa atribuida a otro');
select is(
  (select anulado::text || '|' || coalesce(anulado_por::text, 'null') || '|' || coalesce(motivo_anulacion, 'null')
     from public.pagos_comision where id = '17000000-0000-4000-b000-000000000002'),
  'false|null|null',
  'un pago no se puede crear «ya anulado»: se fuerza vigente'
);
select throws_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('17000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ingreso_nuevo', 100000000) $$,
  '23514', null,
  'tope de 10.000.000 por pago'
);
select throws_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('17000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ajuste', -10000001) $$,
  '23514', null,
  'el tope también aplica a los ajustes negativos'
);

-- ------------------------------------------------------------
-- RS-09: la cuota tampoco
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-00000000000d","role":"authenticated"}';
select throws_ok($$ select cuota_mensual from public.solicitudes_credito $$, '42501', null,
  'el asociado no lee cuota_mensual (revela la tasa en solicitudes antiguas)');
select lives_ok($$ select id, estado, monto_solicitado from public.solicitudes_credito $$,
  'el asociado sigue leyendo el resto de su solicitud');

set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select is(
  (select count(*)::int from public.admin_tasas_solicitudes(
     array(select id from public.solicitudes_credito where asociado_id = '17000000-0000-4000-a000-00000000000d'))
    where tasa_interes_mensual > 0),
  1,
  'el admin obtiene tasa y cuota con admin_tasas_solicitudes'
);

-- ------------------------------------------------------------
-- RS-12: cédula enmascarada en resumen_clientes_asesor
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"17000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is(
  (select cedula from public.resumen_clientes_asesor() where perfil_id = '17000000-0000-4000-a000-00000000000d'),
  '1.7••.•••.020',
  'resumen_clientes_asesor devuelve la cédula enmascarada'
);
select is(
  (select cedula from public.buscar_cliente_asesor('1700000020')),
  '1700000020',
  'la búsqueda exacta sigue devolviendo la cédula que el asesor escribió'
);
select is(public.enmascarar_cedula('79123456'), '79.1••.456', 'enmascarar 8 dígitos (igual que lib/mascara.ts)');

-- ------------------------------------------------------------
-- RS-11: service_role no escribe bitácora ni historial
-- ------------------------------------------------------------
reset role;
set local role service_role;
select throws_ok(
  $$ insert into public.bitacora_pagos_comision (pago_id, accion, despues, actor_id)
     values ('17000000-0000-4000-b000-000000000001', 'creacion', '{}'::jsonb, '17000000-0000-4000-a000-0000000000a2') $$,
  '42501', null,
  'service_role no fabrica entradas de la bitácora de pagos'
);
select throws_ok(
  $$ insert into public.historial_proceso_ejecutivo (asociado_id, estado_nuevo)
     values ('17000000-0000-4000-a000-00000000000d', 'operando') $$,
  '42501', null,
  'service_role no fabrica entradas del historial del proceso'
);
select throws_ok(
  $$ insert into public.historial_solicitudes (entidad, entidad_id, accion)
     values ('solicitud_credito', gen_random_uuid(), 'aprobado') $$,
  '42501', null,
  'service_role no fabrica entradas del historial de solicitudes'
);

select * from finish();
rollback;
