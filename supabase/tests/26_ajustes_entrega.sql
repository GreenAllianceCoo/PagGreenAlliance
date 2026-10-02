-- ============================================================
-- Green Alliance · pgTAP · Ajustes de entrega (20261002400000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('26000000-0000-4000-a000-000000000001', 'j.uno@prueba.test', '{"cedula":"2600000001","grado":"PT"}', '{"nombre_completo":"Asociado J"}'),
  ('26000000-0000-4000-a000-0000000000a1', 'j.as@prueba.test', '{"cedula":"2600000002","grado":"PT"}', '{"nombre_completo":"Asesor J"}'),
  ('26000000-0000-4000-a000-0000000000ad', 'j.ad@prueba.test', '{"cedula":"2600000003","grado":"PT"}', '{"nombre_completo":"Admin J"}');
update public.perfiles set rol = 'asesor' where id = '26000000-0000-4000-a000-0000000000a1';
update public.perfiles set rol = 'admin' where id = '26000000-0000-4000-a000-0000000000ad';

-- Tope de clics por asesor y meta: la apertura (null) no bloquea el toque en 50
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);
select is(public.registrar_clic_premios(null), true, 'apertura se registra');
select is(public.registrar_clic_premios(50), true, 'toque en 50 justo después de la apertura se registra');
select is(public.registrar_clic_premios(50), false, 'segundo toque en 50 dentro del minuto no');
select is(public.registrar_clic_premios(100), true, 'toque en 100 es otra meta: se registra');

select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select is(
  (select aperturas * 100 + toques_50 * 10 + toques_100 from public.admin_premios_asesores() where asesor_id = '26000000-0000-4000-a000-0000000000a1'),
  111, 'admin: 1 apertura, 1 toque en 50, 1 toque en 100');

-- Regenerar con tope por minuto
select set_config('request.jwt.claims', '{"sub":"26000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select isnt(public.mi_carne_token(), null, 'token creado');
select isnt(public.regenerar_carne_token(), null, 'primera regeneración funciona');
select is(public.regenerar_carne_token(), null, 'segunda regeneración dentro del minuto: null');

-- Baja: la verificación pública ya no devuelve nada
reset role;
create temp table tk as select token from public.carne_tokens;
grant all on tk to public;
select set_config('request.jwt.claims', '', true);
select set_config('ga.cambio_estado_asociado', 'si', true);
update public.perfiles set activo = false where id = '26000000-0000-4000-a000-000000000001';
set local role anon;
select is((select count(*)::int from public.verificar_carne((select token from tk))), 0, 'asociado dado de baja: cero filas');

select * from finish();
rollback;
