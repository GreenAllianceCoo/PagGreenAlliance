-- Green Alliance · pgTAP · 20261002300000 (inscritos al sorteo, solo admin)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('25000000-0000-4000-a000-0000000000ad', 's.adm@prueba.test', '{"cedula":"2500000009"}', '{"nombre_completo":"Admin S"}'),
  ('25000000-0000-4000-a000-00000000000a', 's.a@prueba.test',   '{"cedula":"2500000001","grado":"PP"}', '{"nombre_completo":"Inscrita S"}');
update public.perfiles set rol = 'admin' where id = '25000000-0000-4000-a000-0000000000ad';
insert into public.boletas_sorteo (asociado_id, anio, mes, numero, estado, fecha_confirmacion)
  values ('25000000-0000-4000-a000-00000000000a', 2099, 3, '123456', 'confirmada', now());

select ok(not has_function_privilege('anon', 'public.admin_inscritos_sorteo(smallint, smallint)', 'execute'), 'anon no la ejecuta');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"25000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.admin_inscritos_sorteo(2099::smallint, 3::smallint)), 0, 'un asociado recibe 0 filas');

select set_config('request.jwt.claims', '{"sub":"25000000-0000-4000-a000-0000000000ad","role":"authenticated"}', true);
select is((select count(*)::int from public.admin_inscritos_sorteo(2099::smallint, 3::smallint)), 1, 'el admin ve al inscrito');
select is((select cedula_enmascarada from public.admin_inscritos_sorteo(2099::smallint, 3::smallint)), '•••••••001', 'cédula enmascarada');
select is((select grado from public.admin_inscritos_sorteo(2099::smallint, 3::smallint)), 'Patrullero de Policía', 'grado con nombre');
select is((select count(*)::int from public.admin_inscritos_sorteo(2099::smallint, 4::smallint)), 0, 'otro mes: vacío');

select * from finish();
rollback;
