-- ============================================================
-- Green Alliance · pgTAP · Porcentajes 50–100 del asociado, crédito creado
-- por el admin y «Cambiar cédula» (migración 20261102000000).
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('38000000-0000-4000-a000-0000000000ad', 'p.ad@prueba.test', '{"cedula":"3800000100"}', '{"nombre_completo":"Admin Treinta y ocho"}'),
  ('38000000-0000-4000-a000-0000000000ae', 'p.ae@prueba.test', '{"cedula":"3800000101"}', '{"nombre_completo":"Admin Que Atiende"}'),
  ('38000000-0000-4000-a000-00000000000a', 'p.a1@prueba.test', '{"cedula":"3800000001","grado":"PT"}', '{"nombre_completo":"Ana Porcentajes"}'),
  ('38000000-0000-4000-a000-00000000000b', 'p.a2@prueba.test', '{"cedula":"3800000002","grado":"PT"}', '{"nombre_completo":"Beto Cliente"}'),
  ('38000000-0000-4000-a000-00000000000c', 'p.a3@prueba.test', '{"cedula":"3800000003","grado":"PT"}', '{"nombre_completo":"Caro Inactiva"}'),
  ('38000000-0000-4000-a000-00000000000d', 'p.a4@prueba.test', '{"cedula":"3800000004","grado":"PT"}', '{"nombre_completo":"Dario Sin Proceso"}');
update public.perfiles set rol = 'admin' where id = '38000000-0000-4000-a000-0000000000ad';
update public.perfiles set rol = 'admin', atiende_asociados = true where id = '38000000-0000-4000-a000-0000000000ae';
update public.perfiles set asesor_id = '38000000-0000-4000-a000-0000000000ae' where id = '38000000-0000-4000-a000-00000000000b';
update public.perfiles set activo = false where id = '38000000-0000-4000-a000-00000000000c';
insert into public.procesos_ejecutivos (asociado_id, estado, fecha_inicio_embargo) values
  ('38000000-0000-4000-a000-00000000000a', 'operando', current_date),
  ('38000000-0000-4000-a000-00000000000b', 'operando', current_date),
  ('38000000-0000-4000-a000-00000000000c', 'operando', current_date);

-- Valores esperados a 70 %: línea recta entre las filas PT 50 % y PT 100 %.
create temp table esperado as
select round(c50.capacidad_maxima + (c100.capacidad_maxima - c50.capacidad_maxima) * 20 / 50.0) as cupo70,
       round(c50.tasa_interes_mensual + (c100.tasa_interes_mensual - c50.tasa_interes_mensual) * 20 / 50.0, 8) as tasa70,
       c50.plazo_meses as plazo50
  from public.grados_credito c50, public.grados_credito c100
 where c50.grado = 'PT' and c50.porcentaje = '50' and c100.grado = 'PT' and c100.porcentaje = '100';
grant select on esperado to authenticated;

create function pg_temp.crear(p_asociado uuid, p_monto numeric, p_motivo text default 'Acuerdo con gerencia')
returns uuid language sql as $$
  select public.admin_crear_credito(p_asociado, p_monto, p_monto + 900000, 6, 70, 'cooperativa', null, p_motivo);
$$;

-- ============================================================
-- A. El asociado elige 50, 60, 70, 80, 90 o 100
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-00000000000a","role":"authenticated"}';

select throws_ok($$ insert into public.solicitudes_credito (asociado_id, porcentaje_credito, monto_solicitado)
                    values ('38000000-0000-4000-a000-00000000000a', 65, 500000) $$,
  'P0001', 'El porcentaje debe ser 50, 60, 70, 80, 90 o 100', 'el asociado no elige 65 %');
select throws_ok($$ insert into public.solicitudes_credito (asociado_id, monto_solicitado)
                    values ('38000000-0000-4000-a000-00000000000a', 500000) $$,
  'P0001', 'El porcentaje debe ser 50, 60, 70, 80, 90 o 100', 'sin porcentaje no hay solicitud');
select throws_like(format('insert into public.solicitudes_credito (asociado_id, porcentaje_credito, monto_solicitado) values (%L, 70, %s)',
                          '38000000-0000-4000-a000-00000000000a', (select cupo70 + 1 from esperado)),
  '%supera el tope%', 'a 70 % el cupo es el interpolado');
-- Un GUC fijado por el cliente no sirve sin ser admin.
select set_config('ga.crear_credito_admin', 'si', true);
select throws_like(format('insert into public.solicitudes_credito (asociado_id, porcentaje_credito, monto_solicitado) values (%L, 70, %s)',
                          '38000000-0000-4000-a000-00000000000a', (select cupo70 + 1 from esperado)),
  '%supera el tope%', 'el GUC del admin no salta el cupo para un asociado');
select set_config('ga.crear_credito_admin', '', true);
select lives_ok(format('insert into public.solicitudes_credito (asociado_id, porcentaje_credito, monto_solicitado) values (%L, 70, %s)',
                       '38000000-0000-4000-a000-00000000000a', (select cupo70 from esperado)),
  'a 70 % se puede pedir hasta el cupo interpolado');
reset role;

select is(
  (select tasa_interes_mensual from public.solicitudes_credito
    where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'pendiente'),
  (select tasa70 from esperado), 'la tasa se interpola a 70 %');
select is(
  (select porcentaje_credito::text || '|' || porcentaje_devolucion::text || '|' || plazo_meses::text from public.solicitudes_credito
    where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'pendiente'),
  '70|50|' || (select plazo50 from esperado), 'porcentaje 70, paquete base 50 y plazo de la fila 50');
select throws_like($$ update public.grados_credito set capacidad_maxima = capacidad_maxima - 1 where grado = 'PT' and porcentaje = '100' $$,
  'No se puede bajar ni eliminar el tope de PT%', 'una pendiente de 70 % protege también la fila de 100 %');

-- (request.jwt.claims sigue siendo el de Ana: para rechazar, la sesión es del admin.)
set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
update public.solicitudes_credito set estado = 'rechazado', motivo_rechazo = 'Prueba'
 where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'pendiente';

-- Compatibilidad: el código viejo manda solo porcentaje_devolucion.
set local role authenticated;
set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select lives_ok($$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
                   values ('38000000-0000-4000-a000-00000000000a', '100', 100000) $$,
  'con solo porcentaje_devolucion se sigue pudiendo pedir');
select is((select porcentaje_credito::int from public.solicitudes_credito
            where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'pendiente'), 100,
  'porcentaje_devolucion 100 queda como porcentaje_credito 100');
reset role;
set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
update public.solicitudes_credito set estado = 'rechazado', motivo_rechazo = 'Prueba'
 where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'pendiente';

-- Beto queda con una pendiente (para probar que el admin no le crea otra).
insert into public.solicitudes_credito (asociado_id, porcentaje_credito, monto_solicitado) values
  ('38000000-0000-4000-a000-00000000000b', 50, 500000);

-- ============================================================
-- B. El admin crea un crédito ya aprobado
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok($$ select pg_temp.crear('38000000-0000-4000-a000-00000000000a', 500000) $$,
  'P0001', 'Solo un administrador puede crear un crédito', 'un asociado no crea créditos');

set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok($$ select pg_temp.crear('38000000-0000-4000-a000-0000000000ad', 500000) $$,
  'P0001', 'No puedes crearte un crédito a ti mismo; debe hacerlo otro administrador', 'nadie se crea un crédito');
select throws_ok($$ select pg_temp.crear('38000000-0000-4000-a000-00000000000c', 500000) $$,
  'P0001', 'El asociado está inactivo; no se le puede crear un crédito', 'no a un inactivo');
select throws_ok($$ select pg_temp.crear('38000000-0000-4000-a000-00000000000d', 500000) $$,
  'P0001', 'El proceso ejecutivo del asociado no está en «operando»', 'no sin proceso en «operando»');
select throws_ok($$ select pg_temp.crear('38000000-0000-4000-a000-00000000000b', 500000) $$,
  'P0001', 'El asociado ya tiene una solicitud de crédito pendiente; resuélvela primero', 'no si ya tiene una pendiente');
select throws_ok($$ select pg_temp.crear('38000000-0000-4000-a000-00000000000a', 500000, 'no') $$,
  'P0001', 'El motivo debe tener entre 5 y 300 caracteres', 'motivo obligatorio');
select throws_ok($$ select public.admin_crear_credito('38000000-0000-4000-a000-00000000000a', 500000, 600000, 6, 49, 'cooperativa', null, 'Acuerdo') $$,
  'P0001', 'El porcentaje debe ser un número entero entre 50 y 100', 'mismas validaciones que «Editar condiciones»');

-- Muy por encima del cupo: el admin puede.
select isnt(pg_temp.crear('38000000-0000-4000-a000-00000000000a', 90000000), null, 'crea el crédito y devuelve su id');
reset role;

select is(
  (select estado::text || '|' || revisado_por::text || '|' || (fecha_respuesta is not null)::text || '|' ||
          porcentaje_credito::text || '|' || total_a_pagar::text || '|' || condiciones_editadas_por::text
     from public.solicitudes_credito where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'aprobado'),
  'aprobado|38000000-0000-4000-a000-0000000000ad|true|70|90900000|38000000-0000-4000-a000-0000000000ad',
  'queda aprobado por el admin, con sus condiciones y marcado como decidido por un admin');
select is(
  (select tasa_interes_mensual from public.solicitudes_credito
    where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'aprobado'),
  (select tasa70 from esperado), 'la tasa del crédito del admin se interpola');
select is(
  (select array_agg(h.accion || ':' || h.actor_id::text order by h.created_at)
     from public.historial_solicitudes h
     join public.solicitudes_credito s on s.id = h.entidad_id
    where s.asociado_id = '38000000-0000-4000-a000-00000000000a' and s.estado = 'aprobado'),
  array['creada_por_admin:38000000-0000-4000-a000-0000000000ad', 'aprobado:38000000-0000-4000-a000-0000000000ad'],
  'el historial dice que lo creó y aprobó el admin (sin «creada» del asociado)');
select ok(
  (select h.detalle like '%Supera el cupo%Motivo: Acuerdo con gerencia'
     from public.historial_solicitudes h
     join public.solicitudes_credito s on s.id = h.entidad_id
    where s.asociado_id = '38000000-0000-4000-a000-00000000000a' and h.accion = 'creada_por_admin'),
  'el historial guarda que supera el cupo y el motivo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select lives_ok($$ select public.admin_marcar_desembolsado(
                     (select id from public.solicitudes_credito
                       where asociado_id = '38000000-0000-4000-a000-00000000000a' and estado = 'aprobado')) $$,
  'el crédito creado por el admin se puede marcar desembolsado');

-- ============================================================
-- C. Cambiar cédula
-- ============================================================
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-0000000000ad', '3800000099', 'Error de digitación') $$,
  'P0001', 'No puedes cambiar tu propia cédula; debe hacerlo otro administrador', 'la propia no por la RPC');
select throws_ok($$ update public.perfiles set cedula = '3800000099' where id = '38000000-0000-4000-a000-0000000000ad' $$,
  'P0001', 'No puedes cambiar tu propia cédula; debe hacerlo otro administrador', 'ni por UPDATE directo');
select throws_ok($$ update public.perfiles set cedula = '3800000099' where id = '38000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'La cédula de un asociado solo se cambia con «Cambiar cédula»', 'la de otro no por UPDATE directo');
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000a', '3800000002', 'Error de digitación') $$,
  'P0001', 'Esa cédula ya tiene cuenta u otra solicitud en curso', 'no una cédula de otra persona');
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000a', '3.800.000.001', 'Error de digitación') $$,
  'P0001', 'La cédula nueva es igual a la actual', 'debe ser distinta de la actual');
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000a', '12345', 'Error de digitación') $$,
  'P0001', 'La cédula debe tener solo números, entre 6 y 10 dígitos.', 'mismo formato que la app');
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000a', '3800000099', 'Antes era 3800000001') $$,
  'P0001', 'El motivo no debe incluir números de cédula', 'el motivo no guarda cédulas');

set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-0000000000ae","role":"authenticated"}';
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000b', '3800000099', 'Error de digitación') $$,
  'P0001', 'Es uno de tus clientes: otro administrador debe cambiar su cédula', 'no a un cliente suyo');

set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000b', '3800000099', 'Error de digitación') $$,
  'P0001', 'Solo un administrador puede cambiar la cédula de un asociado', 'un asociado no usa la RPC');
select set_config('ga.cambiar_cedula', 'si', true);
select throws_ok($$ update public.perfiles set cedula = '3800000099' where id = '38000000-0000-4000-a000-00000000000a' $$,
  'P0001', 'No puede modificar su número de cédula', 'el asociado no se cambia la cédula ni con el GUC');
select set_config('ga.cambiar_cedula', '', true);

set local request.jwt.claims = '{"sub":"38000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select lives_ok($$ select public.admin_cambiar_cedula('38000000-0000-4000-a000-00000000000a', ' 3.800.000-099 ', 'Error de digitación') $$,
  'el admin corrige la cédula (normalizada)');
reset role;

select is(
  (select p.cedula || '|' || (u.raw_app_meta_data ->> 'cedula') from public.perfiles p join auth.users u on u.id = p.id
    where p.id = '38000000-0000-4000-a000-00000000000a'),
  '3800000099|3800000099', 'cambia en el perfil y en app_metadata de Auth');
select is(public.correo_por_cedula('3800000099'), 'p.a1@prueba.test', 'la persona entra con la cédula nueva');
select is(
  (select campos::text || '|' || actor_id::text || '|' || motivo from public.historial_cambio_datos_perfil
    where perfil_id = '38000000-0000-4000-a000-00000000000a'),
  '{cedula}|38000000-0000-4000-a000-0000000000ad|Error de digitación', 'historial sin valores, con el motivo');

select * from finish();
rollback;
