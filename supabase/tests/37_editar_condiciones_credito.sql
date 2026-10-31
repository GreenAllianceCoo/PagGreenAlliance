-- ============================================================
-- Green Alliance · pgTAP · «Editar condiciones» del crédito
-- (migración 20261030000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('37000000-0000-4000-a000-0000000000ad', 'c.ad@prueba.test', '{"cedula":"3700000100"}', '{"nombre_completo":"Admin Treinta y siete"}'),
  ('37000000-0000-4000-a000-00000000000a', 'c.a1@prueba.test', '{"cedula":"3700000001","grado":"PT"}', '{"nombre_completo":"Ana Credito"}');
update public.perfiles set rol = 'admin' where id = '37000000-0000-4000-a000-0000000000ad';

-- Los triggers de alta (proceso «operando», etc.) no son lo que se prueba aquí.
alter table public.solicitudes_credito disable trigger chk_credito_proceso_operando;
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado) values
  ('37000000-0000-4000-b000-000000000001', '37000000-0000-4000-a000-00000000000a', '50', 500000);
alter table public.solicitudes_credito enable trigger chk_credito_proceso_operando;

insert into public.convenios (id, nombre_empresa, visible) values
  ('37000000-0000-4000-c000-000000000001', 'Convenio Visible', true),
  ('37000000-0000-4000-c000-000000000002', 'Convenio Oculto', false);

create function pg_temp.editar(p_monto numeric, p_total numeric, p_plazo integer, p_pct integer,
  p_tipo public.tipo_credito default 'cooperativa', p_convenio uuid default null, p_motivo text default 'Ajuste acordado')
returns text[] language sql as $$
  select public.admin_editar_condiciones_credito('37000000-0000-4000-b000-000000000001', p_monto, p_total, p_plazo, p_pct, p_tipo, p_convenio, p_motivo);
$$;

select is((select porcentaje_credito::int from public.solicitudes_credito where id = '37000000-0000-4000-b000-000000000001'), 50,
  'al crear, el porcentaje vigente es el que eligió el asociado');

-- ------------------------------------------------------------
-- El asociado no edita ni lee lo que devuelve
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"37000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok($$ select pg_temp.editar(600000, 700000, 6, 70) $$, 'P0001',
  'Solo un administrador puede editar las condiciones de un crédito', 'el asociado no usa la RPC');
select throws_ok($$ select total_a_pagar from public.solicitudes_credito $$, '42501', null, 'el asociado no lee lo que devuelve');

-- ------------------------------------------------------------
-- Admin
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"37000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select throws_ok($$ update public.solicitudes_credito set plazo_meses = 12 where id = '37000000-0000-4000-b000-000000000001' $$,
  'P0001', 'Las condiciones de una solicitud solo se cambian con «Editar condiciones»', 'un UPDATE directo se rechaza');
select throws_ok($$ select pg_temp.editar(600000, 700000, 6, 49) $$, 'P0001',
  'El porcentaje debe ser un número entero entre 50 y 100', 'menos de 50 % no');
select throws_ok($$ select pg_temp.editar(600000, 700000, 6, 101) $$, 'P0001',
  'El porcentaje debe ser un número entero entre 50 y 100', 'más de 100 % no');
select throws_ok($$ select pg_temp.editar(600000, 500000, 6, 70) $$, 'P0001',
  'El total a pagar no puede ser menor que el monto a recibir', 'no devuelve menos de lo que recibe');
select throws_ok($$ select pg_temp.editar(600000, 700000, 61, 70) $$, 'P0001',
  'El plazo debe estar entre 1 y 60 meses', 'plazo fuera de rango');
select throws_ok($$ select pg_temp.editar(600000, 700000, 6, 70, 'convenio') $$, 'P0001', 'Elige el convenio', 'convenio obligatorio');
select throws_ok($$ select pg_temp.editar(600000, 700000, 6, 70, 'convenio', '37000000-0000-4000-c000-000000000002') $$, 'P0001',
  'Ese convenio no está disponible', 'un convenio oculto no se puede elegir');
select throws_ok($$ select pg_temp.editar(600000, 700000, 6, 70, 'cooperativa', null, 'no') $$, 'P0001',
  'El motivo debe tener entre 5 y 300 caracteres', 'motivo obligatorio');

-- Muy por encima del cupo de PT: el admin puede superarlo.
select is(
  pg_temp.editar(90000000, 95000000, 12, 73, 'convenio', '37000000-0000-4000-c000-000000000001'),
  array['porcentaje', 'monto', 'total', 'plazo', 'tipo'],
  'guarda todo, incluso sobre el cupo'
);
select is((select tasa_interes_mensual from public.solicitudes_credito where id = '37000000-0000-4000-b000-000000000001'),
  (select round(t50.tasa_interes_mensual + (t100.tasa_interes_mensual - t50.tasa_interes_mensual) * 23 / 50.0, 8)
     from public.grados_credito t50, public.grados_credito t100
    where t50.grado = 'PT' and t50.porcentaje = '50' and t100.grado = 'PT' and t100.porcentaje = '100'),
  'la tasa se interpola entre 50 % y 100 %');
select is((select count(*)::int from public.historial_solicitudes
            where entidad_id = '37000000-0000-4000-b000-000000000001' and accion = 'condiciones_editadas'), 1, 'queda en el historial');

-- Aprobada sin desembolsar: se puede. Desembolsada: no.
update public.solicitudes_credito set estado = 'aprobado' where id = '37000000-0000-4000-b000-000000000001';
select is(pg_temp.editar(90000000, 96000000, 12, 73, 'convenio', '37000000-0000-4000-c000-000000000001'), array['total'],
  'una aprobada sin desembolsar se edita');
select public.admin_marcar_desembolsado('37000000-0000-4000-b000-000000000001');
select throws_ok($$ select pg_temp.editar(90000000, 97000000, 12, 73, 'convenio', '37000000-0000-4000-c000-000000000001') $$, 'P0001',
  'Un crédito desembolsado no se puede editar', 'una desembolsada queda congelada');
select throws_ok($$ update public.solicitudes_credito set total_a_pagar = 1 where id = '37000000-0000-4000-b000-000000000001' $$,
  'P0001', 'Una solicitud ya resuelta no se puede modificar', 'ni por UPDATE directo');

select * from finish();
rollback;
