-- ============================================================
-- Green Alliance · pgTAP · RLS habilitado y privilegios
-- Se corre con: supabase test db  (solo contra la base LOCAL)
-- Todo ocurre dentro de una transacción que se revierte al final.
-- ============================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Las 5 tablas del esquema existen
select has_table('public', 'perfiles', 'existe la tabla perfiles');
select has_table('public', 'grados_credito', 'existe la tabla grados_credito');
select has_table('public', 'solicitudes_credito', 'existe la tabla solicitudes_credito');
select has_table('public', 'convenios', 'existe la tabla convenios');
select has_table('public', 'solicitudes_afiliacion', 'existe la tabla solicitudes_afiliacion');

-- RLS habilitado en TODAS las tablas de public (incluidas las que se agreguen después)
select is_empty(
  $$ select c.relname::text
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'todas las tablas de public tienen RLS habilitado'
);

-- TRUNCATE no pasa por RLS: anon y authenticated no deben tenerlo
select is_empty(
  $$ select table_name::text || ':' || grantee::text
       from information_schema.role_table_grants
      where table_schema = 'public' and privilege_type = 'TRUNCATE'
        and grantee in ('anon', 'authenticated') $$,
  'anon y authenticated no tienen TRUNCATE en ninguna tabla de public'
);

-- anon no escribe en ninguna tabla
select is_empty(
  $$ select table_name::text || ':' || privilege_type::text
       from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE') $$,
  'anon no tiene INSERT, UPDATE ni DELETE en ninguna tabla de public'
);

-- Funciones security definer con search_path fijo
select is_empty(
  $$ select p.proname::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'todas las funciones security definer de public fijan search_path'
);

-- correo_por_cedula: solo service_role
select ok(
  not has_function_privilege('anon', 'public.correo_por_cedula(text)', 'execute'),
  'anon no puede ejecutar correo_por_cedula'
);
select ok(
  not has_function_privilege('authenticated', 'public.correo_por_cedula(text)', 'execute'),
  'authenticated no puede ejecutar correo_por_cedula'
);
select ok(
  has_function_privilege('service_role', 'public.correo_por_cedula(text)', 'execute'),
  'service_role sí puede ejecutar correo_por_cedula'
);

select ok(
  not has_function_privilege('anon', 'public.es_admin()', 'execute'),
  'anon no puede ejecutar es_admin'
);

-- Las funciones de trigger no se pueden llamar por RPC desde la API.
-- Excepciones a propósito:
--   es_admin(): cualquier authenticated puede saber si ES admin (no revela nada de otros).
--   resumen_clientes_asesor(): se autofiltra por auth.uid(); un asesor solo ve
--     lo suyo, cualquier otro rol recibe 0 filas (ver 07_asesor_rls.sql).
--   mi_boleta_sorteo(): se autofiltra por auth.uid() (la boleta propia); el
--     número solo sale si ya está confirmada (F2-01, 20260924000600).
--   boletas_confirmadas_sorteo(): se autofiltra por es_admin(); quien no sea
--     admin recibe 0 filas (F2-01, 20260924000600).
select is_empty(
  $$ select p.proname::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and p.proname not in ('es_admin', 'resumen_clientes_asesor', 'mi_boleta_sorteo', 'boletas_confirmadas_sorteo',
                              -- Se validan solas (es_admin() o puede_atender() / auth.uid() dentro):
                              'agregar_nota_solicitud',
                              'admin_actualizar_proceso_ejecutivo', 'crear_alerta_asociado', 'admin_marcar_alerta_atendida',
                              'mi_proceso_ejecutivo', 'revelar_acumulado_comision', 'comisiones_periodo_asesor',
                              'buscar_cliente_asesor', 'admin_editar_pago_comision', 'admin_anular_pago_comision',
                              'tabla_credito_con_tasa', 'admin_tasas_solicitudes',
                              'admin_marcar_desembolsado', 'admin_cambiar_estado_asociado', 'bonos_acumulados_asesor',
                              'admin_realizar_sorteo', 'ganador_sorteo_vigente',
                              'admin_metricas_dashboard', 'asesor_metricas_dashboard',
                              'admin_habilitar_credito', 'mi_habilitacion_credito',
                              'mis_premios_asesor', 'registrar_clic_premios', 'admin_premios_asesores', 'mi_carne_token', 'regenerar_carne_token', 'verificar_carne', 'admin_inscritos_sorteo',
                              'admin_registrar_cambio_correo', 'admin_rechazar_recuperacion', 'admin_validar_cambio_correo')
        and (has_function_privilege('authenticated', p.oid, 'execute')
             or has_function_privilege('anon', p.oid, 'execute')) $$,
  'ninguna función security definer fuera de la lista blanca (las que se validan solas) es ejecutable por anon o authenticated'
);

select * from finish();
rollback;
