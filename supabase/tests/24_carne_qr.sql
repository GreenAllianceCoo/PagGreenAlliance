-- ============================================================
-- Green Alliance · pgTAP · Carné con QR (20261002200000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('24000000-0000-4000-a000-000000000001', 'q.uno@prueba.test', '{"cedula":"2400000001","grado":"PP"}', '{"nombre_completo":"Asociado Uno"}'),
  ('24000000-0000-4000-a000-000000000002', 'q.dos@prueba.test', '{"cedula":"2400000002","grado":"PT"}', '{"nombre_completo":"Asociado Dos"}');
update public.perfiles set institucion = 'policia' where id = '24000000-0000-4000-a000-000000000001';

create temp table tk (n int, token uuid);
grant all on tk to public;

set local role authenticated;
set local request.jwt.claims = '{"sub":"24000000-0000-4000-a000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.carne_tokens$$, '42501', null, 'authenticated no lee carne_tokens directamente');

insert into tk select 1, public.mi_carne_token();
select isnt((select token from tk where n = 1), null, 'el asociado obtiene su token');
select is(public.mi_carne_token(), (select token from tk where n = 1), 'el token es estable entre llamadas');

insert into tk select 2, public.regenerar_carne_token();
select isnt((select token from tk where n = 2), (select token from tk where n = 1), 'regenerar cambia el token');

-- Verificación pública (anon)
reset role;
set local role anon;
select is(
  (select count(*)::int from public.verificar_carne((select token from tk where n = 1))),
  0, 'el token anterior ya no sirve'
);
select results_eq(
  $$select nombre, grado, institucion, activo from public.verificar_carne((select token from tk where n = 2))$$,
  $$values ('Asociado Uno'::text, 'Patrullero de Policía'::text, 'Policía Nacional'::text, true)$$,
  'anon ve solo nombre, grado, institución y activo'
);
select is(
  (select count(*)::int from public.verificar_carne('00000000-0000-4000-8000-000000000000')),
  0, 'token inexistente: cero filas'
);
select is((select count(*)::int from public.verificar_carne(null)), 0, 'token nulo: cero filas');
select throws_ok($$select public.mi_carne_token()$$, '42501', null, 'anon no puede pedir un token');

-- Baja (S-01): la verificación pública ya no devuelve nada
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('ga.cambio_estado_asociado', 'si', true);
update public.perfiles set activo = false where id = '24000000-0000-4000-a000-000000000001';
set local role anon;
select is(
  (select count(*)::int from public.verificar_carne((select token from tk where n = 2))),
  0, 'un asociado dado de baja ya no se verifica (cero filas)'
);

select * from finish();
rollback;
