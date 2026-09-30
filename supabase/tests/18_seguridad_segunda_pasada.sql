-- ============================================================
-- Green Alliance · pgTAP · Segunda pasada de seguridad 2026-09-30
-- (20260930100500): RS-17, RS-18, RS-20, RS-21.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('18000000-0000-4000-a000-0000000000a1', 's.ric@prueba.test',  '{"cedula":"1800000001"}',              '{"nombre_completo":"Admin Que Atiende"}'),
  ('18000000-0000-4000-a000-0000000000a2', 's.adm@prueba.test',  '{"cedula":"1800000002"}',              '{"nombre_completo":"Otro Admin"}'),
  ('18000000-0000-4000-a000-0000000000e1', 's.as1@prueba.test',  '{"cedula":"1800000010"}',              '{"nombre_completo":"Asesor Uno"}'),
  ('18000000-0000-4000-a000-0000000000e2', 's.as2@prueba.test',  '{"cedula":"1800000011"}',              '{"nombre_completo":"Asesor Dos"}'),
  ('18000000-0000-4000-a000-00000000000c', 's.c@prueba.test',    '{"cedula":"1800000020","grado":"PP"}', '{"nombre_completo":"Cliente C"}'),
  ('18000000-0000-4000-a000-00000000000d', 's.d@prueba.test',    '{"cedula":"1800000021","grado":"PP"}', '{"nombre_completo":"Cliente D"}'),
  ('18000000-0000-4000-a000-00000000000f', 's.f@prueba.test',    '{"cedula":"1800000022","grado":"PP"}', '{"nombre_completo":"Cliente F"}');
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '18000000-0000-4000-a000-0000000000a1';
update public.perfiles set rol = 'admin' where id = '18000000-0000-4000-a000-0000000000a2';
update public.perfiles set rol = 'asesor' where id in ('18000000-0000-4000-a000-0000000000e1', '18000000-0000-4000-a000-0000000000e2');
update public.perfiles set asesor_id = '18000000-0000-4000-a000-0000000000e1'
 where id in ('18000000-0000-4000-a000-00000000000c', '18000000-0000-4000-a000-00000000000f');
update public.perfiles set asesor_id = '18000000-0000-4000-a000-0000000000a1' where id = '18000000-0000-4000-a000-00000000000d';

-- ------------------------------------------------------------
-- RS-17 (a): el admin no se asigna ni se quita clientes
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000a1","role":"authenticated"}';

select throws_ok(
  $$ update public.perfiles set asesor_id = null where id = '18000000-0000-4000-a000-00000000000d' $$,
  'P0001', 'Otro administrador debe asignar tus clientes',
  'el admin que atiende no se quita un cliente propio'
);
select throws_ok(
  $$ update public.perfiles set asesor_id = '18000000-0000-4000-a000-0000000000a1' where id = '18000000-0000-4000-a000-00000000000c' $$,
  'P0001', 'Otro administrador debe asignar tus clientes',
  'el admin que atiende no se asigna un cliente'
);
select lives_ok(
  $$ update public.perfiles set asesor_id = '18000000-0000-4000-a000-0000000000e2' where id = '18000000-0000-4000-a000-00000000000c' $$,
  'sí mueve clientes entre otros asesores'
);

set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ update public.perfiles set asesor_id = '18000000-0000-4000-a000-0000000000e1' where id = '18000000-0000-4000-a000-00000000000d' $$,
  'otro admin sí reasigna los clientes del admin que atiende'
);

-- ------------------------------------------------------------
-- RS-17 (b): el ingreso nuevo es del asesor de cuando pasó a operando
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo) values
  ('18000000-0000-4000-a000-00000000000f', 'operando',
     (select inicio from public.periodo_comision((now() at time zone 'America/Bogota')::date)));
update public.perfiles set asesor_id = '18000000-0000-4000-a000-0000000000e2' where id = '18000000-0000-4000-a000-00000000000f';

select is(
  (select asesor_id from public.historial_proceso_ejecutivo where asociado_id = '18000000-0000-4000-a000-00000000000f'),
  '18000000-0000-4000-a000-0000000000e1'::uuid,
  'el historial guarda el asesor del momento del cambio'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is((select ingresos_nuevos from public.comisiones_periodo_asesor()), 1,
  'el ingreso nuevo cuenta para el asesor que tenía el cliente al pasar a operando');

set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000e2","role":"authenticated"}';
select is((select ingresos_nuevos from public.comisiones_periodo_asesor()), 0,
  'reasignar el cliente después no le pasa el ingreso nuevo al asesor actual');

-- ------------------------------------------------------------
-- RS-18: fotos huérfanas
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
insert into public.solicitudes_afiliacion (
  id, nombres, apellidos, cedula, grado, institucion, celular, nequi, email, correo_institucional,
  nomina_entidad, nomina_tipo, nomina_numero,
  foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
) values ('18000000-0000-4000-c000-000000000001', 'Con', 'Solicitud', '1800000099', 'PP', 'policia',
          '3001800000', '3001800000', 'con.sol@prueba.test', 'con.sol@policia.gov.co',
          'Bancolombia', 'ahorros', '123456', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now());

insert into storage.objects (bucket_id, name, created_at) values
  ('afiliacion-documentos', 'solicitudes/18000000-0000-4000-c000-000000000001/frente.jpg', now() - interval '6 hours'),  -- tiene solicitud
  ('afiliacion-documentos', 'solicitudes/18000000-0000-4000-c000-0000000000f1/frente.jpg', now() - interval '5 hours'),  -- huérfana (más vieja)
  ('afiliacion-documentos', 'solicitudes/18000000-0000-4000-c000-0000000000f2/selfie.jpg', now() - interval '4 hours'),  -- huérfana
  ('afiliacion-documentos', 'solicitudes/18000000-0000-4000-c000-0000000000f3/frente.jpg', now() - interval '1 hour'),   -- reciente
  ('afiliacion-documentos', 'solicitudes/no-es-uuid/frente.jpg',                             now() - interval '7 hours'),  -- segmento no uuid
  ('afiliacion-documentos', 'otra/18000000-0000-4000-c000-0000000000f4/frente.jpg',         now() - interval '7 hours');  -- fuera de solicitudes/

set local role service_role;
select results_eq(
  $$ select name from public.fotos_huerfanas_afiliacion() where name like 'solicitudes/18000000-%' $$,
  $$ values ('solicitudes/18000000-0000-4000-c000-0000000000f1/frente.jpg'::text),
            ('solicitudes/18000000-0000-4000-c000-0000000000f2/selfie.jpg'::text) $$,
  'solo huérfanas de más de 3 h, sin segmentos no uuid, las más viejas primero'
);
select is(
  (select count(*)::int from public.fotos_huerfanas_afiliacion(1)),
  1,
  'respeta p_limite'
);
select lives_ok($$ select * from public.fotos_huerfanas_afiliacion(500) $$, 'service_role la ejecuta');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select throws_ok($$ select * from public.fotos_huerfanas_afiliacion() $$, '42501', null,
  'authenticated (ni un admin) ejecuta fotos_huerfanas_afiliacion');
reset role;
set local role anon;
select throws_ok($$ select * from public.fotos_huerfanas_afiliacion() $$, '42501', null,
  'anon no ejecuta fotos_huerfanas_afiliacion');

-- ------------------------------------------------------------
-- RS-20: el admin que atiende no ve por RLS sus pagos ni su bitácora
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';
insert into public.pagos_comision (id, asesor_id, periodo_corte, concepto, monto) values
  ('18000000-0000-4000-b000-000000000001', '18000000-0000-4000-a000-0000000000a1', '2026-09-15', 'ingreso_nuevo', 500000),
  ('18000000-0000-4000-b000-000000000002', '18000000-0000-4000-a000-0000000000e1', '2026-09-15', 'ingreso_nuevo', 500000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
select is(
  (select count(*)::int from public.pagos_comision where id::text like '18000000-0000-4000-b000-%'),
  1, 'el admin que atiende solo ve pagos de otros'
);
select is(
  (select count(*)::int from public.bitacora_pagos_comision where pago_id::text like '18000000-0000-4000-b000-%'),
  1, 'el admin que atiende no ve la bitácora de sus pagos'
);

set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select is(
  (select count(*)::int from public.pagos_comision where id::text like '18000000-0000-4000-b000-%'),
  2, 'otro admin ve los dos pagos'
);
select is(
  (select count(*)::int from public.bitacora_pagos_comision where pago_id::text like '18000000-0000-4000-b000-%'),
  2, 'otro admin ve la bitácora de los dos pagos'
);

-- ------------------------------------------------------------
-- RS-21: el contador suma como máximo 1 por minuto
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is(public.revelar_acumulado_comision(), 500000::numeric, 'revelar devuelve la suma');
select is(public.revelar_acumulado_comision(), 500000::numeric, 'revelar otra vez dentro del minuto sigue devolviendo la suma');

reset role;
set local request.jwt.claims = '';
select is(
  (select veces from public.revelaciones_acumulado_comision where asesor_id = '18000000-0000-4000-a000-0000000000e1'),
  1, 'dos revelaciones en menos de 1 minuto cuentan una vez'
);
update public.revelaciones_acumulado_comision set ultima_at = now() - interval '2 minutes'
 where asesor_id = '18000000-0000-4000-a000-0000000000e1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"18000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select public.revelar_acumulado_comision();

reset role;
set local request.jwt.claims = '';
select is(
  (select veces from public.revelaciones_acumulado_comision where asesor_id = '18000000-0000-4000-a000-0000000000e1'),
  2, 'pasado el minuto vuelve a contar'
);

select * from finish();
rollback;
