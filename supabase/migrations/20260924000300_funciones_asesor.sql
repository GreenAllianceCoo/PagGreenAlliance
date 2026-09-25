-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Fase 2 · PARTE 1. NO APLICADA en producción.
-- Dos funciones para el rol asesor:
--
-- 1. obtener_asesores_publico(): lista (id, nombre) de los asesores, para el
--    desplegable del formulario público de afiliación. Se lee SOLO desde el
--    servidor con service role (mismo patrón que correo_por_cedula): no se
--    expone a anon ni a authenticated, porque el formulario de afiliación
--    no tiene sesión.
--
-- 2. resumen_clientes_asesor(): lo que puede ver un asesor de "sus clientes":
--    nombre, cédula, grado, estado de la afiliación y de la última solicitud
--    de crédito. NUNCA celular, correo, nequi ni fotos. SECURITY DEFINER
--    porque Postgres RLS es por fila, no por columna: la única forma de
--    ocultar columnas es que la función solo seleccione esas columnas.
--    Se autofiltra por auth.uid(): un asesor solo ve lo que tiene asesor_id
--    = su propio id; cualquier otro rol que la llame recibe 0 filas (nada
--    tiene asesor_id apuntando a un id que no sea de rol asesor, por el
--    trigger validar_perfil_asesor_id / validar_afiliacion_asesor_id).
-- Idempotente: create or replace.
-- ============================================================

create or replace function public.obtener_asesores_publico()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_completo
  from public.perfiles p
  where p.rol = 'asesor'::public.rol_usuario
  order by p.nombre_completo;
$$;
revoke all on function public.obtener_asesores_publico() from public, anon, authenticated;
grant execute on function public.obtener_asesores_publico() to service_role;
comment on function public.obtener_asesores_publico() is
  'Id y nombre de los asesores activos, para el desplegable público de /afiliacion. Solo service_role (sin sesión en ese formulario).';

create or replace function public.resumen_clientes_asesor()
returns table (
  origen           text,             -- 'asociado' | 'solicitud_afiliacion'
  perfil_id        uuid,             -- solo si origen = 'asociado'
  solicitud_id     uuid,             -- solo si origen = 'solicitud_afiliacion'
  nombre           text,
  cedula           text,
  grado            public.grado_policial,
  estado_afiliacion    public.estado_afiliacion,   -- null si ya es asociado (no aplica)
  estado_credito       public.estado_solicitud     -- null si no ha pedido crédito o aún no es asociado
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Asociados con este asesor asignado: su última solicitud de crédito (si tiene).
  select
    'asociado'::text as origen,
    p.id as perfil_id,
    null::uuid as solicitud_id,
    p.nombre_completo as nombre,
    p.cedula,
    p.grado,
    null::public.estado_afiliacion as estado_afiliacion,
    ultima.estado as estado_credito
  from public.perfiles p
  left join lateral (
    select s.estado
    from public.solicitudes_credito s
    where s.asociado_id = p.id
    order by s.fecha_solicitud desc
    limit 1
  ) ultima on true
  where p.asesor_id = (select auth.uid())

  union all

  -- Solicitudes de afiliación referidas por este asesor (aún no son asociados).
  select
    'solicitud_afiliacion'::text as origen,
    null::uuid as perfil_id,
    a.id as solicitud_id,
    a.nombre,
    a.cedula,
    a.grado,
    a.estado as estado_afiliacion,
    null::public.estado_solicitud as estado_credito
  from public.solicitudes_afiliacion a
  where a.asesor_id = (select auth.uid());
$$;
revoke all on function public.resumen_clientes_asesor() from public, anon;
grant execute on function public.resumen_clientes_asesor() to authenticated;
comment on function public.resumen_clientes_asesor() is
  'Resumen de "mis clientes" para un asesor: nombre, cédula, grado, estado de afiliación y de crédito. Nunca celular, correo, nequi ni fotos. Autofiltrado por auth.uid(): quien no sea asesor recibe 0 filas.';
