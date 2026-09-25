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

select plan(23);

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
-- Tasa de interés mensual por grado y porcentaje (PP 100% se borró arriba)
-- ------------------------------------------------------------
select is(
  (select string_agg(grado::text || porcentaje::text || '=' || tasa_interes_mensual::text, ' ' order by grado, porcentaje)
     from public.grados_credito),
  'PP50=0.07900000 PT50=0.05076923 PT100=0.03740741 SI50=0.08200000 SI100=0.08200000 IT50=0.05050000 IT100=0.05050000 OF50=0.05395349 OF100=0.06333333',
  'cada grado y porcentaje tiene su tasa de interés mensual (interés de la tabla / tope)'
);

-- ------------------------------------------------------------
-- Aceptación: grado, tasa y plazo los pone el servidor; la cuota no se calcula
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual, plazo_meses, grado, tasa_interes_mensual)
     values ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000a', '50', 1000000, 1, 99, 'OF', 0.00000001) $$,
  'acepta monto igual al tope del grado (PP 50% = 1.000.000)'
);

select is(
  (select grado::text || '|' || tasa_interes_mensual::text || '|' || plazo_meses::text || '|' || coalesce(cuota_mensual::text, 'null')
     from public.solicitudes_credito where id = '20000000-0000-4000-a000-000000000001'),
  'PP|0.07900000|3|null',
  'grado, tasa y plazo los pone el servidor aunque el insert mande otros; la cuota queda en null'
);

delete from public.solicitudes_credito;

insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado) values
  ('00000000-0000-4000-a000-00000000000a', '50', 500000),
  ('00000000-0000-4000-a000-00000000000d', '100', 1350000);

select is(
  (select tasa_interes_mensual from public.solicitudes_credito where asociado_id = '00000000-0000-4000-a000-00000000000d'),
  0.03740741::numeric,
  'la solicitud guarda la tasa de su grado y porcentaje (PT 100%)'
);

-- ------------------------------------------------------------
-- Solicitud pendiente: condiciones fijas (primero en llegar, primero en salir)
-- Quedan pendientes: A (PP 50%) y D (PT 100%).
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
  (select tasa_interes_mensual::text from public.solicitudes_credito
    where asociado_id = '00000000-0000-4000-a000-00000000000a'),
  '0.07900000',
  'la pendiente conserva la tasa con que se pidió'
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
