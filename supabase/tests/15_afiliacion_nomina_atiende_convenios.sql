-- ============================================================
-- Green Alliance · pgTAP · Requerimientos de Ricardo · nómina y correos
-- (20260929100200), atiende_asociados (20260929100000), convenios
-- (20260929100600) y privilegios de las funciones nuevas.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('15000000-0000-4000-a000-00000000000a', 'n.a@prueba.test',    '{"cedula":"1500000001","grado":"PP"}', '{"nombre_completo":"Asociado Nómina"}'),
  ('15000000-0000-4000-a000-0000000000ad', 'n.adm@prueba.test',  '{"cedula":"1500000009"}',              '{"nombre_completo":"Admin Ricardo"}'),
  ('15000000-0000-4000-a000-0000000000ae', 'n.adm2@prueba.test', '{"cedula":"1500000008"}',              '{"nombre_completo":"Admin Que No Atiende"}'),
  ('15000000-0000-4000-a000-0000000000e1', 'n.as@prueba.test',   '{"cedula":"1500000010"}',              '{"nombre_completo":"Asesor Inactivo"}');
update public.perfiles set rol = 'admin' where id in ('15000000-0000-4000-a000-0000000000ad', '15000000-0000-4000-a000-0000000000ae');
update public.perfiles set rol = 'asesor', activo = false where id = '15000000-0000-4000-a000-0000000000e1';

-- Inserta una afiliación de prueba con valores base y un cambio.
create or replace function pg_temp.afiliar(p_cedula text, p_email text, p_inst text,
                                           p_entidad text, p_tipo text, p_numero text)
returns void language sql as $f$
  insert into public.solicitudes_afiliacion (
    nombres, apellidos, cedula, grado, institucion, celular, nequi, email, correo_institucional,
    nomina_entidad, nomina_tipo, nomina_numero,
    foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
  ) values ('Prueba', 'Nómina', p_cedula, 'PP', 'policia', '3002000000', '3002000000', p_email, p_inst,
            p_entidad, p_tipo::public.tipo_cuenta_nomina, p_numero, 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now());
$f$;

-- ------------------------------------------------------------
-- Afiliación: cuenta de nómina y dos correos
-- ------------------------------------------------------------
select lives_ok($$ select pg_temp.afiliar('1500000101', 'personal@correo.test', 'inst@policia.gov.co', 'Bancolombia', 'ahorros', '123456') $$,
  'acepta cuenta de ahorros de 6 dígitos y dos correos distintos');
select lives_ok($$ select pg_temp.afiliar('1500000102', 'p2@correo.test', 'i2@policia.gov.co', 'Nequi', 'deposito_electronico', '3101234567') $$,
  'acepta billetera (depósito electrónico) con el celular');
select throws_ok($$ select pg_temp.afiliar('1500000103', 'p3@correo.test', 'i3@policia.gov.co', 'Nequi', 'deposito_electronico', '1234567') $$,
  '23514', null, 'depósito electrónico exige un celular (3 + 9 dígitos)');
select throws_ok($$ select pg_temp.afiliar('1500000104', 'p4@correo.test', 'i4@policia.gov.co', 'Davivienda', 'corriente', '12345') $$,
  '23514', null, 'rechaza una cuenta de 5 dígitos');
select throws_ok($$ select pg_temp.afiliar('1500000105', 'p5@correo.test', 'i5@policia.gov.co', 'Davivienda', 'corriente', '123456789012345678901') $$,
  '23514', null, 'rechaza una cuenta de 21 dígitos');
select throws_ok($$ select pg_temp.afiliar('1500000106', 'p6@correo.test', 'i6@policia.gov.co', null, 'ahorros', '123456') $$,
  '23514', null, 'la cuenta de nómina va completa (entidad, tipo y número)');
select throws_ok($$ select pg_temp.afiliar('1500000107', 'mismo@correo.test', 'mismo@correo.test', 'BBVA Colombia', 'ahorros', '123456') $$,
  '23514', null, 'el correo institucional y el personal deben ser distintos');
select throws_ok($$ select pg_temp.afiliar('1500000108', 'p8@correo.test', 'Inst@Policia.gov.co', 'BBVA Colombia', 'ahorros', '123456') $$,
  '23514', null, 'el correo institucional se guarda en minúsculas');

-- ------------------------------------------------------------
-- Admin: no cambia lo que envió el solicitante
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select throws_ok(
  $$ update public.solicitudes_afiliacion set nomina_numero = '999999' where cedula = '1500000101' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'el admin no cambia la cuenta de nómina de una afiliación'
);
select throws_ok(
  $$ update public.solicitudes_afiliacion set correo_institucional = 'otro@policia.gov.co' where cedula = '1500000101' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación',
  'el admin no cambia el correo institucional de una afiliación'
);

-- ------------------------------------------------------------
-- Asociado: solo su teléfono
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"15000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ update public.perfiles set nomina_entidad = 'Nequi', nomina_tipo = 'deposito_electronico', nomina_numero = '3109999999'
      where id = '15000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su cuenta de nómina; solicítelo a la administración',
  'el asociado no cambia su cuenta de nómina'
);
select throws_ok(
  $$ update public.perfiles set correo_institucional = 'yo@policia.gov.co' where id = '15000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su correo institucional; solicítelo a la administración',
  'el asociado no cambia su correo institucional'
);
select throws_ok(
  $$ update public.perfiles set atiende_asociados = true where id = '15000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar si atiende asociados; solicítelo a la administración',
  'el asociado no se vuelve «asesor» con atiende_asociados'
);
select lives_ok(
  $$ update public.perfiles set telefono = '3109998877' where id = '15000000-0000-4000-a000-00000000000a' $$,
  'el asociado sigue pudiendo cambiar su teléfono'
);

-- ------------------------------------------------------------
-- atiende_asociados: admin que atiende = asesor válido
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ update public.perfiles set asesor_id = '15000000-0000-4000-a000-0000000000ad' where id = '15000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'asesor_id debe ser un perfil con rol asesor',
  'un admin que NO atiende asociados no puede ser asesor de nadie'
);

update public.perfiles set atiende_asociados = true where id = '15000000-0000-4000-a000-0000000000ad';

select lives_ok(
  $$ update public.perfiles set asesor_id = '15000000-0000-4000-a000-0000000000ad' where id = '15000000-0000-4000-a000-00000000000a' $$,
  'un admin con atiende_asociados sí puede ser asesor (caso Ricardo)'
);

select throws_ok(
  $$ update public.perfiles set asesor_id = '15000000-0000-4000-a000-0000000000e1' where id = '15000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'asesor_id debe ser un perfil con rol asesor',
  'un asesor inactivo no recibe clientes'
);

select set_eq(
  $$ select nombre from public.obtener_asesores_publico()
      where id in ('15000000-0000-4000-a000-0000000000ad', '15000000-0000-4000-a000-0000000000ae', '15000000-0000-4000-a000-0000000000e1') $$,
  array['Admin Ricardo'],
  'el desplegable lista al admin que atiende, y no al que no atiende ni al asesor inactivo'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"15000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select is(
  (select count(*)::int from public.resumen_clientes_asesor() where perfil_id = '15000000-0000-4000-a000-00000000000a'),
  1,
  'el admin que atiende ve a su cliente en resumen_clientes_asesor'
);
reset role;
set local request.jwt.claims = '';

-- ------------------------------------------------------------
-- Convenios (migración de datos)
-- ------------------------------------------------------------
select is(
  (select count(*)::int from public.convenios
    where nit in ('902.038.118-7', '901.865.816-3', '1.090.464.475-4', '1.054.095.149-3', '52.953.735-3') and activo),
  5,
  'están los 5 convenios de la spec, activos, por NIT'
);
select is(
  (select servicios from public.convenios where nit = '1.054.095.149-3'),
  array['Tour en cuatrimoto', 'Tour en cabalgata (caballos)', 'Pit bike', 'Buggy', 'Termales', 'Chiva rumbera'],
  'Racing Tours: servicios con las mayúsculas corregidas'
);
select is(
  (select cardinality(sedes) || '|' || telefono_contacto from public.convenios where nit = '1.090.464.475-4'),
  '2|3144612829',
  'Dr. Ribero: dos sedes y su WhatsApp'
);
select throws_ok(
  $$ insert into public.convenios (nombre_empresa, telefono_contacto) values ('Tel malo', '12345') $$,
  '23514', null,
  'el WhatsApp de un convenio es un celular de 10 dígitos'
);

-- ------------------------------------------------------------
-- Privilegios de las funciones nuevas
-- ------------------------------------------------------------
select set_eq(
  $$ select p.proname::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array['es_admin', 'resumen_clientes_asesor', 'mi_boleta_sorteo', 'boletas_confirmadas_sorteo',
        'agregar_nota_solicitud',
        'admin_actualizar_proceso_ejecutivo', 'crear_alerta_asociado', 'admin_marcar_alerta_atendida',
        'mi_proceso_ejecutivo', 'revelar_acumulado_comision', 'comisiones_periodo_asesor', 'buscar_cliente_asesor',
        'admin_editar_pago_comision', 'admin_anular_pago_comision', 'tabla_credito_con_tasa', 'admin_tasas_solicitudes'],
  'solo estas funciones security definer (que se validan solas) las ejecuta authenticated'
);
select is_empty(
  $$ select p.proname::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon no ejecuta ninguna función security definer'
);

select * from finish();
rollback;
