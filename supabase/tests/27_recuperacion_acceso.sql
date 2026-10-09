-- ============================================================
-- Green Alliance · pgTAP · Recuperación de acceso (20261002500000) + hallazgos del 8-oct H-03 y H-05 (20261009000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('27000000-0000-4000-a000-000000000001', 'r.uno@prueba.test', '{"cedula":"2700000001","grado":"PT"}', '{"nombre_completo":"Asociado R1"}'),
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
  not has_function_privilege('anon', 'public.admin_registrar_cambio_correo(uuid, uuid, text)', 'execute')
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
select isnt(
  public.crear_solicitud_recuperacion('2700000001', 'otro.uno@prueba.test', '3009998877', 'Segundo intento de la misma persona'),
  null, 'H-05: con una pendiente, otra con otro correo también se crea'
);
select is(
  public.crear_solicitud_recuperacion('2700000001', 'OTRO.uno@prueba.test', '3009998877', 'Repite exactamente el mismo pedido'),
  null, 'H-05: repetir el mismo correo no duplica la solicitud'
);
select is(
  (select count(*)::int from public.solicitudes_recuperacion_acceso where cedula = '2700000001' and estado = 'pendiente'),
  2, 'H-05: dos pendientes por persona (un tercero ya no bloquea a la víctima)'
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
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001', gen_random_uuid(), 'Intento de un asociado') $$,
  'Solo un administrador puede cambiar el correo de ingreso',
  'un asociado no puede registrar cambios de correo'
);
select throws_ok(
  $$ insert into public.solicitudes_recuperacion_acceso (perfil_id, cedula, correo_nuevo, celular, motivo)
     values ('27000000-0000-4000-a000-000000000001', '2700000001', 'x@prueba.test', '3001112233', 'Insert directo no permitido') $$,
  '42501', null, 'authenticated no inserta directo'
);

select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select is((select count(*)::int from public.solicitudes_recuperacion_acceso), 2, 'el admin lee todas las solicitudes (H-05: varias por persona)');

-- RS-01: el asesor-admin no cambia el correo de sus clientes
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000002', gen_random_uuid(), 'Cambio sobre mi propio cliente') $$,
  'Otro administrador debe cambiar el correo de tus clientes',
  'RS-01: el admin que atiende al asociado no puede cambiarle el correo'
);

-- Otro admin: motivo obligatorio y cierre de la solicitud
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
-- SEC-REC-03: sin solicitud pendiente no se cambia el correo de nadie
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000002', gen_random_uuid(), 'Sin solicitud pendiente') $$,
  'No hay una solicitud de recuperación pendiente de esta persona',
  'SEC-REC-03: sin solicitud pendiente no se cambia el correo'
);
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001',
       (select id from public.solicitudes_recuperacion_acceso where correo_nuevo = 'nuevo.uno@prueba.test'), 'cort') $$,
  'El motivo debe tener entre 5 y 300 caracteres'
);
-- H-03: la solicitud elegida debe ser pendiente de ESA persona
select throws_ok(
  $$ select public.admin_validar_cambio_correo('27000000-0000-4000-a000-000000000001', gen_random_uuid(), 'Solicitud inventada') $$,
  'La solicitud elegida no es una solicitud pendiente de esta persona',
  'H-03: no se aplica una solicitud que no es de la persona'
);
-- H-03: 10 minutos de espera desde que se creó
select throws_ok(
  $$ select * from public.admin_validar_cambio_correo('27000000-0000-4000-a000-000000000001',
       (select id from public.solicitudes_recuperacion_acceso where correo_nuevo = 'nuevo.uno@prueba.test'), 'Verificado por llamada') $$,
  'La solicitud debe tener al menos 10 minutos de creada',
  'H-03: una solicitud recién creada no se puede aplicar'
);
reset role;
update public.solicitudes_recuperacion_acceso set created_at = now() - interval '20 minutes' where cedula = '2700000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select is(
  (select o_correo_nuevo from public.admin_validar_cambio_correo('27000000-0000-4000-a000-000000000001',
     (select id from public.solicitudes_recuperacion_acceso where correo_nuevo = 'nuevo.uno@prueba.test'), 'Verificado por llamada')),
  'nuevo.uno@prueba.test', 'H-03: la validación devuelve el correo de la solicitud (el admin no lo escribe)'
);
-- H-03: si en Auth hay un correo distinto al de la solicitud, no se registra
select throws_ok(
  $$ select public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001',
       (select id from public.solicitudes_recuperacion_acceso where correo_nuevo = 'nuevo.uno@prueba.test'), 'Verificado por llamada') $$,
  'El correo de ingreso actual no coincide con el de la solicitud elegida',
  'H-03: el correo en Auth debe ser exactamente el de la solicitud'
);
-- El servidor aplica el correo de la solicitud en Auth (aquí, directo) y luego registra
reset role;
update auth.users set email = 'nuevo.uno@prueba.test' where id = '27000000-0000-4000-a000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"27000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select isnt(
  public.admin_registrar_cambio_correo('27000000-0000-4000-a000-000000000001',
    (select id from public.solicitudes_recuperacion_acceso where correo_nuevo = 'nuevo.uno@prueba.test'), 'Verificado por llamada'),
  null, 'el admin registra el cambio de correo'
);
select is(
  (select estado from public.solicitudes_recuperacion_acceso where correo_nuevo = 'nuevo.uno@prueba.test'),
  'atendida', 'la solicitud elegida queda atendida'
);
select is(
  (select estado from public.solicitudes_recuperacion_acceso where correo_nuevo = 'otro.uno@prueba.test'),
  'reemplazada', 'H-05: la otra pendiente de la misma persona queda «reemplazada»'
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
  $$ select public.admin_validar_cambio_correo('27000000-0000-4000-a000-000000000001', gen_random_uuid(), 'Validar tras cambiar el asesor') $$,
  'Otro administrador debe cambiar el correo: cambiaste el asesor de esta persona hace menos de 24 horas',
  'SEC-REC-03: no cambia el correo quien cambió el asesor hace menos de 24 h'
);
reset role;

-- H-05: tope de 3 pendientes por persona; la más vieja pasa a «reemplazada»
select isnt(public.crear_solicitud_recuperacion('2700000002', 'tope1@prueba.test', '3001112233', 'Primera del tope'), null, 'tope: 1ª');
select isnt(public.crear_solicitud_recuperacion('2700000002', 'tope2@prueba.test', '3001112233', 'Segunda del tope'), null, 'tope: 2ª');
select isnt(public.crear_solicitud_recuperacion('2700000002', 'tope3@prueba.test', '3001112233', 'Tercera del tope'), null, 'tope: 3ª');
select isnt(public.crear_solicitud_recuperacion('2700000002', 'tope4@prueba.test', '3001112233', 'Cuarta del tope'), null, 'tope: 4ª se crea');
select is(
  (select count(*)::int from public.solicitudes_recuperacion_acceso where cedula = '2700000002' and estado = 'pendiente'),
  3, 'H-05: máximo 3 pendientes por persona'
);
select is(
  (select estado from public.solicitudes_recuperacion_acceso where correo_nuevo = 'tope1@prueba.test'),
  'reemplazada', 'H-05: la más vieja pasó a «reemplazada»'
);

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
