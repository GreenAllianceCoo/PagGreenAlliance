-- ============================================================
-- Green Alliance · pgTAP · Recuperación de acceso (20261002500000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('27000000-0000-4000-a000-000000000001', 'r.uno@prueba.test', '{"cedula":"2700000001","grado":"PP"}', '{"nombre_completo":"Asociado R1"}'),
  ('27000000-0000-4000-a000-000000000002', 'r.dos@prueba.test', '{"cedula":"2700000002","grado":"PT"}', '{"nombre_completo":"Asociado R2"}'),
  ('27000000-0000-4000-a000-0000000000a1', 'r.as@prueba.test', '{"cedula":"2700000003","grado":"PT"}', '{"nombre_completo":"Asesor R"}'),
  ('27000000-0000-4000-a000-0000000000ad', 'r.ad@prueba.test', '{"cedula":"2700000004","grado":"PT"}', '{"nombre_completo":"Admin R"}'),
  ('27000000-0000-4000-a000-0000000000ae', 'r.ad2@prueba.test', '{"cedula":"2700000005","grado":"PT"}', '{"nombre_completo":"Admin R2"}');
update public.perfiles set rol = 'asesor' where id = '27000000-0000-4000-a000-0000000000a1';
update public.perfiles set rol = 'admin' where id in ('27000000-0000-4000-a000-0000000000ad', '27000000-0000-4000-a000-0000000000ae');
update public.perfiles set telefono = '3001112233' where id = '27000000-0000-4000-a000-000000000001';
-- El admin «ad» atiende asociados y es el asesor del asociado 2 (RS-01).
update public.perfiles set atiende_asociados = true where id = '27000000-0000-4000-a000-0000000000ad';
update public.perfiles set asesor_id = '27000000-0000-4000-a000-0000000000ad' where id = '27000000-0000-4000-a000-000000000002';

-- Estructura y privilegios
select ok(
  (select relrowsecurity from pg_class where oid = 'public.solicitudes_recuperacion_acceso'::regclass),
  'solicitudes_recuperacion_acceso tiene RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.historial_cambio_correo_ingreso'::regclass),
  'historial_cambio_correo_ingreso tiene RLS'
);
select ok(
  not has_function_privilege('anon', 'public.crear_solicitud_recuperacion(text, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.crear_solicitud_recuperacion(text, text, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.crear_solicitud_recuperacion(text, text, text, text)', 'execute'),
  'crear_solicitud_recuperacion: solo service_role'
);
select ok(
  not has_function_privilege('anon', 'public.admin_registrar_cambio_correo(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_rechazar_recuperacion(uuid, text)', 'execute'),
  'anon no ejecuta las funciones de admin de recuperación'
);

-- Crear solicitud (service role)
select isnt(
  public.crear_solicitud_recuperacion('2700000001', 'nuevo.uno@prueba.test', '3001112233', 'Perdí el acceso a mi correo'),
  null, 'cédula de asociado activo: crea la solicitud'
);
select is(
  (select celular_coincide from public.solicitudes_recuperacion_acceso where cedula = '2700000001'),
  true, 'el celular escrito coincide con el del perfil'
);
select is(
  public.crear_solicitud_recuperacion('2700000001', 'otro.uno@prueba.test', '3009998877', 'Segundo intento de la misma persona'),
  null, 'ya hay una pendiente: no crea otra'
);
select is(
  (select count(*)::int from public.solicitudes_recuperacion_acceso where cedula = '2700000001'),
  1, 'una sola pendiente por persona'
);
select is(
  public.crear_solicitud_recuperacion('2799999999', 'x@prueba.test', '3001112233', 'Cédula que no existe'),
  null, 'cédula inexistente: no crea nada'
);
select is(
  public.crear_solicitud_recuperacion('2700000003', 'x@prueba.test', '3001112233', 'Un asesor no usa este formulario'),
  null, 'cédula de asesor: no crea nada'
);
select is(
  public.crear_solicitud_recuperacion('2700000002', 'R.DOS@prueba.test', '3001112233', 'Pide el mismo correo que ya tiene'),
  null, 'mismo correo que ya tiene: no crea nada'
);

-- RLS: el asociado no ve nada; el admin sí
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.solicitudes_recuperacion_acceso), 0, 'el asociado no lee solicitudes de recuperación');
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001', 'Intento de un asociado') $$,
  'Solo un administrador puede cambiar el correo de ingreso',
  'un asociado no puede registrar cambios de correo'
);
select throws_ok(
  $$ insert into public.solicitudes_recuperacion_acceso (perfil_id, cedula, correo_nuevo, celular, motivo)
     values ('27000000-0000-4000-a000-000000000001', '2700000001', 'x@prueba.test', '3001112233', 'Insert directo no permitido') $$,
  '42501', null, 'authenticated no inserta directo'
);

select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select is((select count(*)::int from public.solicitudes_recuperacion_acceso), 1, 'el admin lee las solicitudes');

-- RS-01: el asesor-admin no cambia el correo de sus clientes
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000002', 'Cambio sobre mi propio cliente') $$,
  'Otro administrador debe cambiar el correo de tus clientes',
  'RS-01: el admin que atiende al asociado no puede cambiarle el correo'
);

-- Otro admin: motivo obligatorio y cierre de la solicitud
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
-- SEC-REC-03: sin solicitud pendiente no se cambia el correo de nadie
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000002', 'Sin solicitud pendiente') $$,
  'No hay una solicitud de recuperación pendiente de esta persona',
  'SEC-REC-03: sin solicitud pendiente no se cambia el correo'
);
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001', 'cort') $$,
  'El motivo debe tener entre 5 y 300 caracteres'
);
select isnt(
  public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001', 'Verificado por llamada'),
  null, 'el admin registra el cambio de correo'
);
select is(
  (select estado from public.solicitudes_recuperacion_acceso where cedula = '2700000001'),
  'atendida', 'la solicitud pendiente queda atendida'
);
select is(
  (select count(*)::int from public.historial_cambio_correo_ingreso where perfil_id = '27000000-0000-4000-a000-000000000001' and origen = 'admin'),
  1, 'queda una fila en el historial'
);

-- Rechazar
reset role;
select isnt(
  public.crear_solicitud_recuperacion('2700000001', 'otro.uno@prueba.test', '3001112233', 'Nueva solicitud de la misma persona'),
  null, 'tras resolver, puede pedir otra'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select lives_ok(
  $$ select public.admin_rechazar_recuperacion((select id from public.solicitudes_recuperacion_acceso where estado = 'pendiente' limit 1), 'No se pudo verificar') $$,
  'el admin rechaza con motivo'
);

-- SEC-REC-03: quien le cambió el asesor hace menos de 24 h no le cambia el correo
reset role;
select isnt(
  public.crear_solicitud_recuperacion('2700000001', 'tercero.uno@prueba.test', '3001112233', 'Otra solicitud tras el rechazo'),
  null, 'se crea una nueva solicitud para la prueba del asesor'
);
insert into public.historial_cambio_asesor (perfil_id, actor_id)
values ('27000000-0000-4000-a000-000000000001', '27000000-0000-4000-a000-0000000000ae');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_validar_cambio_correo('27000000-0000-4000-a000-000000000001', 'Validar tras cambiar el asesor') $$,
  'Otro administrador debe cambiar el correo: cambiaste el asesor de esta persona hace menos de 24 horas',
  'SEC-REC-03: no cambia el correo quien cambió el asesor hace menos de 24 h'
);
reset role;

-- El trigger de perfiles deja huella de cada cambio de asesor
select set_config('request.jwt.claims', '', true);
update public.perfiles set asesor_id = '27000000-0000-4000-a000-0000000000a1' where id = '27000000-0000-4000-a000-000000000001';
select is(
  (select count(*)::int from public.historial_cambio_asesor where perfil_id = '27000000-0000-4000-a000-000000000001' and actor_id is null),
  1, 'el cambio de asesor queda registrado'
);

-- SEC-REC-02: un cambio de correo directo en auth.users deja huella
update auth.users set email = 'dos.directo@prueba.test' where id = '27000000-0000-4000-a000-000000000002';
select is(
  (select count(*)::int from public.historial_cambio_correo_ingreso where perfil_id = '27000000-0000-4000-a000-000000000002' and origen = 'auth'),
  1, 'SEC-REC-02: cambio de correo directo en Auth queda en el historial'
);

-- SEC-REC-04: cerrar sesiones solo service_role
select ok(
  not has_function_privilege('anon', 'public.cerrar_sesiones_usuario(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.cerrar_sesiones_usuario(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.cerrar_sesiones_usuario(uuid)', 'execute'),
  'cerrar_sesiones_usuario: solo service_role'
);

select * from finish();
rollback;
