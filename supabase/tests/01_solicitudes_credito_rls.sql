-- ============================================================
-- Green Alliance · pgTAP · RLS de solicitudes_credito
-- Asociado A (PP), asociado B (OF) y un admin, creados dentro de la
-- transacción. Las sesiones se simulan con:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- ------------------------------------------------------------
-- Datos de prueba (como postgres; el trigger handle_new_user crea los perfiles)
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-00000000000b', 'asociado.b@prueba.test', '{"cedula":"1000000002","grado":"OF"}', '{"nombre_completo":"Asociado B"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}'),
  -- C y D no tienen solicitudes: sirven para probar qué pasa con los campos de revisión en un insert
  ('00000000-0000-4000-a000-00000000000c', 'asociado.c@prueba.test', '{"cedula":"1000000004","grado":"PP"}', '{"nombre_completo":"Asociado C"}'),
  ('00000000-0000-4000-a000-00000000000d', 'asociado.d@prueba.test', '{"cedula":"1000000005","grado":"PP"}', '{"nombre_completo":"Asociado D"}');
update public.perfiles set rol = 'admin', grado = 'PP' where id = '00000000-0000-4000-a000-0000000000ad';

-- Una solicitud pendiente de A y una de B
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual) values
  ('10000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000a', '50', 500000, 0),
  ('10000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000b', '50', 1000000, 0),
  -- El admin también es asociado y tiene su propia pendiente
  ('10000000-0000-4000-a000-0000000000ad', '00000000-0000-4000-a000-0000000000ad', '50', 200000, 0);

-- ------------------------------------------------------------
-- Sesión: asociado A
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.solicitudes_credito where id = '10000000-0000-4000-a000-00000000000a' $$,
  'A ve su propia solicitud'
);

select is_empty(
  $$ select 1 from public.solicitudes_credito where asociado_id = '00000000-0000-4000-a000-00000000000b' $$,
  'A no ve las solicitudes de B'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000b', '50', 100000, 0) $$,
  '42501', null,
  'A no puede crear una solicitud con el asociado_id de B'
);

-- Un asociado que manda estado/revisado_por/fecha_respuesta en el insert no los
-- consigue: el trigger (migración blindar_solicitudes_y_revisiones) los
-- reemplaza por 'pendiente' / null. Se prueba con C y D, que no tienen otra
-- pendiente, para que no interfiera el índice de una sola pendiente.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}';
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual, estado, fecha_respuesta)
  values ('10000000-0000-4000-a000-00000000000c', '00000000-0000-4000-a000-00000000000c', '50', 100000, 0, 'aprobado', now());

select is(
  (select estado::text || '|' || coalesce(fecha_respuesta::text, 'null')
     from public.solicitudes_credito where id = '10000000-0000-4000-a000-00000000000c'),
  'pendiente|null',
  'un asociado no puede crear una solicitud ya aprobada (queda pendiente)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000d","role":"authenticated"}';
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual, revisado_por)
  values ('10000000-0000-4000-a000-00000000000d', '00000000-0000-4000-a000-00000000000d', '50', 100000, 0, '00000000-0000-4000-a000-00000000000d');

select is(
  (select revisado_por from public.solicitudes_credito where id = '10000000-0000-4000-a000-00000000000d'),
  null::uuid,
  'un asociado no puede crear una solicitud con revisado_por (queda en null)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

with u as (
  update public.solicitudes_credito set estado = 'aprobado'
   where id = '10000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 0, 'A no puede cambiar el estado de su solicitud') from u;

with u as (
  update public.solicitudes_credito set monto_solicitado = 100000
   where id = '10000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 0, 'A no puede cambiar el monto de su solicitud') from u;

with u as (
  update public.solicitudes_credito set cuota_mensual = 1
   where id = '10000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 0, 'A no puede cambiar la cuota de su solicitud') from u;

with d as (
  delete from public.solicitudes_credito
   where id = '10000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 0, 'A no puede borrar su solicitud') from d;

select is(
  (select estado::text || '|' || monto_solicitado::text || '|' || cuota_mensual::text
     from public.solicitudes_credito where id = '10000000-0000-4000-a000-00000000000a'),
  'pendiente|500000|206167',
  'la solicitud de A queda intacta tras los intentos de modificarla'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '100', 200000, 0) $$,
  '23505', null,
  'A no puede tener dos solicitudes pendientes'
);

-- ------------------------------------------------------------
-- Sesión: asociado B
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.solicitudes_credito where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  'B no ve las solicitudes de A'
);

-- ------------------------------------------------------------
-- Sesión: anon (sin iniciar sesión)
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select * from public.solicitudes_credito $$,
  '42501', null,
  'anon no puede leer solicitudes de crédito'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual)
     values ('00000000-0000-4000-a000-00000000000a', '50', 100000, 0) $$,
  '42501', null,
  'anon no puede crear solicitudes de crédito'
);

-- ------------------------------------------------------------
-- Sesión: admin
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.solicitudes_credito
    where id in ('10000000-0000-4000-a000-00000000000a', '10000000-0000-4000-a000-00000000000b')),
  2,
  'admin ve las solicitudes de todos los asociados'
);

with u as (
  update public.solicitudes_credito set estado = 'aprobado'
   where id = '10000000-0000-4000-a000-00000000000a' returning 1
) select is(count(*)::int, 1, 'admin puede cambiar el estado de una solicitud') from u;

select is(
  (select revisado_por from public.solicitudes_credito where id = '10000000-0000-4000-a000-00000000000a'),
  '00000000-0000-4000-a000-0000000000ad'::uuid,
  'al aprobar, revisado_por queda con el admin de la sesión'
);

select ok(
  (select fecha_respuesta is not null from public.solicitudes_credito where id = '10000000-0000-4000-a000-00000000000a'),
  'al aprobar, fecha_respuesta la pone el servidor'
);

select throws_ok(
  $$ update public.solicitudes_credito set estado = 'rechazado' where id = '10000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'Una solicitud ya resuelta no puede cambiar de estado',
  'una solicitud aprobada no puede cambiar de estado'
);

select throws_ok(
  $$ update public.solicitudes_credito set monto_solicitado = 600000 where id = '10000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'Una solicitud ya resuelta no se puede modificar',
  'una solicitud aprobada no puede cambiar de monto'
);

select throws_ok(
  $$ update public.solicitudes_credito set asociado_id = '00000000-0000-4000-a000-00000000000a'
      where id = '10000000-0000-4000-a000-00000000000b' $$,
  'P0001', 'Una solicitud no puede cambiar de asociado',
  'una solicitud no se puede mover a otro asociado'
);

select throws_ok(
  $$ update public.solicitudes_credito set estado = 'rechazado' where id = '10000000-0000-4000-a000-00000000000b' $$,
  '23514', null,
  'no se puede rechazar sin motivo'
);

with u as (
  update public.solicitudes_credito set estado = 'rechazado', motivo_rechazo = 'Supera la capacidad de pago'
   where id = '10000000-0000-4000-a000-00000000000b' returning 1
) select is(count(*)::int, 1, 'se puede rechazar con motivo') from u;

select throws_ok(
  $$ update public.solicitudes_credito set estado = 'aprobado' where id = '10000000-0000-4000-a000-0000000000ad' $$,
  'P0001', 'No puede aprobar ni rechazar su propia solicitud; debe hacerlo otro administrador',
  'un admin no puede resolver su propia solicitud'
);

with d as (
  delete from public.solicitudes_credito returning 1
) select is(count(*)::int, 0, 'ni el admin puede borrar solicitudes (se conservan)') from d;

-- ------------------------------------------------------------
-- Sesión: asociado A otra vez (su solicitud ya fue aprobada)
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$ insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual, plazo_meses, fecha_solicitud)
     values ('10000000-0000-4000-a000-0000000000a2', '00000000-0000-4000-a000-00000000000a', '50', 1000000, 1, 99, '2020-01-01') $$,
  'A puede crear su propia solicitud cuando no tiene otra pendiente'
);

select is(
  (select fecha_solicitud from public.solicitudes_credito where id = '10000000-0000-4000-a000-0000000000a2'),
  now(),
  'la fecha_solicitud la pone el servidor, no el cliente'
);

select * from finish();
rollback;
