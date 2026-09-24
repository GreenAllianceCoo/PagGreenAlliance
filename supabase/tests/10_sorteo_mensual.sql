-- ============================================================
-- Green Alliance · pgTAP · Fase 2 · sorteo mensual
-- boletas_sorteo, participar_sorteo(), confirmar_boleta_sorteo().
--
-- Nota: pgTAP no puede simular "hoy es día 3": now() es la fecha real del
-- servidor de pruebas. Como estas pruebas no corren entre el 1 y el 5,
-- participar_sorteo/confirmar_boleta_sorteo SIEMPRE deben fallar por
-- ventana cerrada; eso es justo lo que se prueba (fuera del 1 al 5 falla).
-- "Una boleta por mes" y "no ve la de otros" se prueban insertando
-- directamente en la tabla (como haría la función, sin depender del reloj).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-a000-00000000000a', 'asociado.a@prueba.test', '{"cedula":"1000000001","grado":"PP"}', '{"nombre_completo":"Asociado A"}'),
  ('00000000-0000-4000-a000-00000000000b', 'asociado.b@prueba.test', '{"cedula":"1000000002","grado":"OF"}', '{"nombre_completo":"Asociado B"}'),
  ('00000000-0000-4000-a000-0000000000ad', 'admin@prueba.test',      '{"cedula":"1000000003"}',             '{"nombre_completo":"Admin Prueba"}');
update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-a000-0000000000ad';

-- ------------------------------------------------------------
-- Fuera del 1 al 5: participar y confirmar fallan (para cualquier rol con
-- permiso de ejecutar la función; aquí se prueba con service_role).
-- ------------------------------------------------------------
reset role;
set local role service_role;

select throws_ok(
  $$ select * from public.participar_sorteo('00000000-0000-4000-a000-00000000000a') $$,
  'P0001', 'La inscripción al sorteo solo está abierta del 1 al 5 de cada mes',
  'participar_sorteo falla fuera de la ventana del 1 al 5'
);

select throws_ok(
  $$ select public.confirmar_boleta_sorteo('00000000-0000-4000-a000-00000000000a', '123456') $$,
  'P0001', 'La ventana del sorteo (1 al 5) ya cerró',
  'confirmar_boleta_sorteo falla fuera de la ventana del 1 al 5'
);

select is(
  public.sorteo_ventana_abierta(),
  (extract(day from (now() at time zone 'America/Bogota')) between 1 and 5),
  'sorteo_ventana_abierta refleja el día real (1 al 5)'
);

-- ------------------------------------------------------------
-- Una boleta por asociado y mes; un número único por mes (constraints de
-- tabla, iguales a las que usa participar_sorteo al insertar).
-- ------------------------------------------------------------
insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
values ('00000000-0000-4000-a000-00000000000a', 2026, 9, '111111');

select throws_ok(
  $$ insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
     values ('00000000-0000-4000-a000-00000000000a', 2026, 9, '222222') $$,
  '23505', null,
  'un asociado no puede tener dos boletas el mismo mes'
);

select lives_ok(
  $$ insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
     values ('00000000-0000-4000-a000-00000000000a', 2026, 10, '222222') $$,
  'el mismo asociado sí puede tener boleta en otro mes'
);

select throws_ok(
  $$ insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
     values ('00000000-0000-4000-a000-00000000000b', 2026, 9, '111111') $$,
  '23505', null,
  'el número de boleta es único dentro del mismo mes'
);

select lives_ok(
  $$ insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
     values ('00000000-0000-4000-a000-00000000000b', 2026, 9, '333333') $$,
  'otro asociado puede tener boleta el mismo mes con otro número'
);

select throws_ok(
  $$ insert into public.boletas_sorteo (asociado_id, anio, mes, numero) values
       ('00000000-0000-4000-a000-00000000000a', 2026, 12, '4444') $$,
  '23514', null,
  'rechaza un número de boleta que no tiene 6 dígitos'
);

select throws_ok(
  $$ update public.boletas_sorteo set estado = 'confirmada'
      where asociado_id = '00000000-0000-4000-a000-00000000000b' and anio = 2026 and mes = 9 $$,
  '23514', null,
  'una boleta confirmada exige fecha_confirmacion (chk de coherencia)'
);

select lives_ok(
  $$ update public.boletas_sorteo set estado = 'confirmada', fecha_confirmacion = now()
      where asociado_id = '00000000-0000-4000-a000-00000000000b' and anio = 2026 and mes = 9 $$,
  'confirmar con fecha_confirmacion sí es válido'
);

-- ------------------------------------------------------------
-- RLS: cada asociado ve solo su propia boleta; el admin las ve todas.
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.boletas_sorteo),
  2,
  'el asociado A solo ve sus propias boletas (2: septiembre y octubre)'
);

select is_empty(
  $$ select 1 from public.boletas_sorteo where asociado_id = '00000000-0000-4000-a000-00000000000b' $$,
  'el asociado A no ve la boleta del asociado B'
);

select throws_ok(
  $$ insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
     values ('00000000-0000-4000-a000-00000000000a', 2027, 1, '555555') $$,
  '42501', null,
  'un asociado no puede insertar su boleta directo (solo participar_sorteo, service_role)'
);

select throws_ok(
  $$ update public.boletas_sorteo set estado = 'confirmada'
      where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  '42501', null,
  'un asociado no puede confirmar su boleta directo (solo confirmar_boleta_sorteo, service_role)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.boletas_sorteo),
  3,
  'el admin ve todas las boletas (para listar los confirmados de cada mes)'
);

select is(
  (select count(*)::int from public.boletas_sorteo where anio = 2026 and mes = 9 and estado = 'confirmada'),
  1,
  'el admin puede filtrar los confirmados de un mes'
);

-- ------------------------------------------------------------
-- Privilegios de las funciones sensibles: solo service_role
-- ------------------------------------------------------------
select ok(
  not has_function_privilege('authenticated', 'public.participar_sorteo(uuid)', 'execute'),
  'authenticated no puede ejecutar participar_sorteo'
);

-- ------------------------------------------------------------
-- F2-01 (20260924000600): el número de boleta no se puede leer por columna
-- antes de confirmar; solo por mi_boleta_sorteo() y ya confirmada.
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ select numero from public.boletas_sorteo where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  '42501', null,
  'authenticated no puede leer la columna numero de boletas_sorteo (ni siquiera la propia)'
);

select lives_ok(
  $$ select estado, intentos from public.boletas_sorteo where asociado_id = '00000000-0000-4000-a000-00000000000a' $$,
  'authenticated sí puede leer estado e intentos de su propia boleta'
);

-- mi_boleta_sorteo(): 'enviada' -> numero null (asociado A, boleta de sep/2026)
select is(
  (select numero from public.mi_boleta_sorteo(2026::smallint, 9::smallint)),
  null,
  'mi_boleta_sorteo no revela el número mientras la boleta está "enviada"'
);

select is(
  (select estado::text from public.mi_boleta_sorteo(2026::smallint, 9::smallint)),
  'enviada',
  'mi_boleta_sorteo sí informa el estado aunque no esté confirmada'
);

-- mi_boleta_sorteo(): 'confirmada' -> numero real (asociado B, boleta de sep/2026)
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';

select is(
  (select numero from public.mi_boleta_sorteo(2026::smallint, 9::smallint)),
  '333333',
  'mi_boleta_sorteo revela el número una vez la boleta está "confirmada"'
);

-- No devuelve la boleta de otro asociado (aunque exista para ese mes).
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select is_empty(
  $$ select * from public.mi_boleta_sorteo(2099::smallint, 1::smallint) $$,
  'mi_boleta_sorteo no devuelve nada si el asociado no tiene boleta ese año/mes'
);

-- ------------------------------------------------------------
-- boletas_confirmadas_sorteo(): 0 filas para un asociado, N para el admin.
-- ------------------------------------------------------------
select is_empty(
  $$ select * from public.boletas_confirmadas_sorteo(2026::smallint, 9::smallint) $$,
  'un asociado no ve nada con boletas_confirmadas_sorteo (solo admin)'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  (select count(*)::int from public.boletas_confirmadas_sorteo(2026::smallint, 9::smallint)),
  1,
  'el admin ve las boletas confirmadas del mes (la de B, ya confirmada)'
);

select is(
  (select numero from public.boletas_confirmadas_sorteo(2026::smallint, 9::smallint) limit 1),
  '333333',
  'boletas_confirmadas_sorteo sí incluye el número (es el admin, y ya está confirmada)'
);

select * from finish();
rollback;
