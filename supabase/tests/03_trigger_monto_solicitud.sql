-- ============================================================
-- Green Alliance · pgTAP · trigger chk_monto_solicitud
-- (función public.validar_monto_solicitud)
-- Tope por grado y porcentaje, monto > 0, y recálculo de cuota/plazo
-- en el servidor.
-- Los inserts se hacen como postgres: el trigger aplica igual para
-- cualquier rol (las pruebas de RLS están en 01_solicitudes_credito_rls.sql).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- ------------------------------------------------------------
-- Datos de prueba
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A (PP)"}'),
  ('00000000-0000-4000-a000-00000000000b', 'asociado.b@prueba.test', '{"cedula":"1000000002","grado":"OF"}', '{"nombre_completo":"Asociado B (OF)"}'),
  ('00000000-0000-4000-a000-00000000000c', 'asociado.c@prueba.test', '{"cedula":"1000000004"}',             '{"nombre_completo":"Asociado C (sin grado)"}'),
  ('00000000-0000-4000-a000-00000000000d', 'asociado.d@prueba.test', '{"cedula":"1000000005","grado":"PT"}', '{"nombre_completo":"Asociado D (PT)"}'),
  ('00000000-0000-4000-a000-00000000000e', 'asociado.e@prueba.test', '{"cedula":"1000000006","grado":"IT"}', '{"nombre_completo":"Asociado E (IT)"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

-- ------------------------------------------------------------
-- Rechazos
-- ------------------------------------------------------------
select throws_like(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 1000001, 0) $$,
  '%supera el tope%',
  'rechaza monto mayor al tope del grado (PP 50% = 1.000.000; pide 1.000.001)'
);

select throws_like(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '100', 4200000, 0) $$,
  '%supera el tope%',
  'el tope sale del grado del perfil: un PP no puede pedir el tope de un OF'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 0, 0) $$,
  'P0001', 'El monto solicitado debe ser mayor que cero',
  'rechaza monto igual a cero'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', -1, 0) $$,
  'P0001', 'El monto solicitado debe ser mayor que cero',
  'rechaza monto negativo'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 'NaN', 0) $$,
  'P0001', null,
  'rechaza monto NaN'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 'Infinity', 0) $$,
  'P0001', null,
  'rechaza monto Infinity'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000c', '50', 100000, 0) $$,
  'P0001', 'El asociado no tiene un grado asignado; no se puede calcular el tope de crédito',
  'rechaza la solicitud de un asociado sin grado'
);

-- Grado sin tope configurado: se borra la fila PP/100% (se revierte al final)
delete from public.grados_credito where grado = 'PP' and porcentaje = '100';

select throws_like(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '100', 100000, 0) $$,
  'No hay un tope configurado%',
  'rechaza la solicitud si el grado no tiene tope configurado para ese porcentaje'
);


select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 99999, 0) $$,
  'P0001', 'El monto mínimo de un crédito es 100000',
  'rechaza monto menor al mínimo (99.999)'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 500000.5, 0) $$,
  'P0001', 'El monto solicitado debe ser un valor en pesos, sin decimales',
  'rechaza monto con decimales'
);

-- ------------------------------------------------------------
-- Aceptación y cálculo en servidor
--   interés = round(monto × tasa); total = monto + interés × 3; cuota = ceil(total / 3)
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual, plazo_meses, grado, tasa_interes_mensual, interes_mensual, total_a_pagar)
     values ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000a', '50', 1000000, 1, 99, 'OF', 0.00000001, 1, 1) $$,
  'acepta monto igual al tope del grado (PP 50% = 1.000.000)'
);

select is(
  (select grado::text || '|' || tasa_interes_mensual::text || '|' || plazo_meses::text || '|'
          || interes_mensual::text || '|' || cuota_mensual::text || '|' || total_a_pagar::text
     from public.solicitudes_credito where id = '20000000-0000-4000-a000-000000000001'),
  'PP|0.07900000|3|79000|412334|1237000',
  'grado, tasa, plazo, interés, cuota y total los pone el servidor aunque el insert mande otros'
);

delete from public.solicitudes_credito;

with i as (
  insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
  values ('00000000-0000-4000-a000-00000000000a', '50', 500000, 0) returning cuota_mensual
) select is(cuota_mensual, 206167::numeric, 'PP 50% 500.000 → interés 39.500, cuota 206.167') from i;

with i as (
  insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
  values ('00000000-0000-4000-a000-00000000000d', '100', 1350000, 0) returning cuota_mensual
) select is(cuota_mensual, 500500::numeric, 'PT 100% 1.350.000 → interés 50.500, cuota 500.500') from i;

with i as (
  insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
  values ('00000000-0000-4000-a000-00000000000b', '100', 1000000, 0) returning total_a_pagar::text || '|' || cuota_mensual::text
) select is((select * from i), '1189999|396667', 'OF 100% 1.000.000 → total 1.189.999, cuota 396.667 (redondea hacia arriba)');

with i as (
  insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
  values ('00000000-0000-4000-a000-00000000000e', '100', 4000000, 0) returning interes_mensual::text || '|' || total_a_pagar::text
) select is((select * from i), '202000|4606000', 'IT 100% al tope → interés de la tabla (202.000)');

select is(
  (select array_agg(c.interes_mensual order by g.grado, g.porcentaje)
     from public.grados_credito g
     cross join lateral public.calcular_credito(g.capacidad_maxima, g.tasa_interes_mensual, g.plazo_meses) c),
  (select array_agg(g.cuota_mensual order by g.grado, g.porcentaje) from public.grados_credito g),
  'al tope, el interés calculado con la tasa es el de la tabla de la presentación en todos los rangos'
);

-- ------------------------------------------------------------
-- Solicitud pendiente: condiciones fijas (primero en llegar, primero en salir)
-- Quedan pendientes: A (PP 50%), D (PT 100%), B (OF 100%), E (IT 100%).
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select throws_ok(
  $$ update public.solicitudes_credito set monto_solicitado = 1000000
      where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'Las condiciones de una solicitud no se pueden modificar; recházela y cree una nueva',
  'el admin no puede cambiar el monto de una pendiente'
);

select throws_ok(
  $$ update public.solicitudes_credito set cuota_mensual = 1
      where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'Las condiciones de una solicitud no se pueden modificar; recházela y cree una nueva',
  'el admin no puede cambiar la cuota de una pendiente'
);

select throws_ok(
  $$ update public.solicitudes_credito set plazo_meses = 12
      where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'Las condiciones de una solicitud no se pueden modificar; recházela y cree una nueva',
  'el admin no puede cambiar el plazo de una pendiente'
);

select throws_like(
  $$ update public.grados_credito set capacidad_maxima = 900000 where grado = 'PP' and porcentaje = '50' $$,
  'No se puede bajar ni eliminar el tope de PP%',
  'no se puede bajar un tope con solicitudes pendientes de ese grado y porcentaje'
);

select throws_like(
  $$ delete from public.grados_credito where grado = 'PP' and porcentaje = '50' $$,
  'No se puede bajar ni eliminar el tope de PP%',
  'no se puede borrar un tope con solicitudes pendientes de ese grado y porcentaje'
);

select lives_ok(
  $$ update public.grados_credito set capacidad_maxima = 1100000, tasa_interes_mensual = 0.05
      where grado = 'PP' and porcentaje = '50' $$,
  'sí se puede subir el tope y cambiar la tasa con pendientes'
);

select is(
  (select tasa_interes_mensual::text || '|' || cuota_mensual::text from public.solicitudes_credito
    where asociado_id = '00000000-0000-4000-a000-00000000000a'),
  '0.07900000|206167',
  'la pendiente conserva la tasa y la cuota con que se pidió'
);

select lives_ok(
  $$ update public.grados_credito set capacidad_maxima = 900000 where grado = 'SI' and porcentaje = '50' $$,
  'se puede bajar el tope de un rango sin pendientes'
);

update public.solicitudes_credito set estado = 'rechazado', motivo_rechazo = 'Prueba'
 where asociado_id = '00000000-0000-4000-a000-00000000000a';

select lives_ok(
  $$ update public.grados_credito set capacidad_maxima = 900000 where grado = 'PP' and porcentaje = '50' $$,
  'resuelta la pendiente, ya se puede bajar el tope'
);

select * from finish();
rollback;
