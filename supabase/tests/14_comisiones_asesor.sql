-- ============================================================
-- Green Alliance · pgTAP · Requerimientos de Ricardo · comisiones del
-- asesor (20260929100500): periodo 16→15, ingresos nuevos / operativos,
-- búsqueda por cédula, pagos_comision y contador de revelaciones.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('14000000-0000-4000-a000-0000000000e1', 'c.x@prueba.test',   '{"cedula":"1400000010"}',              '{"nombre_completo":"Asesor X"}'),
  ('14000000-0000-4000-a000-0000000000e2', 'c.y@prueba.test',   '{"cedula":"1400000011"}',              '{"nombre_completo":"Asesor Y"}'),
  ('14000000-0000-4000-a000-000000000001', 'c.c1@prueba.test',  '{"cedula":"1400000001","grado":"TE"}', '{"nombre_completo":"Cliente Uno"}'),
  ('14000000-0000-4000-a000-000000000002', 'c.c2@prueba.test',  '{"cedula":"1400000002","grado":"PP"}', '{"nombre_completo":"Cliente Dos"}'),
  ('14000000-0000-4000-a000-000000000003', 'c.c3@prueba.test',  '{"cedula":"1400000003","grado":"SI"}', '{"nombre_completo":"Cliente Tres"}'),
  ('14000000-0000-4000-a000-00000000000f', 'c.z@prueba.test',   '{"cedula":"1400000009","grado":"PP"}', '{"nombre_completo":"Asociado Z"}'),
  ('14000000-0000-4000-a000-0000000000ad', 'c.adm@prueba.test', '{"cedula":"1400000099"}',              '{"nombre_completo":"Admin Comisiones"}');
update public.perfiles set rol = 'asesor' where id in ('14000000-0000-4000-a000-0000000000e1', '14000000-0000-4000-a000-0000000000e2');
update public.perfiles set rol = 'admin'  where id = '14000000-0000-4000-a000-0000000000ad';
update public.perfiles set asesor_id = '14000000-0000-4000-a000-0000000000e1'
 where id in ('14000000-0000-4000-a000-000000000001', '14000000-0000-4000-a000-000000000002');
update public.perfiles set asesor_id = '14000000-0000-4000-a000-0000000000e2'
 where id = '14000000-0000-4000-a000-000000000003';

-- Procesos (como postgres):
--   C1: operando desde el inicio del periodo en curso → ingreso nuevo de X.
--   C2: operando desde hace 3 meses (historial llevado a esa fecha) → operativo de X.
--   C3: operando hoy → cliente de Y.
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo) values
  ('14000000-0000-4000-a000-000000000001', 'operando',
     (select inicio from public.periodo_comision((now() at time zone 'America/Bogota')::date))),
  ('14000000-0000-4000-a000-000000000002', 'operando',
     ((now() at time zone 'America/Bogota')::date - interval '3 months')::date),
  ('14000000-0000-4000-a000-000000000003', 'operando', null);
update public.historial_proceso_ejecutivo
   set created_at = (((now() at time zone 'America/Bogota')::date - interval '3 months')::date::timestamp at time zone 'America/Bogota')
 where asociado_id = '14000000-0000-4000-a000-000000000002';

-- ------------------------------------------------------------
-- Periodo de corte
-- ------------------------------------------------------------
select is((select inicio::text || '→' || fin::text from public.periodo_comision('2026-09-15')), '2026-08-16→2026-09-15', 'el 15 cierra el periodo');
select is((select inicio::text || '→' || fin::text from public.periodo_comision('2026-09-16')), '2026-09-16→2026-10-15', 'el 16 abre el periodo');
select is((select inicio::text || '→' || fin::text from public.periodo_comision('2026-01-10')), '2025-12-16→2026-01-15', 'cruce de año');

-- ------------------------------------------------------------
-- Asesor X
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"14000000-0000-4000-a000-0000000000e1","role":"authenticated"}';

select is(
  (select ingresos_nuevos || '|' || valor_ingresos_nuevos || '|' || clientes_operativos || '|' || valor_clientes_operativos || '|' || total_operando_hoy
     from public.comisiones_periodo_asesor()),
  '1|500000|2|200000|2',
  'periodo en curso: 1 ingreso nuevo (500.000) y 2 operativos (200.000)'
);

select is(
  (select ingresos_nuevos || '|' || clientes_operativos
     from public.comisiones_periodo_asesor(((now() at time zone 'America/Bogota')::date - interval '2 months')::date)),
  '0|1',
  'periodo pasado: solo cuenta a quien ya estaba operando al corte (según el historial)'
);

select is(
  (select grado || '|' || grado_nombre || '|' || estado_proceso || '|' || cupo_50 || '|' || cupo_100
     from public.buscar_cliente_asesor(' 1400000001 ')),
  'TE|Teniente|operando|2500000|5000000',
  'buscar por cédula: su cliente, con estado del proceso y cupos del grupo OF'
);

select is_empty($$ select * from public.buscar_cliente_asesor('1400000003') $$, 'no encuentra clientes de otro asesor');
select is_empty($$ select * from public.buscar_cliente_asesor('1400000009') $$, 'no encuentra asociados que no son sus clientes');
select is_empty($$ select * from public.buscar_cliente_asesor('1 or 1=1') $$, 'una cédula inválida no devuelve nada');

select is_empty($$ select 1 from public.pagos_comision $$, 'el asesor no lee pagos_comision (su total sale solo al revelar)');

select throws_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('14000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ingreso_nuevo', 9999999) $$,
  '42501', null,
  'el asesor no se registra pagos'
);

select throws_ok(
  $$ select * from public.revelaciones_acumulado_comision $$,
  '42501', null,
  'el asesor no lee el contador de revelaciones'
);

-- ------------------------------------------------------------
-- Asesor Y: solo lo suyo
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"14000000-0000-4000-a000-0000000000e2","role":"authenticated"}';
select is(
  (select clientes_operativos from public.comisiones_periodo_asesor()),
  1,
  'el asesor Y solo cuenta a su cliente'
);

-- ------------------------------------------------------------
-- Asociado Z: nada
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"14000000-0000-4000-a000-00000000000f","role":"authenticated"}';
select is_empty($$ select * from public.comisiones_periodo_asesor() $$, 'un asociado no obtiene comisiones');
select is_empty($$ select * from public.buscar_cliente_asesor('1400000001') $$, 'un asociado no busca clientes');
select throws_ok(
  $$ select public.revelar_acumulado_comision() $$,
  'P0001', 'Solo los asesores pueden ver su acumulado de comisiones',
  'un asociado no revela acumulados'
);

-- ------------------------------------------------------------
-- Admin: registra pagos (libro sin update ni delete)
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"14000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select lives_ok(
  $$ insert into public.pagos_comision (asesor_id, asociado_id, periodo_corte, concepto, monto, registrado_por)
     values ('14000000-0000-4000-a000-0000000000e1', '14000000-0000-4000-a000-000000000001', '2026-09-15', 'ingreso_nuevo', 500000,
             '14000000-0000-4000-a000-0000000000e2') $$,
  'el admin registra un pago de comisión'
);

select is(
  (select registrado_por from public.pagos_comision where asesor_id = '14000000-0000-4000-a000-0000000000e1'),
  '14000000-0000-4000-a000-0000000000ad'::uuid,
  'registrado_por lo pone el servidor (se ignora lo que mande el cliente)'
);

select throws_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('14000000-0000-4000-a000-00000000000f', '2026-09-15', 'ingreso_nuevo', 500000) $$,
  'P0001', 'El pago debe ser para un asesor activo',
  'no se registran pagos a quien no es asesor'
);

select throws_ok(
  $$ insert into public.pagos_comision (asesor_id, periodo_corte, concepto, monto)
     values ('14000000-0000-4000-a000-0000000000e1', '2026-09-10', 'ingreso_nuevo', 500000) $$,
  '23514', null,
  'el periodo de corte siempre es un día 15'
);

select throws_ok(
  $$ update public.pagos_comision set monto = 1 where asesor_id = '14000000-0000-4000-a000-0000000000e1' $$,
  '42501', null,
  'ni el admin edita un pago (se corrige con un ajuste)'
);

select throws_ok(
  $$ delete from public.pagos_comision where asesor_id = '14000000-0000-4000-a000-0000000000e1' $$,
  '42501', null,
  'ni el admin borra un pago'
);

select throws_ok(
  $$ select * from public.revelaciones_acumulado_comision $$,
  '42501', null,
  'el admin tampoco lee el contador de revelaciones desde la app'
);

-- ------------------------------------------------------------
-- X revela su acumulado dos veces
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"14000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is(public.revelar_acumulado_comision(), 500000::numeric, 'revelar devuelve la suma de sus pagos');
select is(public.revelar_acumulado_comision(), 500000::numeric, 'revelar otra vez devuelve lo mismo');

set local role service_role;
select throws_ok(
  $$ select * from public.revelaciones_acumulado_comision $$,
  '42501', null,
  'ni service_role lee el contador (solo el SQL Editor)'
);

reset role;
set local request.jwt.claims = '';
select is(
  (select veces from public.revelaciones_acumulado_comision where asesor_id = '14000000-0000-4000-a000-0000000000e1'),
  1,
  'el contador suma 1 por revelación, como máximo 1 por minuto (RS-21; visto como postgres)'
);

-- ------------------------------------------------------------
-- F2-03: si X deja de ser asesor, pierde el acceso
-- ------------------------------------------------------------
update public.perfiles set rol = 'asociado' where id = '14000000-0000-4000-a000-0000000000e1';
set local role authenticated;
set local request.jwt.claims = '{"sub":"14000000-0000-4000-a000-0000000000e1","role":"authenticated"}';

select is_empty($$ select * from public.comisiones_periodo_asesor() $$, 'ex asesor: sin comisiones');
select is_empty($$ select * from public.buscar_cliente_asesor('1400000001') $$, 'ex asesor: no busca a sus antiguos clientes');

select * from finish();
rollback;
