-- ============================================================
-- Green Alliance · pgTAP · Comprobante de desembolso y eliminación (anonimización)
-- (20261003000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(68);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('28000000-0000-4000-a000-0000000000ad', 'e.ad1@prueba.test', '{"cedula":"2800000009","grado":"PT"}', '{"nombre_completo":"Admin E1"}'),
  ('28000000-0000-4000-a000-0000000000ae', 'e.ad2@prueba.test', '{"cedula":"2800000008","grado":"PT"}', '{"nombre_completo":"Admin E2"}'),
  ('28000000-0000-4000-a000-0000000000a1', 'e.as@prueba.test',  '{"cedula":"2800000007","grado":"PT"}', '{"nombre_completo":"Asesor E"}'),
  ('28000000-0000-4000-a000-00000000000a', 'e.a@prueba.test',   '{"cedula":"2800000001","grado":"PT"}', '{"nombre_completo":"Asociado A Real"}'),
  ('28000000-0000-4000-a000-00000000000b', 'e.b@prueba.test',   '{"cedula":"2800000002","grado":"PT"}', '{"nombre_completo":"Asociado B Activo"}'),
  ('28000000-0000-4000-a000-00000000000c', 'e.c@prueba.test',   '{"cedula":"2800000003","grado":"PT"}', '{"nombre_completo":"Asociado C Pendiente"}'),
  ('28000000-0000-4000-a000-00000000000d', 'e.d@prueba.test',   '{"cedula":"2800000004","grado":"PT"}', '{"nombre_completo":"Asociado D Atiende"}'),
  ('28000000-0000-4000-a000-00000000000f', 'e.f@prueba.test',   '{"cedula":"2800000006","grado":"PT"}', '{"nombre_completo":"Asociado F Sin Nada"}');
update public.perfiles set rol = 'admin' where id in ('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-0000000000ae');
update public.perfiles set rol = 'asesor' where id = '28000000-0000-4000-a000-0000000000a1';
-- Inactivos: A, C, D, F (set de postgres: auth.uid() es null, no lo frena la RPC de baja).
update public.perfiles set activo = false
 where id in ('28000000-0000-4000-a000-00000000000a', '28000000-0000-4000-a000-00000000000c',
              '28000000-0000-4000-a000-00000000000d', '28000000-0000-4000-a000-00000000000f');
-- D «atiende» a otros asociados.
update public.perfiles set atiende_asociados = true where id = '28000000-0000-4000-a000-00000000000d';

-- Datos personales de A
update public.perfiles
   set telefono = '3001112233', correo_institucional = 'a.real@policia.gov.co',
       nomina_entidad = 'Bancolombia', nomina_tipo = 'ahorros', nomina_numero = '12345678901',
       avisar_apertura_sorteo = true
 where id = '28000000-0000-4000-a000-00000000000a';
insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, estado
) values ('Asociado', 'Real', '2800000001', 'PT', 'policia', '3002000000', '3002000000', 'a.real@gmail.com',
          'afiliacion-documentos/solicitudes/28a/f.jpg', 'solicitudes/28a/r.jpg', 'solicitudes/28a/s.jpg', now(), 'aprobada');
insert into public.carne_tokens (asociado_id) values ('28000000-0000-4000-a000-00000000000a');
insert into public.solicitudes_recuperacion_acceso (perfil_id, cedula, correo_nuevo, celular, motivo)
values ('28000000-0000-4000-a000-00000000000a', '2800000001', 'nuevo.a@prueba.test', '3001112233', 'Perdí el acceso a mi correo');
insert into public.historial_cambio_correo_ingreso (perfil_id, origen, motivo)
values ('28000000-0000-4000-a000-00000000000a', 'admin', 'Cambio de correo con datos que no deben quedar');

-- Créditos (sin pasar por los triggers de creación)
alter table public.solicitudes_credito disable trigger user;
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado, cuota_mensual,
  grado, grado_asociado, estado, fecha_respuesta, fecha_desembolso, fecha_solicitud, tasa_interes_mensual) values
  -- A: aprobado y desembolsado
  ('28100000-0000-4000-a000-00000000000a', '28000000-0000-4000-a000-00000000000a', '50', 300000, 0,
   'PT', 'PT', 'aprobado', now(), (now() at time zone 'America/Bogota')::date, now(), 0.02),
  -- B (activo): aprobado y desembolsado
  ('28100000-0000-4000-a000-00000000000b', '28000000-0000-4000-a000-00000000000b', '50', 400000, 0,
   'PT', 'PT', 'aprobado', now(), (now() at time zone 'America/Bogota')::date, now(), 0.02),
  -- C: pendiente
  ('28100000-0000-4000-a000-00000000000c', '28000000-0000-4000-a000-00000000000c', '50', 500000, 0,
   'PT', 'PT', 'pendiente', null, null, now(), 0.02),
  -- ad2: su propio crédito, aprobado y desembolsado
  ('28100000-0000-4000-a000-0000000000ae', '28000000-0000-4000-a000-0000000000ae', '50', 200000, 0,
   'PT', 'PT', 'aprobado', now(), (now() at time zone 'America/Bogota')::date, now(), 0.02),
  -- F: aprobado SIN desembolso
  ('28100000-0000-4000-a000-00000000000f', '28000000-0000-4000-a000-00000000000f', '50', 250000, 0,
   'PT', 'PT', 'aprobado', now(), null, now(), 0.02);
alter table public.solicitudes_credito enable trigger user;

-- Archivos «subidos» a Storage
insert into storage.objects (bucket_id, name) values
  ('comprobantes-desembolso', '28100000-0000-4000-a000-00000000000b/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf'),
  ('comprobantes-desembolso', '28100000-0000-4000-a000-00000000000b/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png'),
  ('comprobantes-desembolso', '28100000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg'),
  ('comprobantes-desembolso', '28100000-0000-4000-a000-00000000000b/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pdf'),
  ('comprobantes-desembolso', '28100000-0000-4000-a000-0000000000ae/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.pdf'),
  ('comprobantes-desembolso', '28100000-0000-4000-a000-00000000000f/ffffffff-ffff-4fff-8fff-ffffffffffff.pdf');

-- ============================================================
-- A. Comprobante de desembolso
-- ============================================================
select is(
  (select public::text || '|' || file_size_limit::text || '|' || array_to_string(allowed_mime_types, ',')
     from storage.buckets where id = 'comprobantes-desembolso'),
  'false|5242880|image/jpeg,image/png,image/webp,application/pdf',
  'bucket privado de 5 MB con JPG, PNG, WEBP y PDF'
);
select is_empty(
  $$ select policyname::text from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and (qual ilike '%comprobantes-desembolso%' or with_check ilike '%comprobantes-desembolso%') $$,
  'el bucket de comprobantes no tiene políticas en storage.objects'
);
select ok(
  not has_function_privilege('anon', 'public.admin_registrar_comprobante(uuid, text)', 'execute'),
  'anon no ejecuta admin_registrar_comprobante'
);

set local role authenticated;

-- Asociado B: no sube comprobantes
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b',
       '28100000-0000-4000-a000-00000000000b/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf') $$,
  'P0001', 'Solo un administrador puede subir comprobantes', 'un asociado no sube comprobantes'
);

-- Admin 1
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000f',
       '28100000-0000-4000-a000-00000000000f/ffffffff-ffff-4fff-8fff-ffffffffffff.pdf') $$,
  'P0001', 'Primero marca el desembolso de este crédito', 'sin desembolso no hay comprobante'
);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b',
       '28100000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg') $$,
  'P0001', 'La ruta del comprobante no es válida', 'la ruta debe ser de esa solicitud'
);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b', '../otro/archivo.pdf') $$,
  'P0001', 'La ruta del comprobante no es válida', 'ruta con formato inválido'
);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b',
       '28100000-0000-4000-a000-00000000000b/99999999-9999-4999-8999-999999999999.pdf') $$,
  'P0001', 'El archivo del comprobante no se encontró', 'el archivo debe existir en el bucket'
);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b',
       '28100000-0000-4000-a000-00000000000b/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.exe') $$,
  'P0001', 'La ruta del comprobante no es válida', 'extensión no permitida'
);
select is(
  public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b',
    '28100000-0000-4000-a000-00000000000b/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf'),
  null, 'primer comprobante: no había anterior'
);
select is(
  public.admin_registrar_comprobante('28100000-0000-4000-a000-00000000000b',
    '28100000-0000-4000-a000-00000000000b/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png'),
  '28100000-0000-4000-a000-00000000000b/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
  'reemplazo: devuelve la ruta anterior para borrarla'
);
select is(
  (select count(*)::int from public.historial_solicitudes
    where entidad_id = '28100000-0000-4000-a000-00000000000b' and accion = 'comprobante_desembolso'),
  2, 'subir y reemplazar quedan en el historial'
);
select ok(
  exists (select 1 from public.historial_solicitudes
           where entidad_id = '28100000-0000-4000-a000-00000000000b' and accion = 'comprobante_desembolso'
             and detalle = 'Comprobante reemplazado')
  and exists (select 1 from public.historial_solicitudes
           where entidad_id = '28100000-0000-4000-a000-00000000000b' and accion = 'comprobante_desembolso'
             and detalle = 'Comprobante subido'),
  'el historial distingue subido de reemplazado'
);
select ok(
  (select comprobante_subido_at is not null
     from public.solicitudes_credito where id = '28100000-0000-4000-a000-00000000000b'),
  'queda la fecha en que se subió'
);
-- RS-01: un admin no sube el comprobante de su propio crédito
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-0000000000ae","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_registrar_comprobante('28100000-0000-4000-a000-0000000000ae',
       '28100000-0000-4000-a000-0000000000ae/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.pdf') $$,
  'P0001', 'No puede subir el comprobante de su propio crédito; debe hacerlo otro administrador',
  'no sube el comprobante de su propio crédito'
);

-- Asociado B: ve SI hay comprobante, pero no la ruta
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select ok(
  (select comprobante_subido_at is not null from public.solicitudes_credito where id = '28100000-0000-4000-a000-00000000000b'),
  'el asociado dueño ve que hay comprobante (comprobante_subido_at)'
);
select throws_ok(
  $$ select comprobante_path from public.solicitudes_credito $$,
  '42501', null, 'el asociado no lee la ruta del comprobante'
);
-- Admin 1 la lee solo por service role (tampoco la concede)
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select throws_ok(
  $$ select comprobante_path from public.solicitudes_credito $$,
  '42501', null, 'ni el admin lee la ruta por la API (solo el servidor)'
);
-- Otro asociado (C) no ve el comprobante_subido_at de B
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.solicitudes_credito where id = '28100000-0000-4000-a000-00000000000b'),
  0, 'otro asociado no ve la solicitud de B (ni su comprobante)'
);
reset role;

select is(
  (select comprobante_subido_por from public.solicitudes_credito where id = '28100000-0000-4000-a000-00000000000b'),
  '28000000-0000-4000-a000-0000000000ad'::uuid, 'queda el admin que lo subió'
);
select throws_ok(
  $$ update public.solicitudes_credito set comprobante_path = 'cualquiera.pdf', comprobante_subido_at = now()
      where id = '28100000-0000-4000-a000-00000000000b' $$,
  '23514', null, 'la base rechaza una ruta que no es de esa solicitud'
);

-- ============================================================
-- B. Eliminación (anonimización)
-- ============================================================
-- Comprobante ya subido del crédito de A (el que se borrará con la anonimización).
update public.solicitudes_credito
   set comprobante_path = '28100000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg',
       comprobante_subido_at = now()
 where id = '28100000-0000-4000-a000-00000000000a';
-- El servidor llama como service_role: sin «sub» en el JWT (auth.uid() es null).
select set_config('request.jwt.claims', '', true);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.solicitudes_eliminacion_asociado'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.eliminaciones_asociados'::regclass),
  'las 2 tablas nuevas tienen RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.solicitudes_eliminacion_asociado', 'select')
  and not has_table_privilege('anon', 'public.solicitudes_eliminacion_asociado', 'select'),
  'nadie con sesión ni anónimo lee los códigos de eliminación'
);
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('validar_eliminacion_asociado', 'admin_solicitar_eliminacion', 'admin_cancelar_eliminacion',
                          'admin_confirmar_eliminacion', 'admin_cerrar_limpieza_eliminacion')
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) $$,
  'las funciones de eliminación no las ejecuta anon ni authenticated'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('validar_eliminacion_asociado', 'admin_solicitar_eliminacion', 'admin_cancelar_eliminacion',
                        'admin_confirmar_eliminacion', 'admin_cerrar_limpieza_eliminacion')
      and has_function_privilege('service_role', p.oid, 'execute')),
  5, 'service_role sí las ejecuta'
);

-- Reglas de quién se puede eliminar
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-00000000000b', '28000000-0000-4000-a000-00000000000a', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'Solo un administrador puede eliminar a un asociado', 'quien pide debe ser admin'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-0000000000ad', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'No puedes eliminarte a ti mismo; debe hacerlo otro administrador', 'nadie se elimina a sí mismo'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-0000000000ae', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'Los asesores y administradores no se eliminan desde aquí', 'un admin no se elimina por aquí'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-0000000000a1', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'Los asesores y administradores no se eliminan desde aquí', 'un asesor no se elimina por aquí'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000b', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'Primero da de baja al asociado; solo se elimina a un asociado inactivo', 'primero debe estar de baja'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000d', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'Este asociado atiende a otros asociados; reasigna a sus clientes antes de eliminarlo', 'no si atiende a otros asociados'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000c', 'Motivo válido', repeat('a', 64)) $$,
  'P0001', 'Tiene una solicitud de crédito pendiente; resuélvela antes de eliminarlo', 'no con un crédito pendiente'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000a', 'abc', repeat('a', 64)) $$,
  'P0001', 'El motivo debe tener entre 5 y 300 caracteres', 'motivo obligatorio'
);

-- Código: 3 intentos y bloqueo
create temp table ids (k text primary key, v uuid);
insert into ids select 's1', public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000a', 'Cumplió su ciclo', repeat('a', 64));
select isnt((select v from ids where k = 's1'), null, 'pedir la eliminación crea la solicitud con código');
select is(
  (select expira_at between now() + interval '9 minutes' and now() + interval '10 minutes 5 seconds'
     from public.solicitudes_eliminacion_asociado where id = (select v from ids where k = 's1')),
  true, 'el código vence en 10 minutos'
);
select is(
  (select resultado || '|' || intentos_restantes::text
     from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's1'), repeat('b', 64))),
  'codigo_incorrecto|2', 'código malo: quedan 2 intentos'
);
select is(
  (select intentos from public.solicitudes_eliminacion_asociado where id = (select v from ids where k = 's1')),
  1, 'el intento fallido queda guardado'
);
select is(
  (select resultado || '|' || intentos_restantes::text
     from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's1'), repeat('b', 64))),
  'codigo_incorrecto|1', 'segundo intento malo: queda 1'
);
select is(
  (select resultado from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's1'), repeat('b', 64))),
  'bloqueada', 'tercer intento malo: bloqueada'
);
select is(
  (select resultado from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's1'), repeat('a', 64))),
  'bloqueada', 'bloqueada: ni el código correcto sirve'
);
select is(
  (select nombre_completo from public.perfiles where id = '28000000-0000-4000-a000-00000000000a'),
  'Asociado A Real', 'nada se borró con códigos malos'
);

-- Un pedido nuevo cancela el pendiente anterior
insert into ids select 's2', public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000a', 'Segundo pedido', repeat('c', 64));
insert into ids select 's3', public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000a', 'Tercer pedido', repeat('d', 64));
select is(
  (select estado from public.solicitudes_eliminacion_asociado where id = (select v from ids where k = 's2')),
  'cancelada', 'un pedido nuevo cancela el anterior'
);
-- Otro admin no confirma el pedido de alguien más
select is(
  (select resultado from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ae', (select v from ids where k = 's3'), repeat('d', 64))),
  'no_existe', 'otro admin no puede confirmar el pedido ajeno'
);
-- Vencido
update public.solicitudes_eliminacion_asociado set expira_at = now() - interval '1 minute' where id = (select v from ids where k = 's3');
select is(
  (select resultado from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's3'), repeat('d', 64))),
  'vencida', 'pasados 10 minutos, el código no sirve'
);

-- Éxito
insert into ids select 's4', public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000a', 'Cumplió su ciclo y pidió borrar sus datos', repeat('e', 64));
create temp table res as
  select * from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's4'), repeat('e', 64));
select is((select resultado from res), 'ok', 'con el código correcto se ejecuta');
select set_eq(
  $$ select unnest(archivos) from res $$,
  $$ values ('afiliacion-documentos/solicitudes/28a/f.jpg'), ('afiliacion-documentos/solicitudes/28a/r.jpg'),
            ('afiliacion-documentos/solicitudes/28a/s.jpg'),
            ('comprobantes-desembolso/28100000-0000-4000-a000-00000000000a/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg') $$,
  'devuelve las rutas de Storage a borrar (afiliación con bucket y comprobantes)'
);
select is(
  (select nombre_completo from public.perfiles where id = '28000000-0000-4000-a000-00000000000a'),
  'Asociado eliminado', 'el nombre queda anónimo'
);
select matches(
  (select cedula from public.perfiles where id = '28000000-0000-4000-a000-00000000000a'),
  '^ELIMINADO-[0-9a-f]{12}$', 'la cédula queda como marcador único'
);
select ok(
  (select telefono is null and correo_institucional is null and nomina_entidad is null and nomina_tipo is null
          and nomina_numero is null and not avisar_apertura_sorteo and not activo and eliminado_at is not null
     from public.perfiles where id = '28000000-0000-4000-a000-00000000000a'),
  'sin celular, correo institucional ni nómina; inactivo y marcado como eliminado'
);
select is(
  (select count(*)::int from public.solicitudes_afiliacion where cedula = '2800000001' or email = 'a.real@gmail.com'),
  0, 'su afiliación (con fotos, Nequi y correos) se borró'
);
select is(
  (select count(*)::int from public.solicitudes_recuperacion_acceso where perfil_id = '28000000-0000-4000-a000-00000000000a'),
  0, 'sus solicitudes de recuperación se borraron'
);
select is(
  (select count(*)::int from public.carne_tokens where asociado_id = '28000000-0000-4000-a000-00000000000a'),
  0, 'su token de carné se borró'
);
select is(
  (select motivo from public.historial_cambio_correo_ingreso where perfil_id = '28000000-0000-4000-a000-00000000000a'),
  'Registro anonimizado', 'el motivo libre del historial de correo se anonimizó'
);
select ok(
  (select monto_solicitado = 300000 and estado = 'aprobado' and fecha_desembolso is not null and comprobante_path is null
     from public.solicitudes_credito where id = '28100000-0000-4000-a000-00000000000a'),
  'las cifras del crédito se conservan (sin comprobante)'
);
select is(
  (select count(*)::int from public.eliminaciones_asociados
    where asociado_id = '28000000-0000-4000-a000-00000000000a' and admin_id = '28000000-0000-4000-a000-0000000000ad'
      and motivo = 'Cumplió su ciclo y pidió borrar sus datos'),
  1, 'queda 1 fila en el log: quién, cuándo y motivo'
);
select throws_ok(
  $$ update public.eliminaciones_asociados set motivo = 'cambiado' $$,
  'P0001', 'El registro de eliminaciones no se puede modificar ni borrar', 'el log no se modifica'
);
select throws_ok(
  $$ delete from public.eliminaciones_asociados $$,
  'P0001', 'El registro de eliminaciones no se puede modificar ni borrar', 'el log no se borra'
);
select throws_ok(
  $$ select public.admin_solicitar_eliminacion('28000000-0000-4000-a000-0000000000ad', '28000000-0000-4000-a000-00000000000a', 'Otra vez', repeat('a', 64)) $$,
  'P0001', 'Este asociado ya fue eliminado', 'no se elimina dos veces'
);

-- Limpieza pendiente: se reintenta sin pedir código; luego se cierra
select is(
  (select resultado from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's4'), repeat('z', 64))),
  'ok', 'con la limpieza pendiente se reintenta sin código'
);
select lives_ok(
  $$ select public.admin_cerrar_limpieza_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's4')) $$,
  'se cierra la limpieza'
);
select is(
  (select resultado from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', (select v from ids where k = 's4'), repeat('z', 64))),
  'no_existe', 'ya cerrada, no se puede repetir'
);

-- Borrar el usuario de Auth: el perfil eliminado se queda; uno normal sigue cayendo en cascada
delete from auth.users where id = '28000000-0000-4000-a000-00000000000a';
select is(
  (select count(*)::int from public.perfiles where id = '28000000-0000-4000-a000-00000000000a'),
  1, 'borrar el usuario de Auth NO borra al asociado eliminado (se conservan sus cifras)'
);
select is(
  (select count(*)::int from public.solicitudes_credito where asociado_id = '28000000-0000-4000-a000-00000000000a'),
  1, 'y su crédito sigue ligado al registro anónimo'
);
delete from auth.users where id = '28000000-0000-4000-a000-0000000000a1';
select is(
  (select count(*)::int from public.perfiles where id = '28000000-0000-4000-a000-0000000000a1'),
  0, 'borrar el usuario de Auth de un perfil normal sigue borrando su perfil (cascada conservada)'
);

-- RLS del log y protección de eliminado_at
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.eliminaciones_asociados), 0, 'un asociado no lee el log de eliminaciones');
select throws_ok(
  $$ update public.perfiles set eliminado_at = now() where id = '28000000-0000-4000-a000-00000000000b' $$,
  'P0001', 'El estado de eliminación solo lo cambia el proceso de eliminación', 'nadie se marca como eliminado por la API'
);
select set_config('request.jwt.claims', '{"sub":"28000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select is((select count(*)::int from public.eliminaciones_asociados), 1, 'el admin lee el log');
select throws_ok(
  $$ select * from public.admin_confirmar_eliminacion('28000000-0000-4000-a000-0000000000ad', gen_random_uuid(), repeat('a', 64)) $$,
  '42501', null, 'el admin no puede llamar a la confirmación desde el navegador (saltarse el código)'
);
reset role;

select * from finish();
rollback;
