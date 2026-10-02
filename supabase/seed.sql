-- ============================================================
-- Datos de prueba SOLO para Supabase local (se cargan en `supabase db reset`).
-- Nunca se aplican a producción: `db push` no ejecuta este archivo.
--
-- Ingreso con código (/ingresar): el correo con el código de 6 dígitos llega
-- a Mailpit (http://127.0.0.1:54324), no a un buzón real.
--
--   Asociado 1 · cédula 1234567890 · grado PT · correo asociado.prueba@greenalliance.test
--                con una solicitud de crédito pendiente (500.000 al 50 %).
--   Asociado 2 · cédula 1234567891 · grado SI · correo sin.solicitudes@greenalliance.test
--                sin solicitudes (estado vacío de /cuenta).
--   Asesor    · cédula 1234567892 · rol asesor · correo asesor.prueba@greenalliance.test
--                asignado como asesor del Asociado 1. Ingresa igual que un
--                asociado (cédula + código); ve el resumen de sus clientes
--                con resumen_clientes_asesor().
--
-- Todos conservan la contraseña Prueba123! por si se quiere probar algo con
-- la API; la ruta vieja /login (cédula + contraseña con correo sintético)
-- ya no sirve para estos usuarios porque ahora tienen correo propio.
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
(
  '00000000-0000-0000-0000-000000000000',
  '4c7808d8-085f-42ed-9e5d-f53c117b4cd1',
  'authenticated', 'authenticated',
  'asociado.prueba@greenalliance.test',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"cedula":"1234567890","grado":"PT"}',
  '{"nombre_completo":"Asociado de Prueba","telefono":"3001234567"}',
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c',
  'authenticated', 'authenticated',
  'sin.solicitudes@greenalliance.test',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"cedula":"1234567891","grado":"SI"}',
  '{"nombre_completo":"Asociada Sin Solicitudes"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values
(
  gen_random_uuid(),
  '4c7808d8-085f-42ed-9e5d-f53c117b4cd1',
  '4c7808d8-085f-42ed-9e5d-f53c117b4cd1',
  'email',
  '{"sub":"4c7808d8-085f-42ed-9e5d-f53c117b4cd1","email":"asociado.prueba@greenalliance.test","email_verified":true}',
  now(), now(), now()
),
(
  gen_random_uuid(),
  '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c',
  '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c',
  'email',
  '{"sub":"7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c","email":"sin.solicitudes@greenalliance.test","email_verified":true}',
  now(), now(), now()
);

-- handle_new_user ya toma cédula y grado de raw_app_meta_data; se fijan otra vez
-- por si el trigger cambia en el futuro.
update public.perfiles
   set cedula = '1234567890', grado = 'PT', telefono = '3001234567'
 where id = '4c7808d8-085f-42ed-9e5d-f53c117b4cd1';

update public.perfiles
   set cedula = '1234567891', grado = 'SI'
 where id = '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c';

-- Spec §8 (migración 20260930100200): solo se pide crédito con el proceso
-- ejecutivo en «operando». Los asociados 1 y 2 (los que usan las e2e de
-- crédito) quedan operando desde hace 6 meses: fuera del periodo de
-- comisiones en curso y sin llegar a los 24 meses de la renovación.
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo) values
  ('4c7808d8-085f-42ed-9e5d-f53c117b4cd1', 'operando',
   ((now() at time zone 'America/Bogota')::date - interval '6 months')::date),
  ('7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c', 'operando',
   ((now() at time zone 'America/Bogota')::date - interval '6 months')::date);

update public.historial_proceso_ejecutivo h
   set created_at = (pe.fecha_inicio_embargo::timestamp at time zone 'America/Bogota')
  from public.procesos_ejecutivos pe
 where pe.asociado_id = h.asociado_id
   and h.asociado_id in ('4c7808d8-085f-42ed-9e5d-f53c117b4cd1', '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c');

-- Solicitud pendiente del asociado 1. Grado, tasa y plazo los pone el trigger
-- chk_monto_solicitud; la fecha, tr_fijar_fecha_solicitud.
insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
values ('4c7808d8-085f-42ed-9e5d-f53c117b4cd1', '50', 500000);

-- ============================================================
-- Fase 2 · Asesor de prueba (rol asesor, ingresa igual que un asociado).
-- Cédula 1234567892 · correo asesor.prueba@greenalliance.test · asignado
-- como asesor del asociado 1 (cédula 1234567890).
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c',
  'authenticated', 'authenticated',
  'asesor.prueba@greenalliance.test',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"cedula":"1234567892"}',
  '{"nombre_completo":"Asesor de Prueba"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c',
  '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c',
  'email',
  '{"sub":"9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c","email":"asesor.prueba@greenalliance.test","email_verified":true}',
  now(), now(), now()
);

update public.perfiles
   set cedula = '1234567892', rol = 'asesor'
 where id = '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c';

-- El asociado 1 (cédula 1234567890) queda con este asesor asignado.
update public.perfiles
   set asesor_id = '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c'
 where id = '4c7808d8-085f-42ed-9e5d-f53c117b4cd1';

-- ============================================================
-- Fase 2 · Solicitud de afiliación de prueba con institución y Nequi,
-- referida por el asesor de prueba. Las fotos son rutas de ejemplo (no
-- existen archivos reales en el bucket local): sirven para probar que la
-- columna guarda una ruta, no para abrir la imagen.
-- ============================================================
insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  asesor_id, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
) values (
  'Camilo', 'Restrepo Gil', '1234567898', 'PT', 'policia', '3009998877', '3009998877',
  'camilo.restrepo@policia.gov.co',
  '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c',
  'afiliacion-documentos/1234567898/cedula-frente.jpg',
  'afiliacion-documentos/1234567898/cedula-reverso.jpg',
  'afiliacion-documentos/1234567898/selfie.jpg',
  now()
);

-- ============================================================
-- Fase 2 · Admin de prueba (rol admin, ingresa igual que un asociado: cédula
-- + código a Mailpit). Cédula 1234567899.
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  'bd8bb056-286f-4b75-89e1-cc07b6c7c0f8',
  'authenticated', 'authenticated',
  'admin.prueba@greenalliance.test',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"cedula":"1234567899"}',
  '{"nombre_completo":"Admin de Prueba"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'bd8bb056-286f-4b75-89e1-cc07b6c7c0f8',
  'bd8bb056-286f-4b75-89e1-cc07b6c7c0f8',
  'email',
  '{"sub":"bd8bb056-286f-4b75-89e1-cc07b6c7c0f8","email":"admin.prueba@greenalliance.test","email_verified":true}',
  now(), now(), now()
);

update public.perfiles
   set cedula = '1234567899', rol = 'admin'
 where id = 'bd8bb056-286f-4b75-89e1-cc07b6c7c0f8';

-- ============================================================
-- Requerimientos de Ricardo (2026-09-29) · datos de prueba
-- (migraciones 20260929100000..100700). No cambia cédula, correo, teléfono,
-- rol ni solicitudes de los usuarios que ya usan las e2e.
--
--   Asociado 1 (1234567890) y 2 (1234567891): se les completa institución
--     (Policía); al 1 también correo institucional y cuenta de nómina.
--   Asociado 3 · cédula 1234567893 · grado TE (grupo OF) · Ejército ·
--     correo operando.prueba@greenalliance.test · cliente del asesor de
--     prueba · proceso en «operando» desde hace 25 meses (ya puede pedir la
--     renovación; retiro anticipado disponible).
--   Asociado 4 · cédula 1234567894 · grado SP (grupo IJ, §12.14; el correo «sin.cupo» es histórico) ·
--     Policía · correo sin.cupo@greenalliance.test · cliente del asesor de
--     prueba · proceso en «operando» desde el inicio del periodo de
--     comisiones en curso (= 1 ingreso nuevo del periodo para el asesor).
--   Asesor de prueba: 3 clientes operativos (asociados 1, 3 y 4) y 1 ingreso
--     nuevo en el periodo; pagos de comisión registrados por 700.000.
--   Afiliación de ejemplo con los campos nuevos (correo institucional +
--     cuenta de nómina en billetera): Diana Cárdenas, cédula 1234567897.
--   Convenios: los 5 de la spec §4 los crea la migración
--     20260929100600 (no se repiten aquí).
-- ============================================================

update public.perfiles
   set institucion = 'policia',
       correo_institucional = 'asociado.prueba@policia.gov.co',
       nomina_entidad = 'Bancolombia', nomina_tipo = 'ahorros', nomina_numero = '12345678901'
 where id = '4c7808d8-085f-42ed-9e5d-f53c117b4cd1';

update public.perfiles
   set institucion = 'policia'
 where id = '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
(
  '00000000-0000-0000-0000-000000000000',
  '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01',
  'authenticated', 'authenticated',
  'operando.prueba@greenalliance.test',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"cedula":"1234567893","grado":"TE"}',
  '{"nombre_completo":"Asociado Operando de Prueba","telefono":"3005550003"}',
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02',
  'authenticated', 'authenticated',
  'sin.cupo@greenalliance.test',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"cedula":"1234567894","grado":"SP"}',
  '{"nombre_completo":"Asociada Sin Cupo de Prueba","telefono":"3005550004"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values
(
  gen_random_uuid(),
  '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01',
  '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01',
  'email',
  '{"sub":"3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01","email":"operando.prueba@greenalliance.test","email_verified":true}',
  now(), now(), now()
),
(
  gen_random_uuid(),
  '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02',
  '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02',
  'email',
  '{"sub":"3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02","email":"sin.cupo@greenalliance.test","email_verified":true}',
  now(), now(), now()
);

update public.perfiles
   set cedula = '1234567893', grado = 'TE', institucion = 'ejercito',
       correo_institucional = 'operando.prueba@buzonejercito.mil.co',
       nomina_entidad = 'Banco de Bogotá', nomina_tipo = 'corriente', nomina_numero = '0012345678',
       asesor_id = '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c'
 where id = '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01';

update public.perfiles
   set cedula = '1234567894', grado = 'SP', institucion = 'ejercito',
       correo_institucional = 'sin.cupo@buzonejercito.mil.co',
       nomina_entidad = 'Nequi', nomina_tipo = 'deposito_electronico', nomina_numero = '3005550004',
       asesor_id = '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c'
 where id = '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02';

-- Procesos ejecutivos (como postgres: el trigger no exige admin sin sesión).
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo) values
  ('3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01', 'operando',
   ((now() at time zone 'America/Bogota')::date - interval '25 months')::date),
  ('3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02', 'operando',
   (select pc.inicio from public.periodo_comision((now() at time zone 'America/Bogota')::date) pc));

-- El historial se creó con la hora de hoy; se lleva a la fecha real de inicio
-- para que «clientes operativos al corte» de periodos pasados tenga sentido.
update public.historial_proceso_ejecutivo h
   set created_at = (pe.fecha_inicio_embargo::timestamp at time zone 'America/Bogota')
  from public.procesos_ejecutivos pe
 where pe.asociado_id = h.asociado_id
   and h.asociado_id = '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01';

-- Pagos de comisión del asesor de prueba (total 700.000).
insert into public.pagos_comision (asesor_id, asociado_id, periodo_corte, concepto, monto, nota) values
  ('9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c', '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01',
   (select pc.fin from public.periodo_comision(((now() at time zone 'America/Bogota')::date - interval '25 months')::date) pc),
   'ingreso_nuevo', 500000, 'Seed: ingreso del asociado 3'),
  ('9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c', '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01',
   (select pc.fin from public.periodo_comision(((now() at time zone 'America/Bogota')::date - interval '2 months')::date) pc),
   'embargo_operativo', 100000, 'Seed: operativo'),
  ('9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c', '3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01',
   (select pc.fin from public.periodo_comision(((now() at time zone 'America/Bogota')::date - interval '1 month')::date) pc),
   'embargo_operativo', 100000, 'Seed: operativo');

-- Afiliación de ejemplo con los campos nuevos (grado del Ejército, nómina en billetera).
insert into public.solicitudes_afiliacion (
  nombres, apellidos, cedula, grado, institucion, celular, nequi, email, correo_institucional,
  nomina_entidad, nomina_tipo, nomina_numero,
  asesor_id, foto_cedula_frente, foto_cedula_reverso, foto_selfie, mensaje, acepto_datos_at
) values (
  'Diana', 'Cárdenas Ruiz', '1234567897', 'CS', 'ejercito', '3157778899', '3157778899',
  'diana.cardenas@correo.test', 'diana.cardenas@buzonejercito.mil.co',
  'Daviplata', 'deposito_electronico', '3157778899',
  '9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c',
  'afiliacion-documentos/1234567897/cedula-frente.jpg',
  'afiliacion-documentos/1234567897/cedula-reverso.jpg',
  'afiliacion-documentos/1234567897/selfie.jpg',
  'Quiero saber cuándo empieza el conteo.',
  now()
);
