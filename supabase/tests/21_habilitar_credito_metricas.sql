-- Green Alliance · pgTAP · 20261001100000 (§13.2 habilitar crédito; métricas D-22/D-23)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('21000000-0000-4000-a000-0000000000ad', 'h.adm@prueba.test', '{"cedula":"2100000009"}', '{"nombre_completo":"Admin H"}'),
  ('21000000-0000-4000-a000-0000000000e1', 'h.as@prueba.test',  '{"cedula":"2100000010"}', '{"nombre_completo":"Asesor H"}'),
  ('21000000-0000-4000-a000-00000000000a', 'h.a@prueba.test',   '{"cedula":"2100000001","grado":"PT"}', '{"nombre_completo":"Cliente H"}'),
  ('21000000-0000-4000-a000-00000000000b', 'h.b@prueba.test',   '{"cedula":"2100000002","grado":"PT"}', '{"nombre_completo":"Otro H"}');
update public.perfiles set rol = 'admin'  where id = '21000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'asesor' where id = '21000000-0000-4000-a000-0000000000e1';
update public.perfiles set asesor_id = '21000000-0000-4000-a000-0000000000e1' where id = '21000000-0000-4000-a000-00000000000a';

-- Solicitudes ya resueltas (sin pasar por los triggers de creación).
alter table public.solicitudes_credito disable trigger user;
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual,
  grado, grado_asociado, estado, motivo_rechazo, fecha_respuesta, fecha_desembolso, fecha_solicitud, tasa_interes_mensual) values
  ('21100000-0000-4000-a000-00000000000a', '21000000-0000-4000-a000-00000000000a', '50', 300000, 0,
   'PT', 'PT', 'rechazado', 'Capacidad insuficiente', now(), null, now(), 0.02),
  ('21100000-0000-4000-a000-00000000000b', '21000000-0000-4000-a000-00000000000b', '50', 400000, 0,
   'PT', 'PT', 'aprobado', null, now(), (now() at time zone 'America/Bogota')::date, now(), 0.02);
alter table public.solicitudes_credito enable trigger user;

select has_function('public', 'admin_habilitar_credito', array['uuid', 'text'], 'existe admin_habilitar_credito');
select ok(not has_function_privilege('anon', 'public.admin_habilitar_credito(uuid, text)', 'execute'), 'anon no la ejecuta');
select ok(not has_function_privilege('anon', 'public.mi_habilitacion_credito()', 'execute'), 'anon no ejecuta mi_habilitacion_credito');

set local role authenticated;
-- Asociado: no puede habilitar
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_habilitar_credito('21000000-0000-4000-a000-00000000000a', 'Quiero otra') $$,
  'P0001', 'Solo un administrador puede habilitar el crédito de un asociado', 'un asociado no se habilita a sí mismo');
select is(public.mi_habilitacion_credito(), null, 'antes de habilitar: null');

-- Admin
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_habilitar_credito('21000000-0000-4000-a000-00000000000a', 'abc') $$,
  'P0001', 'El motivo debe tener entre 5 y 300 caracteres', 'motivo corto');
select throws_ok($$ select * from public.admin_habilitar_credito('21000000-0000-4000-a000-0000000000ad', 'Para mi mismo') $$,
  'P0001', 'No puedes habilitar tu propio crédito; debe hacerlo otro administrador', 'no a sí mismo');
select throws_ok($$ select * from public.admin_habilitar_credito('21000000-0000-4000-a000-00000000000b', 'No aplica aqui') $$,
  'P0001', 'El asociado no tiene un crédito rechazado por habilitar', 'solo si la última está rechazada');
select is((select bloqueos from public.admin_habilitar_credito('21000000-0000-4000-a000-00000000000a', 'Revisado con tesorería')),
  array['no_operando']::text[], 'habilita y avisa lo que aún bloquea');
select throws_ok($$ select * from public.admin_habilitar_credito('21000000-0000-4000-a000-00000000000a', 'Otra vez igual') $$,
  'P0001', 'Este rechazo ya fue habilitado', 'no se habilita dos veces');
select is((select count(*)::int from public.historial_solicitudes
           where entidad_id = '21100000-0000-4000-a000-00000000000a' and accion = 'credito_habilitado'), 1,
  'queda en el historial');
select is((select estado::text from public.solicitudes_credito where id = '21100000-0000-4000-a000-00000000000a'),
  'rechazado', 'la rechazada no cambia');
reset role;

-- Inmutable (aun para el dueño de la tabla)
select throws_ok($$ delete from public.historial_solicitudes where accion = 'credito_habilitado' $$,
  'P0001', 'El registro de habilitación de crédito no se puede modificar ni borrar', 'no se borra');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select isnt(public.mi_habilitacion_credito(), null, 'el asociado ve la fecha de habilitación');

-- Métricas
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select ok(public.admin_metricas_dashboard() ? 'por_estado_proceso', 'admin: por_estado_proceso');
select ok((public.admin_metricas_dashboard() -> 'desembolsos_mes' ->> 'monto')::bigint >= 400000
          and (public.admin_metricas_dashboard() -> 'desembolsos_mes' ->> 'conteo')::int >= 1, 'admin: desembolsos_mes');
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true);
select is(public.asesor_metricas_dashboard() -> 'por_estado_proceso' ->> 'sin_proceso', '1', 'asesor: por_estado_proceso');
reset role;

select * from finish();
rollback;
