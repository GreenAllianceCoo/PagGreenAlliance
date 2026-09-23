-- ============================================================
-- Datos de prueba SOLO para Supabase local (se cargan en `supabase db reset`).
-- Nunca se aplican a producción: `db push` no ejecuta este archivo.
--
-- Asociado de prueba para /login:  cédula 1234567890 · contraseña Prueba123!
-- (/login convierte la cédula en {cedula}@asociados.greenallianceco.com)
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '4c7808d8-085f-42ed-9e5d-f53c117b4cd1',
  'authenticated', 'authenticated',
  '1234567890@asociados.greenallianceco.com',
  extensions.crypt('Prueba123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre_completo":"Asociado de Prueba"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '4c7808d8-085f-42ed-9e5d-f53c117b4cd1',
  '4c7808d8-085f-42ed-9e5d-f53c117b4cd1',
  'email',
  '{"sub":"4c7808d8-085f-42ed-9e5d-f53c117b4cd1","email":"1234567890@asociados.greenallianceco.com","email_verified":true}',
  now(), now(), now()
);

-- handle_new_user crea el perfil ignorando cédula/grado del cliente; aquí se fijan a mano.
update public.perfiles
   set cedula = '1234567890', grado = 'PP'
 where id = '4c7808d8-085f-42ed-9e5d-f53c117b4cd1';
