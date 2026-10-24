-- ============================================================
-- Green Alliance · pgTAP · Editar los datos de una solicitud de afiliación
-- (migración 20261023000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('36000000-0000-4000-a000-0000000000ad', 'f.ad@prueba36.test', '{"cedula":"3600000100"}', '{"nombre_completo":"Admin Treinta y seis"}'),
  ('36000000-0000-4000-a000-0000000000ae', 'f.se@prueba36.test', '{"cedula":"3600000101"}', '{"nombre_completo":"Secretario Treinta y seis"}'),
  ('36000000-0000-4000-a000-00000000000a', 'f.asociado@prueba36.test', '{"cedula":"3600000001","grado":"PT"}', '{"nombre_completo":"Asociado Existente"}');
update public.perfiles set rol = 'admin' where id = '36000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'secretario' where id = '36000000-0000-4000-a000-0000000000ae';

insert into public.solicitudes_afiliacion (id, nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
  correo_institucional, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at)
values
  ('36000000-aaaa-4000-a000-000000000001', 'Pedro', 'Prez', '3600000010', 'PT', 'policia', '3003600010', '3003600010',
   'pedro.mal@gmail.test', 'pedro@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()),
  ('36000000-aaaa-4000-a000-000000000002', 'Laura', 'Otra', '3600000020', 'PT', 'policia', '3003600020', '3003600020',
   'laura@gmail.test', 'laura@policia.gov.co', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now());

create function pg_temp.editar(p_id uuid, p_apellidos text, p_cedula text, p_email text, p_inst text)
returns text[] language sql as $$
  select public.admin_editar_afiliacion(p_id, 'Pedro', p_apellidos, p_cedula, 'policia', 'PT',
    '3003600010', '3003600010', p_email, p_inst, null, null, null);
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"36000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

select is(
  pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000010', 'pedro@gmail.test', 'pedro@policia.gov.co'),
  array['nombre', 'correo_personal'],
  'el admin corrige apellido y correo personal'
);
select is((select nombre from public.solicitudes_afiliacion where id = '36000000-aaaa-4000-a000-000000000001'), 'Pedro Pérez',
  'el nombre completo se recompone');
select is((select count(*)::int from public.historial_solicitudes
            where entidad_id = '36000000-aaaa-4000-a000-000000000001' and accion = 'datos_editados'), 1,
  'queda «datos_editados» en el historial');
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000010', 'pedro@gmail.test', 'pedro@policia.gov.co') $$,
  'P0001', 'No hay cambios para guardar', 'sin cambios no se guarda');
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000001', 'pedro@gmail.test', 'pedro@policia.gov.co') $$,
  'P0001', 'Esa cédula ya tiene cuenta u otra solicitud en curso', 'no acepta la cédula de un asociado');
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000020', 'pedro@gmail.test', 'pedro@policia.gov.co') $$,
  'P0001', 'Esa cédula ya tiene cuenta u otra solicitud en curso', 'no acepta la cédula de otra solicitud abierta');
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000010', 'f.asociado@prueba36.test', 'pedro@policia.gov.co') $$,
  'P0001', 'Ese correo personal ya lo usa otra cuenta u otra solicitud en curso', 'no acepta el correo de una cuenta');
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000010', 'pedro@gmail.test', 'laura@policia.gov.co') $$,
  'P0001', 'Ese correo institucional ya lo usa otra cuenta u otra solicitud en curso', 'no acepta el institucional de otra solicitud');
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Pérez', '3600000010', 'pedro@gmail.test', 'pedro@gmail.test.co') $$,
  'P0001', 'El correo institucional no es del dominio de su institución', 'valida el dominio institucional');

-- Fuera de la RPC, con sesión, los datos siguen sin poder cambiarse.
select throws_ok($$ update public.solicitudes_afiliacion set cedula = '3600000099' where id = '36000000-aaaa-4000-a000-000000000001' $$,
  'P0001', 'Solo se puede cambiar el estado de la solicitud de afiliación', 'el UPDATE directo sigue bloqueado');

-- Una vez aprobada ya no se corrige.
update public.solicitudes_afiliacion set estado = 'aprobada' where id = '36000000-aaaa-4000-a000-000000000002';
select throws_ok($$ select public.admin_editar_afiliacion('36000000-aaaa-4000-a000-000000000002', 'Laura', 'Otra', '3600000020', 'policia', 'PT',
                     '3003600020', '3003600020', 'laura2@gmail.test', 'laura@policia.gov.co', null, null, null) $$,
  'P0001', 'Solo se corrigen solicitudes pendientes o contactadas', 'una solicitud aprobada no se corrige');
reset role;

-- El secretario no corrige datos.
set local role authenticated;
set local request.jwt.claims = '{"sub":"36000000-0000-4000-a000-0000000000ae","role":"authenticated"}';
select throws_ok($$ select pg_temp.editar('36000000-aaaa-4000-a000-000000000001', 'Secretario', '3600000010', 'pedro@gmail.test', 'pedro@policia.gov.co') $$,
  'P0001', 'Solo un administrador puede corregir los datos de una solicitud', 'el secretario no corrige datos');
reset role;

select ok(not has_function_privilege('anon',
  'public.admin_editar_afiliacion(uuid, text, text, text, public.institucion_afiliacion, text, text, text, text, text, text, public.tipo_cuenta_nomina, text)', 'execute'),
  'anon no ejecuta la RPC');
select is((select estado::text from public.solicitudes_afiliacion where id = '36000000-aaaa-4000-a000-000000000001'), 'pendiente',
  'corregir datos no cambia el estado');

select * from finish();
rollback;
