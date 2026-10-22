-- ============================================================
-- Green Alliance · pgTAP · «Editar datos» en la base (migración 20261018100000,
-- revisión de seguridad del 18-oct: RS-M2, RS-M3, RS-B2).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('34000000-0000-4000-a000-0000000000ad', 'e.ad@prueba.test', '{"cedula":"3400000100"}', '{"nombre_completo":"Admin Treinta y cuatro"}'),
  ('34000000-0000-4000-a000-0000000000ae', 'e.ae@prueba.test', '{"cedula":"3400000101"}', '{"nombre_completo":"Admin Que Atiende"}'),
  ('34000000-0000-4000-a000-00000000000a', 'e.a1@prueba.test', '{"cedula":"3400000001","grado":"PT"}', '{"nombre_completo":"Ana Editable"}'),
  ('34000000-0000-4000-a000-00000000000b', 'e.a2@prueba.test', '{"cedula":"3400000002","grado":"PT"}', '{"nombre_completo":"Beto Cliente"}'),
  ('34000000-0000-4000-a000-00000000000c', 'e.a3@prueba.test', '{"cedula":"3400000003","grado":"PT"}', '{"nombre_completo":"Caro Sin Institucion"}');
update public.perfiles set rol = 'admin' where id = '34000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '34000000-0000-4000-a000-0000000000ae';
update public.perfiles set institucion = 'policia' where id in ('34000000-0000-4000-a000-00000000000a', '34000000-0000-4000-a000-00000000000b');
update public.perfiles set asesor_id = '34000000-0000-4000-a000-0000000000ae' where id = '34000000-0000-4000-a000-00000000000b';

create function pg_temp.editar(p_id uuid, p_nombre text, p_correo text default null, p_entidad text default null,
  p_tipo public.tipo_cuenta_nomina default null, p_numero text default null)
returns text[] language sql as $$
  select public.admin_editar_datos_asociado(p_id, p_nombre, '3001112233', p_correo, p_entidad, p_tipo, p_numero);
$$;

-- ------------------------------------------------------------
-- Admin A edita a Ana por la RPC
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"34000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  pg_temp.editar('34000000-0000-4000-a000-00000000000a', 'Ana Maria Editable', 'ana@policia.gov.co', 'Bancolombia', 'ahorros', '123456'),
  array['nombre', 'celular', 'correo_institucional', 'nomina'],
  'la RPC cambia los datos y devuelve las columnas cambiadas'
);
select is((select count(*)::int from public.historial_cambio_datos_perfil where perfil_id = '34000000-0000-4000-a000-00000000000a'), 1,
  'el cambio queda en el historial');
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-00000000000a', 'Ana Maria Editable', 'ana@policia.gov.co', 'Bancolombia', 'ahorros', '123456') $$,
  'P0001', 'No hay cambios para guardar', 'sin cambios no se guarda nada');
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-00000000000a', 'Ana', 'ana@gmail.com') $$,
  'P0001', 'El correo institucional no es del dominio de su institución', 'el correo debe ser del dominio de su institución');
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-00000000000c', 'Caro', 'caro@policia.gov.co') $$,
  'P0001', 'El asociado no tiene institución registrada: no se puede guardar un correo institucional',
  'sin institución no se acepta correo institucional');
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-0000000000ad', 'Yo Mismo') $$,
  'P0001', 'No puedes editar tus propios datos; debe hacerlo otro administrador', 'nadie se edita a sí mismo');
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-0000000000ae', 'Otro Admin') $$,
  'P0001', 'No encontramos al asociado', 'solo se editan asociados');

-- PATCH directo con la sesión del admin: rechazado.
select throws_ok($$ update public.perfiles set nomina_entidad = 'Nequi', nomina_tipo = 'deposito_electronico', nomina_numero = '3009998877'
                     where id = '34000000-0000-4000-a000-00000000000b' $$,
  'P0001', 'Los datos de un asociado solo se cambian con «Editar datos»', 'un admin no cambia la nómina de otro por UPDATE directo');
select throws_ok($$ update public.perfiles set nomina_entidad = 'Nequi', nomina_tipo = 'deposito_electronico', nomina_numero = '3009998877'
                     where id = '34000000-0000-4000-a000-0000000000ad' $$,
  'P0001', 'No puedes cambiar tus propios datos; debe hacerlo otro administrador', 'un admin no se cambia su propia nómina');
select lives_ok($$ update public.perfiles set telefono = '3005556677' where id = '34000000-0000-4000-a000-0000000000ad' $$,
  'un admin sí cambia su propio celular');
reset role;

-- ------------------------------------------------------------
-- El admin que atiende no edita a su cliente
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"34000000-0000-4000-a000-0000000000ae","role":"authenticated"}';
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-00000000000b', 'Beto Editado') $$,
  'P0001', 'Es uno de tus clientes: otro administrador debe editar sus datos', 'un admin no edita a sus clientes');
reset role;

-- ------------------------------------------------------------
-- El asociado
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"34000000-0000-4000-a000-00000000000b","role":"authenticated"}';
select throws_ok($$ select pg_temp.editar('34000000-0000-4000-a000-00000000000a', 'Hackeado') $$,
  'P0001', 'Solo un administrador puede editar los datos de un asociado', 'un asociado no usa la RPC');
select lives_ok($$ update public.perfiles set telefono = '3004443322' where id = '34000000-0000-4000-a000-00000000000b' $$,
  'el asociado sigue cambiando su propio celular');
select is_empty($$ select 1 from public.historial_cambio_datos_perfil $$, 'el asociado no lee el historial');
reset role;

-- ------------------------------------------------------------
-- RS-B2: un aviso retirado no se marca como visto
-- ------------------------------------------------------------
insert into public.avisos_asociados (id, titulo, mensaje, activo, created_at)
values ('34000000-aaaa-4000-a000-000000000001', 'Retirado', 'Este aviso ya no está activo.', false, now() + interval '1 minute');
set local role authenticated;
set local request.jwt.claims = '{"sub":"34000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select lives_ok($$ select public.marcar_aviso_visto('34000000-aaaa-4000-a000-000000000001') $$, 'marcar un aviso retirado no falla');
reset role;
select is((select count(*)::int from public.avisos_vistos where aviso_id = '34000000-aaaa-4000-a000-000000000001'), 0,
  'pero no deja fila en avisos_vistos');

select * from finish();
rollback;
