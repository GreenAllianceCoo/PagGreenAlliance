-- ============================================================
-- Green Alliance · pgTAP · premios de asesores (20261002100000):
-- el PRIMER asesor en llegar a 50 y el primero en llegar a 100 asociados operando
-- gana el premio (una sola vez); clics sobre «Premios»; RLS estricta.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Asesor B (llega primero), asesor A, admin y un asociado sin cartera.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('23000000-0000-4000-a000-0000000000b1', 'p.b@prueba.test',   '{"cedula":"2300000010"}', '{"nombre_completo":"Asesor B"}'),
  ('23000000-0000-4000-a000-0000000000a1', 'p.a@prueba.test',   '{"cedula":"2300000011"}', '{"nombre_completo":"Asesor A"}'),
  ('23000000-0000-4000-a000-0000000000ad', 'p.adm@prueba.test', '{"cedula":"2300000099"}', '{"nombre_completo":"Admin P"}'),
  ('23000000-0000-4000-a000-0000000000f1', 'p.soc@prueba.test', '{"cedula":"2300000098","grado":"PP"}', '{"nombre_completo":"Asociado P"}');
update public.perfiles set rol = 'asesor' where id in ('23000000-0000-4000-a000-0000000000b1', '23000000-0000-4000-a000-0000000000a1');
update public.perfiles set rol = 'admin'  where id = '23000000-0000-4000-a000-0000000000ad';

-- 150 clientes: 1..100 de B, 101..150 de A.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
select ('23100000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
       'p.c' || n || '@prueba.test',
       jsonb_build_object('cedula', '24' || lpad(n::text, 8, '0'), 'grado', 'PP'),
       jsonb_build_object('nombre_completo', 'Cliente P ' || n)
from generate_series(1, 150) n;
update public.perfiles set asesor_id = '23000000-0000-4000-a000-0000000000b1'
 where id in (select ('23100000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 100) n);
update public.perfiles set asesor_id = '23000000-0000-4000-a000-0000000000a1'
 where id in (select ('23100000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid from generate_series(101, 150) n);

select has_function('public', 'mis_premios_asesor', 'existe mis_premios_asesor');
select ok(not has_function_privilege('anon', 'public.registrar_clic_premios(integer)', 'execute'), 'anon no registra clics');
select ok(not has_function_privilege('anon', 'public.admin_premios_asesores()', 'execute'), 'anon no ejecuta admin_premios_asesores');
select ok(not has_function_privilege('authenticated', 'public.evaluar_premios_asesor(uuid)', 'execute'),
  'nadie asigna premios a mano: evaluar_premios_asesor no es ejecutable');

-- B llega a 50 primero.
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo)
select ('23100000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, 'operando', current_date from generate_series(1, 49) n;
select is((select count(*)::int from public.premios_asesores_ganadores), 0, 'con 49 asociados nadie gana');
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo)
values ('23100000-0000-4000-a000-000000000050', 'operando', current_date);
select is((select asesor_id::text from public.premios_asesores_ganadores where meta = 50),
  '23000000-0000-4000-a000-0000000000b1', 'B gana el bono de 50 al llegar primero');

-- A también llega a 50 después: el premio no cambia.
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo)
select ('23100000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, 'operando', current_date from generate_series(101, 150) n;
select is((select asesor_id::text from public.premios_asesores_ganadores where meta = 50),
  '23000000-0000-4000-a000-0000000000b1', 'A llega a 50 después y el bono sigue siendo de B');
select is((select count(*)::int from public.premios_asesores_ganadores where meta = 100), 0, 'meta 100 aún sin ganador');

-- B llega a 100.
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo)
select ('23100000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, 'operando', current_date from generate_series(51, 100) n;
select is((select asesor_id::text from public.premios_asesores_ganadores where meta = 100),
  '23000000-0000-4000-a000-0000000000b1', 'B gana el viaje de 100');
select throws_ok($$ insert into public.premios_asesores_ganadores (meta, asesor_id, clientes_al_ganar)
                    values (50, '23000000-0000-4000-a000-0000000000a1', 50) $$,
  '23505', null, 'no puede haber dos ganadores de la misma meta');

-- ------------------------------------------------------------
-- Asesor A (perdió la carrera)
-- ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);

select is((select clientes_acumulados from public.mis_premios_asesor() where meta = 50), 50, 'A ve su conteo: 50');
select is((select estado from public.mis_premios_asesor() where meta = 50), 'ya_ganado', 'A: bono de 50 «ya fue ganado»');
select is((select estado from public.mis_premios_asesor() where meta = 100), 'ya_ganado', 'A: viaje de 100 «ya fue ganado»');
select ok((select ganado_at is null from public.mis_premios_asesor() where meta = 50), 'A no ve cuándo ni quién ganó');
select is((select count(*)::int from public.premios_asesores_ganadores), 0, 'A no lee la tabla de ganadores (RLS)');
select throws_ok($$ select * from public.premios_asesores_clics $$, '42501', null, 'A no lee la tabla de clics');
select throws_ok($$ insert into public.premios_asesores_clics (asesor_id) values ('23000000-0000-4000-a000-0000000000a1') $$,
  '42501', null, 'A no inserta clics directamente');
select is(public.registrar_clic_premios(7), false, 'meta inválida: no se registra');
select is(public.registrar_clic_premios(50), true, 'primer clic: se registra');
select is(public.registrar_clic_premios(50), false, 'segundo clic en el mismo minuto: no se registra');
select is((select count(*)::int from public.admin_premios_asesores()), 0, 'A no ejecuta la vista admin');

-- ------------------------------------------------------------
-- Asesor B (ganador)
-- ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-a000-0000000000b1","role":"authenticated"}', true);
select is((select estado from public.mis_premios_asesor() where meta = 50), 'ganado_por_mi', 'B: ganó el bono de 50');
select ok((select ganado_at is not null from public.mis_premios_asesor() where meta = 100), 'B ve cuándo ganó el viaje');

-- ------------------------------------------------------------
-- Admin
-- ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select is((select clics from public.admin_premios_asesores() where asesor_id = '23000000-0000-4000-a000-0000000000a1'), 1, 'admin: A tiene 1 clic');
select ok((select ultimo_clic is not null from public.admin_premios_asesores() where asesor_id = '23000000-0000-4000-a000-0000000000a1'), 'admin: último clic de A');
select ok((select gano_50_at is not null and gano_100_at is not null
             from public.admin_premios_asesores() where asesor_id = '23000000-0000-4000-a000-0000000000b1'), 'admin: B ganó 50 y 100');

-- ------------------------------------------------------------
-- Asociado
-- ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"23000000-0000-4000-a000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.mis_premios_asesor()), 0, 'un asociado no ve premios de asesores');
select is(public.registrar_clic_premios(null), false, 'un asociado no registra clics');

select * from finish();
rollback;
