-- ============================================================
-- Green Alliance · pgTAP · Fase 2 · rol asesor
-- perfiles.asesor_id (validación, autoasignación) y resumen_clientes_asesor()
-- (columna a columna: nunca celular/correo/nequi/fotos).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ------------------------------------------------------------
-- Datos de prueba
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-00000000000b', 'asociado.b@prueba.test', '{"cedula":"1000000002","grado":"OF"}', '{"nombre_completo":"Asociado B"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}'),
  ('00000000-0000-4000-a000-0000000000e1', 'asesor.1@prueba.test',   '{"cedula":"1000000010"}',             '{"nombre_completo":"Asesor Uno"}'),
  ('00000000-0000-4000-a000-0000000000e2', 'asesor.2@prueba.test',   '{"cedula":"1000000011"}',             '{"nombre_completo":"Asesor Dos"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'asesor' where id in
  ('00000000-0000-4000-a000-0000000000e1', '00000000-0000-4000-a000-0000000000e2');

-- ------------------------------------------------------------
-- Reglas de datos (como service role): asesor_id debe ser un asesor real
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ update public.perfiles set asesor_id = '00000000-0000-4000-a000-00000000000a'
      where id = '00000000-0000-4000-a000-00000000000b' $$,
  'P0001', 'asesor_id debe ser un perfil con rol asesor',
  'asesor_id no puede apuntar a un perfil que no es asesor'
);

select throws_ok(
  $$ update public.perfiles set asesor_id = id where id = '00000000-0000-4000-a000-0000000000e1' $$,
  'P0001', 'Un perfil no puede ser su propio asesor',
  'un perfil no puede ser su propio asesor'
);

select lives_ok(
  $$ update public.perfiles set asesor_id = '00000000-0000-4000-a000-0000000000e1'
      where id = '00000000-0000-4000-a000-00000000000a' $$,
  'el admin/servidor sí puede asignar un asesor real'
);

-- ------------------------------------------------------------
-- Sesión: asociado A (ya tiene asesor asignado: e1)
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ update public.perfiles set asesor_id = '00000000-0000-4000-a000-0000000000e2'
      where id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su propio asesor; solicítelo a la administración',
  'un asociado no puede cambiarse su propio asesor'
);

select throws_ok(
  $$ update public.perfiles set asesor_id = null
      where id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su propio asesor; solicítelo a la administración',
  'un asociado no puede quitarse su propio asesor'
);

-- Un asesor tampoco puede autoasignarse el rol (ya cubierto por proteger_campos_perfil,
-- se repite aquí por claridad del nuevo escenario).
select throws_ok(
  $$ update public.perfiles set rol = 'asesor' where id = '00000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su propio rol',
  'un asociado no puede autoasignarse el rol asesor'
);

-- Un asociado sin rol asesor no ve nada con resumen_clientes_asesor()
select is_empty(
  $$ select * from public.resumen_clientes_asesor() $$,
  'un asociado (no asesor) no ve nada en resumen_clientes_asesor'
);

-- ------------------------------------------------------------
-- Sesión: asesor e1 (tiene a Asociado A y una solicitud de afiliación)
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
values ('00000000-0000-4000-a000-00000000000a', '50', 500000);
insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  asesor_id, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
) values (
  'Laura', 'Gómez Ruiz', '1200000001', 'PT', 'ejercito', '3001112233', '3001112233',
  'laura.gomez@ejercito.mil.co', '00000000-0000-4000-a000-0000000000e1',
  'afiliacion-documentos/x/f.jpg', 'afiliacion-documentos/x/r.jpg', 'afiliacion-documentos/x/s.jpg', now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated"}';

select is(
  (select count(*)::int from public.resumen_clientes_asesor()),
  2,
  'el asesor e1 ve 2 filas: su asociado y su solicitud de afiliación'
);

select is(
  (select count(*)::int from public.resumen_clientes_asesor() where origen = 'asociado' and cedula = '1000000001'),
  1,
  'el asesor e1 ve al Asociado A por su cédula'
);

select is(
  (select estado_credito::text from public.resumen_clientes_asesor() where origen = 'asociado' and cedula = '1000000001'),
  'pendiente',
  'el asesor e1 ve el estado de la última solicitud de crédito de su cliente'
);

select is(
  (select estado_afiliacion::text from public.resumen_clientes_asesor() where origen = 'solicitud_afiliacion' and cedula = '1200000001'),
  'pendiente',
  'el asesor e1 ve el estado de la solicitud de afiliación que refirió'
);

-- Columnas prohibidas: la función no las expone en absoluto (no hay columna
-- "celular"/"correo"/"nequi" en su resultado). Se leen los nombres de las
-- columnas de salida (RETURNS TABLE) directamente de pg_proc, porque
-- columns_are() de pgTAP espera una tabla o vista, no una función.
select is(
  (select proargnames from pg_proc
    where pronamespace = 'public'::regnamespace and proname = 'resumen_clientes_asesor'),
  array['origen', 'perfil_id', 'solicitud_id', 'nombre', 'cedula', 'grado', 'estado_afiliacion', 'estado_credito'],
  'resumen_clientes_asesor no expone celular, correo, nequi ni fotos'
);

-- ------------------------------------------------------------
-- Sesión: asesor e2 (sin clientes): no ve los del asesor e1
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000e2","role":"authenticated"}';

select is_empty(
  $$ select * from public.resumen_clientes_asesor() $$,
  'el asesor e2 no ve los clientes del asesor e1'
);

-- ------------------------------------------------------------
-- El asesor no lee la tabla perfiles de otros directamente (RLS normal,
-- sin cambios): solo ve su propio perfil.
-- ------------------------------------------------------------
select results_eq(
  $$ select id from public.perfiles $$,
  array['00000000-0000-4000-a000-0000000000e2'::uuid],
  'el asesor e2 solo ve su propio perfil por RLS normal (el resumen es aparte)'
);

-- ------------------------------------------------------------
-- Privilegios de la función pública de asesores: solo service_role
-- ------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.obtener_asesores_publico()', 'execute'),
  'anon no puede ejecutar obtener_asesores_publico'
);
select ok(
  not has_function_privilege('authenticated', 'public.obtener_asesores_publico()', 'execute'),
  'authenticated no puede ejecutar obtener_asesores_publico'
);
select ok(
  has_function_privilege('service_role', 'public.obtener_asesores_publico()', 'execute'),
  'service_role sí puede ejecutar obtener_asesores_publico'
);

-- (Se filtra por id porque supabase/seed.sql ya trae su propio asesor de
-- prueba; esta prueba solo confirma que aparecen los dos de este archivo.)
reset role;
set local request.jwt.claims = '';
select set_eq(
  $$ select nombre from public.obtener_asesores_publico()
      where id in ('00000000-0000-4000-a000-0000000000e1', '00000000-0000-4000-a000-0000000000e2') $$,
  array['Asesor Uno', 'Asesor Dos'],
  'obtener_asesores_publico lista a los asesores (id filtrado por los de esta prueba)'
);

select set_eq(
  $$ select origen from public.resumen_clientes_asesor() $$,
  array[]::text[],
  'resumen_clientes_asesor() sin auth.uid() (service role) no devuelve filas de nadie'
);

select * from finish();
rollback;
