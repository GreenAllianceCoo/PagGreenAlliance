-- ============================================================
-- Green Alliance · pgTAP · Respuestas de Ricardo, segunda tanda (spec §12):
--   20260930200000/200100 grupos IJ, CT, MY, TC y remapeo de grados (§12.1)
--   20260930200200 desembolso del crédito (§12.2)
--   20260930200300 dominio del correo institucional (§12.3)
--   20260930200400 dar de baja / reactivar asociado (§12.6)
--   20260930200500 bonos acumulados del asesor (§12.7)
--   20260930200600 sorteo realizado en la base y ganador visible (§12.10)
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('19000000-0000-4000-a000-0000000000e1', 'r2.as@prueba.test',  '{"cedula":"1900000010"}',              '{"nombre_completo":"Asesor R2"}'),
  ('19000000-0000-4000-a000-0000000000e2', 'r2.as2@prueba.test', '{"cedula":"1900000011"}',              '{"nombre_completo":"Asesor Dos"}'),
  ('19000000-0000-4000-a000-00000000000a', 'r2.a@prueba.test',   '{"cedula":"1900000001","grado":"PP"}', '{"nombre_completo":"Ana Operando"}'),
  ('19000000-0000-4000-a000-00000000000b', 'r2.b@prueba.test',   '{"cedula":"1900000002","grado":"PP"}', '{"nombre_completo":"Beto Pendiente"}'),
  ('19000000-0000-4000-a000-00000000000c', 'r2.c@prueba.test',   '{"cedula":"1900000003","grado":"PP"}', '{"nombre_completo":"Carla Baja"}'),
  ('19000000-0000-4000-a000-00000000000d', 'r2.d@prueba.test',   '{"cedula":"1900000004","grado":"PP"}', '{"nombre_completo":"Dario Retiro"}'),
  ('19000000-0000-4000-a000-0000000000ad', 'r2.adm@prueba.test', '{"cedula":"1900000009"}',              '{"nombre_completo":"Admin R2"}');
update public.perfiles set rol = 'asesor' where id in ('19000000-0000-4000-a000-0000000000e1', '19000000-0000-4000-a000-0000000000e2');
update public.perfiles set rol = 'admin'  where id = '19000000-0000-4000-a000-0000000000ad';
update public.perfiles set asesor_id = '19000000-0000-4000-a000-0000000000e1'
 where id in ('19000000-0000-4000-a000-00000000000a', '19000000-0000-4000-a000-00000000000c', '19000000-0000-4000-a000-00000000000d');
insert into public.procesos_ejecutivos (asociado_id, estado) values
  ('19000000-0000-4000-a000-00000000000a', 'operando'),
  ('19000000-0000-4000-a000-00000000000b', 'operando'),
  ('19000000-0000-4000-a000-00000000000c', 'operando'),
  ('19000000-0000-4000-a000-00000000000d', 'operando');
-- D: retiro anticipado ya atendido (no cuenta para bonos).
insert into public.alertas_asociado (asociado_id, tipo, estado, atendida_at) values
  ('19000000-0000-4000-a000-00000000000d', 'retiro_anticipado', 'atendida', now());
-- Crédito aprobado de A y pendiente de B.
insert into public.solicitudes_credito (id, asociado_id, porcentaje_devolucion, monto_solicitado) values
  ('19000000-0000-4000-c000-000000000001', '19000000-0000-4000-a000-00000000000a', '50', 500000),
  ('19000000-0000-4000-c000-000000000002', '19000000-0000-4000-a000-00000000000b', '50', 500000);
update public.solicitudes_credito set estado = 'aprobado' where id = '19000000-0000-4000-c000-000000000001';
-- Boletas confirmadas del mes pasado (A, C y D; C se dará de baja antes del sorteo).
insert into public.boletas_sorteo (asociado_id, anio, mes, numero, estado, fecha_confirmacion)
select x.id,
       extract(year  from (date_trunc('month', now() at time zone 'America/Bogota') - interval '1 month'))::smallint,
       extract(month from (date_trunc('month', now() at time zone 'America/Bogota') - interval '1 month'))::smallint,
       x.num, 'confirmada', now()
from (values ('19000000-0000-4000-a000-00000000000a'::uuid, '190001'),
             ('19000000-0000-4000-a000-00000000000c'::uuid, '190003'),
             ('19000000-0000-4000-a000-00000000000d'::uuid, '190004')) x(id, num);

-- ============================================================
-- §12.1 Grupos nuevos y remapeo
-- ============================================================
select is(
  (select enum_range(null::public.grado_policial)::text),
  '{PP,PT,SI,IT,IJ,CT,MY,TC,OF}',
  'el enum de grupos tiene IJ, CT, MY y TC antes de OF'
);
select is(
  (select string_agg(grado::text || porcentaje::text || '=' || capacidad_maxima::bigint, ' ' order by grado, porcentaje)
     from public.grados_credito where grado in ('IJ','CT','MY','TC')),
  'IJ50=2500000 IJ100=5000000 CT50=3500000 CT100=7000000 MY50=4500000 MY100=9000000 TC50=6000000 TC100=12000000',
  'cupos de los grupos nuevos (§12.1)'
);
select is(
  (select count(*)::int from public.grados_credito n
     join public.grados_credito o on o.grado = 'OF' and o.porcentaje = n.porcentaje
    where n.grado in ('IJ','CT','MY','TC') and n.tasa_interes_mensual = o.tasa_interes_mensual
      and n.total_credito = n.capacidad_maxima + n.plazo_meses * n.cuota_mensual),
  8,
  'R-10 (decidido por Sebas): los grupos nuevos usan la tasa de OF y la misma fórmula'
);
select is(
  (select string_agg(codigo || '=' || coalesce(grupo_credito::text, '-'), ' ' order by orden)
     from public.grados where seleccionable),
  'PP=PP PT=PT SI=SI IT=IT IJ=IJ SLP=PT C3=PT CS=PT CP=SI SS=IT SV=IJ SP=IJ ST=IT TE=IJ CT=CT MY=MY TC=TC',
  'remapeo de grados a grupos (§12.1)'
);

-- ============================================================
-- §12.2 Desembolso
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_marcar_desembolsado('19000000-0000-4000-c000-000000000001') $$,
  'P0001', 'Solo un administrador puede marcar desembolsos',
  'el asociado no marca su desembolso por RPC'
);
with u as (update public.solicitudes_credito set fecha_desembolso = current_date
            where id = '19000000-0000-4000-c000-000000000001' returning 1)
select is(count(*)::int, 0, 'el asociado no escribe fecha_desembolso directo (RLS)') from u;
select lives_ok(
  $$ select fecha_desembolso, desembolsado_por from public.solicitudes_credito $$,
  'el asociado lee fecha_desembolso'
);

set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_marcar_desembolsado('19000000-0000-4000-c000-000000000001', current_date + 5) $$,
  'P0001', 'La fecha de desembolso no puede ser futura',
  'no se desembolsa con fecha futura'
);
select throws_ok(
  $$ select public.admin_marcar_desembolsado('19000000-0000-4000-c000-000000000002') $$,
  'P0001', 'Solo un crédito aprobado se puede marcar como desembolsado',
  'una pendiente no se desembolsa'
);
select is(
  (select desembolsado_por from public.admin_marcar_desembolsado('19000000-0000-4000-c000-000000000001')),
  '19000000-0000-4000-a000-0000000000ad'::uuid,
  'el admin marca el desembolso (fecha por defecto: hoy) y queda quién lo hizo'
);
select is(
  (select fecha_desembolso from public.solicitudes_credito where id = '19000000-0000-4000-c000-000000000001'),
  (now() at time zone 'America/Bogota')::date,
  'la fecha por defecto es hoy en Colombia'
);
select throws_ok(
  $$ select public.admin_marcar_desembolsado('19000000-0000-4000-c000-000000000001') $$,
  'P0001', 'Este crédito ya fue marcado como desembolsado',
  'no se desembolsa dos veces'
);
select throws_ok(
  $$ update public.solicitudes_credito set fecha_desembolso = fecha_desembolso - 1
      where id = '19000000-0000-4000-c000-000000000001' $$,
  'P0001', 'Este crédito ya fue marcado como desembolsado',
  'ni el admin cambia la fecha por update directo'
);
select is(
  (select count(*)::int from public.historial_solicitudes
    where entidad_id = '19000000-0000-4000-c000-000000000001' and accion = 'desembolsado'),
  1,
  'el desembolso queda en el historial'
);

-- ============================================================
-- §12.3 Dominio del correo institucional (filas nuevas)
-- ============================================================
reset role;
set local request.jwt.claims = '';
create or replace function pg_temp.afiliar(p_cedula text, p_grado text, p_inst text, p_correo text)
returns void language sql as $f$
  insert into public.solicitudes_afiliacion (
    nombres, apellidos, cedula, grado, institucion, celular, nequi, email, correo_institucional,
    foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
  ) values ('Prueba', 'Dominio', p_cedula, p_grado, p_inst::public.institucion_afiliacion, '3001900000', '3001900000',
            'personal.' || p_cedula || '@correo.test', p_correo, 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now());
$f$;
select throws_ok($$ select pg_temp.afiliar('1900000101', 'PP', 'policia', 'yo@gmail.com') $$,
  'P0001', 'Usa tu correo institucional de la Policía (@policia.gov.co)', 'Policía rechaza gmail');
select throws_ok($$ select pg_temp.afiliar('1900000102', 'CS', 'ejercito', 'yo@policia.gov.co') $$,
  'P0001', 'Usa tu correo institucional del Ejército (@buzonejercito.mil.co o @ejercito.mil.co)',
  'Ejército rechaza el dominio de la Policía');
select throws_ok($$ select pg_temp.afiliar('1900000103', 'PP', 'policia', 'yo@x.policia.gov.co') $$,
  'P0001', 'Usa tu correo institucional de la Policía (@policia.gov.co)', 'sin comodines de subdominio');
select lives_ok($$ select pg_temp.afiliar('1900000104', 'PP', 'policia', 'yo@correo.policia.gov.co') $$,
  'Policía acepta correo.policia.gov.co');
select lives_ok($$ select pg_temp.afiliar('1900000105', 'CS', 'ejercito', 'yo@buzonejercito.mil.co') $$,
  'Ejército acepta buzonejercito.mil.co');
select lives_ok($$ select pg_temp.afiliar('1900000106', 'CS', 'ejercito', 'yo2@ejercito.mil.co') $$,
  'Ejército acepta ejercito.mil.co');

-- ============================================================
-- §12.6 Dar de baja
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_cambiar_estado_asociado('19000000-0000-4000-a000-00000000000c', false, 'Se retiró') $$,
  'P0001', 'Solo un administrador puede cambiar el estado de un asociado',
  'un asociado no da de baja a otro'
);

set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok(
  $$ update public.perfiles set activo = false where id = '19000000-0000-4000-a000-00000000000c' $$,
  'P0001', 'El estado del asociado solo se cambia con «Dar de baja» o «Reactivar», con un motivo',
  'ni el admin cambia activo por update directo'
);
select throws_ok(
  $$ select public.admin_cambiar_estado_asociado('19000000-0000-4000-a000-00000000000c', false, '  no ') $$,
  'P0001', 'El motivo debe tener entre 5 y 300 caracteres',
  'motivo obligatorio (5–300)'
);
select throws_ok(
  $$ select public.admin_cambiar_estado_asociado('19000000-0000-4000-a000-0000000000ad', false, 'Me voy de vacaciones') $$,
  'P0001', 'No puedes cambiar tu propio estado; debe hacerlo otro administrador',
  'un admin no se da de baja a sí mismo'
);
select is(
  (select activo from public.admin_cambiar_estado_asociado('19000000-0000-4000-a000-00000000000c', false, 'Se retiró de la cooperativa')),
  false,
  'el admin da de baja con motivo'
);
select throws_ok(
  $$ select public.admin_cambiar_estado_asociado('19000000-0000-4000-a000-00000000000c', false, 'Otra vez de baja') $$,
  'P0001', 'El asociado ya está dado de baja',
  'no se da de baja dos veces'
);
select is(
  (select motivo || '|' || activo_anterior || '|' || activo_nuevo from public.historial_estado_asociado
    where asociado_id = '19000000-0000-4000-a000-00000000000c'),
  'Se retiró de la cooperativa|true|false',
  'la baja queda en el historial'
);

reset role;
set local request.jwt.claims = '';
select throws_ok(
  $$ update public.historial_estado_asociado set motivo = 'cambiado' $$,
  'P0001', 'El historial de estado del asociado no se puede modificar ni borrar',
  'el historial es inmutable'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-00000000000c","role":"authenticated"}';
select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('19000000-0000-4000-a000-00000000000c', '50', 500000) $$,
  'P0001', 'Tu cuenta está inactiva. Comunícate con la cooperativa.',
  'un inactivo no pide crédito'
);
select throws_ok(
  $$ select public.crear_alerta_asociado('retiro_anticipado') $$,
  'P0001', 'Tu cuenta está inactiva. Comunícate con la cooperativa.',
  'un inactivo no crea alertas'
);
select is_empty($$ select * from public.mi_proceso_ejecutivo() $$, 'mi_proceso_ejecutivo no devuelve nada a un inactivo');
select is_empty($$ select * from public.historial_estado_asociado $$, 'el asociado no lee el historial de estado');

-- ============================================================
-- §12.7 Bonos acumulados
-- ============================================================
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-0000000000e1","role":"authenticated"}';
select is(
  (select clientes_acumulados from public.bonos_acumulados_asesor()),
  1,
  'bonos: cuenta a A; excluye a C (dado de baja) y a D (retiro anticipado atendido)'
);
select is(
  (select alcanzo_bono_50::text || '|' || alcanzo_viaje_100::text from public.bonos_acumulados_asesor()),
  'false|false',
  'metas de 50 y 100 no alcanzadas'
);
select is(
  (select total_operando_hoy from public.comisiones_periodo_asesor()),
  2,
  'operando hoy excluye al dado de baja (A y D)'
);
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-0000000000e2","role":"authenticated"}';
select is_empty(
  $$ select * from public.bonos_acumulados_asesor('19000000-0000-4000-a000-0000000000e1') $$,
  'un asesor no ve los bonos de otro'
);
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select is(
  (select clientes_acumulados from public.bonos_acumulados_asesor('19000000-0000-4000-a000-0000000000e1')),
  1,
  'el admin ve los bonos de un asesor'
);

-- ============================================================
-- §12.10 Sorteo
-- ============================================================
set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_realizar_sorteo((date_trunc('month', now()) - interval '1 month')::date) $$,
  'P0001', 'Solo un administrador puede realizar el sorteo',
  'un asociado no realiza el sorteo'
);

set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-0000000000ad","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_realizar_sorteo((date_trunc('month', now() at time zone 'America/Bogota') + interval '2 months')::date) $$,
  'P0001', 'No se puede sortear un mes que no ha empezado',
  'no se sortea un mes futuro'
);
select throws_ok(
  $$ select public.admin_realizar_sorteo('2025-01-01') $$,
  'P0001', 'No hay participantes confirmados para el sorteo de ese mes',
  'sin participantes no hay sorteo'
);
select is(
  (select participantes from public.admin_realizar_sorteo(
     (date_trunc('month', now() at time zone 'America/Bogota') - interval '1 month')::date + 14)),
  2,
  'el admin realiza el sorteo; participan solo los activos (A y D, no C)'
);
select ok(
  (select asociado_id in ('19000000-0000-4000-a000-00000000000a', '19000000-0000-4000-a000-00000000000d')
     from public.sorteos_mensuales),
  'el ganador es un participante activo'
);
select throws_ok(
  $$ select public.admin_realizar_sorteo((date_trunc('month', now() at time zone 'America/Bogota') - interval '1 month')::date) $$,
  'P0001', 'El sorteo de ese mes ya se realizó',
  'el sorteo no se repite'
);

set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-00000000000b","role":"authenticated"}';
select is(
  (select grado || '|' || (nombre in ('Ana Operando', 'Dario Retiro'))::text from public.ganador_sorteo_vigente()),
  'Patrullero de Policía|true',
  'cualquier asociado activo ve grado y nombre del ganador'
);
select is(
  pg_get_function_result('public.ganador_sorteo_vigente()'::regprocedure),
  'TABLE(mes date, grado text, nombre text)',
  'el ganador expone solo mes, grado y nombre (sin cédula ni boleta)'
);
select is_empty($$ select * from public.sorteos_mensuales $$, 'el asociado no lee la tabla del sorteo (cédula, boleta)');

set local request.jwt.claims = '{"sub":"19000000-0000-4000-a000-00000000000c","role":"authenticated"}';
select is_empty($$ select * from public.ganador_sorteo_vigente() $$, 'un inactivo no ve el ganador');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select * from public.ganador_sorteo_vigente() $$, '42501', null, 'anon no ve el ganador');

select * from finish();
rollback;
