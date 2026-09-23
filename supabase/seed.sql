-- ============================================================
-- Datos de prueba SOLO para Supabase local (se cargan en `supabase db reset`).
-- Nunca se aplican a producción: `db push` no ejecuta este archivo.
--
-- Ingreso con código (/ingresar): el correo con el código de 6 dígitos llega
-- a Mailpit (http://127.0.0.1:54324), no a un buzón real.
--
--   Asociado 1 · cédula 1234567890 · grado PP · correo asociado.prueba@greenalliance.test
--                con una solicitud de crédito pendiente (500.000 al 50 %).
--   Asociado 2 · cédula 1234567891 · grado SI · correo sin.solicitudes@greenalliance.test
--                sin solicitudes (estado vacío de /cuenta).
--
-- Ambos conservan la contraseña Prueba123! por si se quiere probar algo con
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
  '{"provider":"email","providers":["email"],"cedula":"1234567890","grado":"PP"}',
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
   set cedula = '1234567890', grado = 'PP', telefono = '3001234567'
 where id = '4c7808d8-085f-42ed-9e5d-f53c117b4cd1';

update public.perfiles
   set cedula = '1234567891', grado = 'SI'
 where id = '7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c';

-- Solicitud pendiente del asociado 1. Grado, tasa y plazo los pone el trigger
-- chk_monto_solicitud; la fecha, tr_fijar_fecha_solicitud.
insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
values ('4c7808d8-085f-42ed-9e5d-f53c117b4cd1', '50', 500000);
