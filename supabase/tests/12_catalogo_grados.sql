-- ============================================================
-- Green Alliance · pgTAP · Requerimientos de Ricardo · catálogo de grados
-- (20260929100100): 17 grados + OF heredado, filtro por institución,
-- grupo de crédito, crédito sin cupo, FK y alta de usuarios.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('12000000-0000-4000-a000-00000000000a', 'g.pt@prueba.test',  '{"cedula":"1200000001","grado":"PT"}', '{"nombre_completo":"Asociado PT"}'),
  ('12000000-0000-4000-a000-00000000000b', 'g.te@prueba.test',  '{"cedula":"1200000002","grado":"TE"}', '{"nombre_completo":"Asociado TE"}'),
  ('12000000-0000-4000-a000-00000000000c', 'g.ij@prueba.test',  '{"cedula":"1200000003","grado":"SP"}', '{"nombre_completo":"Asociado SP"}'),
  ('12000000-0000-4000-a000-00000000000d', 'g.of@prueba.test',  '{"cedula":"1200000004","grado":"OF"}', '{"nombre_completo":"Asociado OF heredado"}'),
  ('12000000-0000-4000-a000-0000000000ad', 'g.adm@prueba.test', '{"cedula":"1200000009"}',              '{"nombre_completo":"Admin Grados"}');
update public.perfiles set rol = 'admin' where id = '12000000-0000-4000-a000-0000000000ad';

-- 20260930100200: el crédito exige proceso ejecutivo en «operando» (spec §8).
insert into public.procesos_ejecutivos (asociado_id, estado)
select id, 'operando' from public.perfiles where id::text like '12000000-0000-4000-a000-%';

-- ------------------------------------------------------------
-- Catálogo
-- ------------------------------------------------------------
select is((select count(*)::int from public.grados where seleccionable), 17, 'hay 17 grados seleccionables (PP volvió el 8-oct)');
select is(  (select seleccionable::text || '|' || nombre from public.grados where codigo = 'PP'),  'true|Patrullero de Policía',  'PP (Patrullero de Policía) se ofrece de nuevo, aparte de Patrullero (PT)');

select is(
  (select array_agg(codigo order by orden) from public.grados where policia and seleccionable),
  array['PP','PT','SI','IT','IJ','ST','TE','CT','MY','TC'],
  'Policía ve PP, PT, SI, IT, IJ y ST–TC'
);

select is(
  (select array_agg(codigo order by orden) from public.grados where ejercito and seleccionable),
  array['SLP','C3','CS','CP','SS','SV','SP','ST','TE','CT','MY','TC'],
  'Ejército ve SLP (R-01), C3–SP y ST–TC'
);

select is(
  (select array_agg(codigo order by orden) from public.grados where grupo_credito = 'OF' and seleccionable),
  null::text[],
  'ningún grado seleccionable usa el grupo OF (§12.1)'
);

select is(
  (select array_agg(codigo order by orden) from public.grados where grupo_credito is null),
  null::text[],
  'ningún grado queda sin grupo de crédito (SP → IJ, §12.14)'
);

select is(
  (select seleccionable::text || '|' || grupo_credito::text from public.grados where codigo = 'OF'),
  'false|OF',
  'OF queda como grado heredado (no seleccionable) para no romper datos antiguos'
);

select is(
  (select grado from public.perfiles where id = '12000000-0000-4000-a000-00000000000b'),
  'TE',
  'handle_new_user acepta un grado del catálogo nuevo (TE)'
);

select throws_ok(
  $$ update public.perfiles set grado = 'XX' where id = '12000000-0000-4000-a000-00000000000a' $$,
  '23503', null,
  'perfiles.grado solo acepta códigos del catálogo (FK)'
);

-- ------------------------------------------------------------
-- anon lee el catálogo (el formulario público lo necesita)
-- ------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::int from public.grados), 18, 'anon puede leer el catálogo de grados');
select throws_ok(
  $$ insert into public.grados (codigo, nombre, policia, orden) values ('ZZ', 'Falso', true, 50) $$,
  '42501', null,
  'anon no puede crear grados'
);

-- ------------------------------------------------------------
-- Asociado: no cambia el catálogo ni su grado; crédito según su grupo
-- ------------------------------------------------------------
-- Ningún grado real queda sin cupo (§12.14); para probar ese camino se le
-- quita el grupo a SP solo dentro de esta transacción (rollback al final).
reset role;
update public.grados set grupo_credito = null where codigo = 'SP';

set local role authenticated;
set local request.jwt.claims = '{"sub":"12000000-0000-4000-a000-00000000000c","role":"authenticated"}';

with u as (update public.grados set grupo_credito = 'OF' where codigo = 'IJ' returning 1)
select is(count(*)::int, 0, 'un asociado no puede cambiar el grupo de crédito de un grado') from u;

select throws_ok(
  $$ update public.perfiles set grado = 'TE' where id = '12000000-0000-4000-a000-00000000000c' $$,
  'P0001', 'No puede modificar su propio grado; solicítelo a la administración',
  'un asociado no puede cambiarse a un grado con cupo'
);

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('12000000-0000-4000-a000-00000000000c', '50', 500000) $$,
  'P0001', 'Tu grado todavía no tiene cupo de crédito configurado; tu asesor te contactará',
  'un grado sin grupo de crédito no puede pedir crédito'
);

set local request.jwt.claims = '{"sub":"12000000-0000-4000-a000-00000000000b","role":"authenticated"}';

select throws_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('12000000-0000-4000-a000-00000000000b', '100', 5000001) $$,
  'P0001', null,
  'un TE no pasa el tope del grupo IJ (5.000.000 al 100 %, §12.1)'
);

select lives_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('12000000-0000-4000-a000-00000000000b', '100', 5000000) $$,
  'un TE pide hasta el tope del grupo IJ'
);

select is(
  (select grado::text || '|' || grado_asociado from public.solicitudes_credito
    where asociado_id = '12000000-0000-4000-a000-00000000000b'),
  'IJ|TE',
  'la solicitud guarda el grupo (IJ) y el grado real (TE)'
);

-- El OF heredado sigue pudiendo pedir con el tope OF.
set local request.jwt.claims = '{"sub":"12000000-0000-4000-a000-00000000000d","role":"authenticated"}';
select lives_ok(
  $$ insert into public.solicitudes_credito (asociado_id, porcentaje_devolucion, monto_solicitado)
     values ('12000000-0000-4000-a000-00000000000d', '50', 2150000) $$,
  'un perfil antiguo con grado OF sigue pidiendo crédito con el tope OF'
);

-- ------------------------------------------------------------
-- Admin: solo cambia el grupo de crédito
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"12000000-0000-4000-a000-0000000000ad","role":"authenticated"}';

with u as (update public.grados set grupo_credito = 'IT' where codigo = 'IJ' returning 1)
select is(count(*)::int, 1, 'el admin puede asignar el grupo de crédito de IJ') from u;

select throws_ok(
  $$ update public.grados set nombre = 'Otro nombre' where codigo = 'IJ' $$,
  '42501', null,
  'el admin no cambia el nombre de un grado (solo grupo_credito)'
);

-- ------------------------------------------------------------
-- Afiliación: grado del catálogo y seleccionable
-- ------------------------------------------------------------
reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values ('Oscar', 'Heredado', '1200000011', 'OF', 'policia', '3001000011', '3001000011',
       'oscar@correo.test', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()) $$,
  'P0001', 'El grado OF ya no se puede elegir; escoge tu grado exacto',
  'una afiliación nueva no puede usar el grado heredado OF'
);
select lives_ok(  $$ insert into public.solicitudes_afiliacion (       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at     ) values ('Pedro', 'Patrullero', '1200000013', 'PP', 'policia', '3001000013', '3001000013',       'pedro@correo.test', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()) $$,  'una afiliación nueva puede elegir Patrullero de Policía (PP) otra vez');

select lives_ok(
  $$ insert into public.solicitudes_afiliacion (
       nombres, apellidos, cedula, grado, institucion, celular, nequi, email,
       foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at
     ) values ('Sergio', 'Soldado', '1200000012', 'SLP', 'ejercito', '3001000012', '3001000012',
       'sergio@correo.test', 'x/f.jpg', 'x/r.jpg', 'x/s.jpg', now()) $$,
  'una afiliación acepta un grado nuevo del catálogo (SLP)'
);

select ok(
  pg_get_function_result('public.resumen_clientes_asesor()'::regprocedure) like '%grado text%',
  'resumen_clientes_asesor devuelve el código de grado como texto'
);

select * from finish();
rollback;
