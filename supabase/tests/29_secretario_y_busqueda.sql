-- ============================================================
-- Green Alliance · pgTAP · Rol secretario y búsqueda general de asesores
-- (migración 20261003100000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- ------------------------------------------------------------
-- Datos
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('29000000-0000-4000-a000-0000000000a5', 's.sec@prueba.test',  '{"cedula":"2900000100"}', '{"nombre_completo":"Secretaria Veintinueve"}'),
  ('29000000-0000-4000-a000-0000000000ad', 's.adm@prueba.test',  '{"cedula":"2900000101"}', '{"nombre_completo":"Admin Veintinueve"}'),
  ('29000000-0000-4000-a000-0000000000e1', 's.as1@prueba.test',  '{"cedula":"2900000102"}', '{"nombre_completo":"Asesor Uno Veintinueve"}'),
  ('29000000-0000-4000-a000-0000000000b0', 's.nuevo@prueba.test','{"cedula":"2900000103"}', '{"nombre_completo":"Persona Por Convertir"}'),
  ('29000000-0000-4000-a000-00000000000a', 's.a@prueba.test',    '{"cedula":"2900000001","grado":"PT"}', '{"nombre_completo":"Marta Sinasesor"}'),
  ('29000000-0000-4000-a000-00000000000b', 's.b@prueba.test',    '{"cedula":"2900000002","grado":"PT"}', '{"nombre_completo":"Pedro Buscable"}'),
  ('29000000-0000-4000-a000-00000000000c', 's.c@prueba.test',    '{"cedula":"2900000003","grado":"PT"}', '{"nombre_completo":"Lucia Cooperativa"}'),
  ('29000000-0000-4000-a000-00000000000d', 's.d@prueba.test',    '{"cedula":"2900000004","grado":"PT"}', '{"nombre_completo":"Dario Inactivo Buscable"}');
update public.perfiles set rol = 'secretario' where id = '29000000-0000-4000-a000-0000000000a5';
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '29000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'asesor' where id = '29000000-0000-4000-a000-0000000000e1';
update public.perfiles set asesor_id = '29000000-0000-4000-a000-0000000000e1' where id = '29000000-0000-4000-a000-00000000000b';
update public.perfiles set asesor_id = '29000000-0000-4000-a000-0000000000ad' where id = '29000000-0000-4000-a000-00000000000c';
update public.perfiles set activo = false where id = '29000000-0000-4000-a000-00000000000d';

-- 12 asociados con el mismo apellido para comprobar el tope de 10 resultados
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
select ('29000000-0000-4000-a001-' || lpad(n::text, 12, '0'))::uuid, 's.z' || n || '@prueba.test',
       jsonb_build_object('cedula', '29100000' || lpad(n::text, 2, '0'), 'grado', 'PT'),
       jsonb_build_object('nombre_completo', 'Zeta Masivo ' || n)
  from generate_series(1, 12) n;

insert into public.solicitudes_afiliacion (
  id, nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
) values ('29200000-0000-4000-a000-000000000001', 'Camila', 'Pendiente', '2900000200', 'PT', 'policia', '3002000000', '3002000000',
          'camila.pend@prueba.test', 'solicitudes/29/f.jpg', 'solicitudes/29/r.jpg', 'solicitudes/29/s.jpg', now());

-- ------------------------------------------------------------
-- 1) Helpers y permisos del secretario
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-0000000000a5","role":"authenticated"}';

select ok(public.es_secretario(), 'es_secretario() es true para el secretario');
select ok(not public.es_admin(), 'el secretario NO es admin');
select ok(public.es_admin_o_secretario(), 'es_admin_o_secretario() es true para el secretario');
select isnt(public.admin_metricas_dashboard(), null, 'el secretario ve las métricas del Resumen');

select is(
  (select count(*)::int from public.solicitudes_afiliacion where id = '29200000-0000-4000-a000-000000000001'),
  1, 'el secretario ve las solicitudes de afiliación'
);
select ok(
  (select count(*) from public.perfiles) > 1,
  'el secretario lee perfiles (solo lectura)'
);

select lives_ok(
  $$ update public.solicitudes_afiliacion set estado = 'contactado' where id = '29200000-0000-4000-a000-000000000001' $$,
  'el secretario marca una afiliación como contactada'
);
select is(
  (select estado::text from public.solicitudes_afiliacion where id = '29200000-0000-4000-a000-000000000001'),
  'contactado', 'el cambio de estado quedó guardado'
);
select throws_ok(
  $$ update public.solicitudes_afiliacion set nombres = 'Otro' where id = '29200000-0000-4000-a000-000000000001' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'el secretario solo puede cambiar el estado: los datos del solicitante no se tocan'
);
select is(
  (select count(*)::int from public.historial_afiliaciones
    where solicitud_id = '29200000-0000-4000-a000-000000000001'
      and actor_id = '29000000-0000-4000-a000-0000000000a5'
      and rol_actor = 'secretario' and estado_anterior = 'pendiente' and estado_nuevo = 'contactado'),
  1, 'el cambio de estado quedó en el historial con quién, rol y cuándo'
);
select lives_ok(
  $$ update public.solicitudes_afiliacion set estado = 'rechazada' where id = '29200000-0000-4000-a000-000000000001' $$,
  'el secretario puede rechazar'
);

-- Asignar asesor por la función, y solo por ella
select is_empty(
  $$ with u as (update public.perfiles set asesor_id = '29000000-0000-4000-a000-0000000000e1'
      where id = '29000000-0000-4000-a000-00000000000a' returning 1) select * from u $$,
  'el secretario no actualiza perfiles directamente (RLS)'
);
select lives_ok(
  $$ select public.secretario_asignar_asesor('29000000-0000-4000-a000-00000000000a', '29000000-0000-4000-a000-0000000000e1') $$,
  'el secretario asigna asesor con secretario_asignar_asesor()'
);
select is(
  (select asesor_id::text from public.perfiles where id = '29000000-0000-4000-a000-00000000000a'),
  '29000000-0000-4000-a000-0000000000e1', 'el asesor quedó asignado'
);
select throws_ok(
  $$ select public.secretario_asignar_asesor('29000000-0000-4000-a000-00000000000a', '29000000-0000-4000-a000-0000000000ad') $$,
  'P0001', 'Este asociado ya tiene un asesor asignado',
  'no se cambia un asesor ya asignado'
);
select throws_ok(
  $$ select public.secretario_asignar_asesor('29000000-0000-4000-a000-00000000000d', '29000000-0000-4000-a000-00000000000b') $$,
  'P0001', 'asesor_id debe ser un perfil con rol asesor',
  'el asesor elegido debe poder atender asociados'
);

-- No escala ni toca nada más
select throws_ok(
  $$ update public.perfiles set rol = 'admin' where id = '29000000-0000-4000-a000-0000000000a5' $$,
  'P0001', 'No puede modificar su propio rol',
  'el secretario no puede cambiar su propio rol'
);
select throws_ok(
  $$ update public.perfiles set activo = false where id = '29000000-0000-4000-a000-0000000000a5' $$,
  'P0001', 'El estado del asociado solo se cambia con «Dar de baja» o «Reactivar», con un motivo',
  'el secretario no puede cambiar su propio estado'
);
select throws_ok(
  $$ select public.admin_cambiar_estado_asociado('29000000-0000-4000-a000-00000000000b', false, 'Prueba de baja') $$,
  'P0001', 'Solo un administrador puede cambiar el estado de un asociado',
  'el secretario no da de baja'
);
select throws_ok(
  $$ select * from public.admin_habilitar_credito('29000000-0000-4000-a000-00000000000b', 'Prueba de habilitación') $$,
  'P0001', 'Solo un administrador puede habilitar el crédito de un asociado',
  'el secretario no habilita créditos'
);
select throws_ok(
  $$ select * from public.admin_realizar_sorteo(current_date) $$,
  null::text, null::text, 'el secretario no hace el sorteo'
);
select throws_ok(
  $$ insert into public.convenios (nombre_empresa, descripcion) values ('Convenio del secretario', 'No debe poder') $$,
  '42501', null::text, 'el secretario no crea convenios'
);
select throws_ok(
  $$ insert into public.perfiles (id, cedula, nombre_completo, rol) values (gen_random_uuid(), '2900009999', 'Falso', 'admin') $$,
  '42501', null::text, 'el secretario no inserta perfiles'
);
select is_empty(
  $$ select 1 from public.historial_cambio_rol $$,
  'el secretario no lee el historial de cambios de rol'
);
select is_empty(
  $$ select 1 from public.pagos_comision $$,
  'el secretario no lee pagos de comisión'
);

-- ------------------------------------------------------------
-- 2) Historial de rol (lo escribe el admin al crear/convertir)
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select lives_ok(
  $$ update public.perfiles set rol = 'secretario' where id = '29000000-0000-4000-a000-0000000000b0' $$,
  'el admin convierte a alguien en secretario'
);
select is(
  (select count(*)::int from public.historial_cambio_rol
    where perfil_id = '29000000-0000-4000-a000-0000000000b0'
      and actor_id = '29000000-0000-4000-a000-0000000000ad'
      and rol_anterior = 'asociado' and rol_nuevo = 'secretario'),
  1, 'el cambio de rol quedó en el historial con el admin que lo hizo'
);
select ok(
  (select count(*) from public.historial_afiliaciones) >= 2,
  'el admin también lee el historial de afiliaciones'
);

-- ------------------------------------------------------------
-- 3) Secretario dado de baja pierde el acceso
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
update public.perfiles set activo = false where id = '29000000-0000-4000-a000-0000000000b0';
set local role authenticated;
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-0000000000b0","role":"authenticated"}';
select ok(not public.es_secretario(), 'un secretario inactivo ya no es secretario');
select is(public.admin_metricas_dashboard(), null, 'un secretario inactivo no ve las métricas');

-- Un asociado no ve métricas
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-00000000000b","role":"authenticated"}';
select is(public.admin_metricas_dashboard(), null, 'un asociado no ve las métricas');
select is(
  (select count(*)::int from public.solicitudes_afiliacion), 0,
  'un asociado no ve solicitudes de afiliación'
);

-- ------------------------------------------------------------
-- 4) Búsqueda general para asesores
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-0000000000e1","role":"authenticated"}';

select is(
  (select count(*)::int from public.buscar_asociados_general('Buscable')), 1,
  'el asesor encuentra por nombre y no ve a los inactivos'
);
select results_eq(
  $$ select nombre, cedula_enmascarada, asesor_texto from public.buscar_asociados_general('2900000002') $$,
  $$ values ('Pedro Buscable'::text, '2.9••.•••.002'::text, 'Asesor Uno Veintinueve'::text) $$,
  'por cédula: nombre, cédula enmascarada y nombre del asesor, nada más'
);
select is(
  (select asesor_texto from public.buscar_asociados_general('Lucia Coop')), 'Cooperativa',
  'si lo atiende un administrador se muestra «Cooperativa»'
);
select is(
  (select asesor_texto from public.buscar_asociados_general('Sinasesor')), 'Asesor Uno Veintinueve',
  'refleja la asignación hecha por el secretario'
);
select is(
  (select count(*)::int from public.buscar_asociados_general('Zeta')), 10,
  'máximo 10 resultados'
);
select is(
  (select count(*)::int from public.buscar_asociados_general('Mar')), 0,
  'menos de 4 letras no devuelve nada'
);
select is(
  (select count(*)::int from public.buscar_asociados_general('290')), 0,
  'menos de 4 dígitos no devuelve nada'
);
select is(
  (select count(*)::int from public.buscar_asociados_general('%%%%')), 0,
  'los comodines se escapan: no vuelcan la base'
);
select is(
  (select count(*)::int from public.buscar_asociados_general('2.900.000.002')), 1,
  'la cédula se normaliza (puntos)'
);

-- Quien no atiende no puede buscar
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select * from public.buscar_asociados_general('Buscable') $$,
  '42501', 'Solo los asesores pueden buscar asociados',
  'un asociado no puede usar la búsqueda general'
);
set local request.jwt.claims = '{"sub":"29000000-0000-4000-a000-0000000000a5","role":"authenticated"}';
select throws_ok(
  $$ select * from public.buscar_asociados_general('Buscable') $$,
  '42501', 'Solo los asesores pueden buscar asociados',
  'el secretario tampoco (no atiende asociados)'
);
set local role anon;
select throws_ok(
  $$ select * from public.buscar_asociados_general('Buscable') $$,
  '42501', null::text, 'anon no puede ejecutar la búsqueda'
);

select * from finish();
rollback;
