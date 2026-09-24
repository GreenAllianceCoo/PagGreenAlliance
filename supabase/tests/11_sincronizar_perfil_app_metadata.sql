-- ============================================================
-- Green Alliance · pgTAP · Fase 2 · auditoría 2026-09-24 (F2-05)
-- Trigger tr_on_auth_user_app_metadata / sincronizar_perfil_desde_app_metadata
-- (migración 20260924000800): completa cédula y grado del perfil DENTRO de
-- la misma transacción en la que GoTrue guarda app_metadata, para que un
-- usuario huérfano (cédula duplicada) no quede a medio crear.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- ------------------------------------------------------------
-- Datos de prueba: 3 usuarios SIN app_metadata (como los crea
-- auth.admin.createUser antes del segundo UPDATE de GoTrue). handle_new_user
-- les deja cedula = 'PENDIENTE-' || primeros 8 caracteres del id.
-- ------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('11111111-0000-4000-a000-000000000001', 'u1@prueba.test', '{}', '{"nombre_completo":"Usuario Uno"}'),
  ('22222222-0000-4000-a000-000000000002', 'u2@prueba.test', '{}', '{"nombre_completo":"Usuario Dos"}'),
  ('33333333-0000-4000-a000-000000000003', 'u3@prueba.test', '{}', '{"nombre_completo":"Usuario Tres"}');

select is(
  (select cedula from public.perfiles where id = '11111111-0000-4000-a000-000000000001'),
  'PENDIENTE-11111111',
  'handle_new_user deja la cédula como PENDIENTE-xxxx sin app_metadata'
);

-- ------------------------------------------------------------
-- 1) El UPDATE de app_metadata (lo que hace GoTrue después del INSERT)
--    rellena cédula y grado dentro de la MISMA transacción.
-- ------------------------------------------------------------
update auth.users set raw_app_meta_data = '{"cedula":"9000000001","grado":"OF"}'::jsonb
  where id = '11111111-0000-4000-a000-000000000001';

select is(
  (select cedula from public.perfiles where id = '11111111-0000-4000-a000-000000000001'),
  '9000000001',
  'el trigger rellena la cédula real cuando el perfil seguía en PENDIENTE-'
);

select is(
  (select grado::text from public.perfiles where id = '11111111-0000-4000-a000-000000000001'),
  'OF',
  'el trigger rellena el grado real cuando el perfil lo tenía en null'
);

-- ------------------------------------------------------------
-- 2) No pisa una cédula ni un grado que ya dejaron de ser "pendientes".
-- ------------------------------------------------------------
update auth.users set raw_app_meta_data = '{"cedula":"9000000099","grado":"PP"}'::jsonb
  where id = '11111111-0000-4000-a000-000000000001';

select is(
  (select cedula from public.perfiles where id = '11111111-0000-4000-a000-000000000001'),
  '9000000001',
  'el trigger NO pisa una cédula real ya asignada'
);

select is(
  (select grado::text from public.perfiles where id = '11111111-0000-4000-a000-000000000001'),
  'OF',
  'el trigger NO pisa un grado ya asignado (no null)'
);

-- ------------------------------------------------------------
-- 3) Nunca toca `rol`, aunque app_metadata traiga "rol":"admin".
-- ------------------------------------------------------------
update auth.users set raw_app_meta_data = '{"cedula":"9000000002","grado":"PT","rol":"admin"}'::jsonb
  where id = '22222222-0000-4000-a000-000000000002';

select is(
  (select rol::text from public.perfiles where id = '22222222-0000-4000-a000-000000000002'),
  'asociado',
  'el trigger nunca cambia el rol, aunque app_metadata traiga "rol":"admin"'
);

select is(
  (select cedula from public.perfiles where id = '22222222-0000-4000-a000-000000000002'),
  '9000000002',
  'a la par, sí rellena la cédula real de ese mismo usuario'
);

-- ------------------------------------------------------------
-- 4) Si la cédula choca con otra ya usada, falla TODO el update (no queda
--    un usuario de Auth huérfano: ni auth.users ni perfiles cambian).
-- ------------------------------------------------------------
select throws_ok(
  $$ update auth.users set raw_app_meta_data = '{"cedula":"9000000002","grado":"PP"}'::jsonb
      where id = '33333333-0000-4000-a000-000000000003' $$,
  '23505', null,
  'una cédula duplicada hace fallar todo el update de app_metadata (sin huérfanos)'
);

select is(
  (select cedula from public.perfiles where id = '33333333-0000-4000-a000-000000000003'),
  'PENDIENTE-33333333',
  'tras el fallo, el tercer perfil sigue como PENDIENTE- (no quedó a medias)'
);

select * from finish();
rollback;
