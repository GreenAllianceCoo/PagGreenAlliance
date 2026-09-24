-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Auditoría fase 2, hallazgo F2-03 (MEDIA).
-- PROPUESTA: NO APLICADA. Va después de 20260924000300_funciones_asesor.sql.
--
-- Problema: resumen_clientes_asesor() solo filtra por asesor_id = auth.uid().
-- La garantía de "quien no sea asesor recibe 0 filas" depende de los
-- triggers validar_*_asesor_id, que solo se disparan cuando cambia la fila
-- del CLIENTE. Si el admin le quita el rol a un asesor (rol 'asesor' →
-- 'asociado'), sus clientes siguen con asesor_id apuntándole y él sigue
-- viendo nombre, cédula, grado y estados de todos ellos:
--   -- ex asesor, ya con rol 'asociado', con su sesión:
--   select * from public.resumen_clientes_asesor();   -- devuelve sus ex clientes
--
-- Corrección: la función exige además que quien llama tenga HOY rol asesor.
-- Mismo resultado y mismos privilegios que la versión de 20260924000300.
-- Idempotente: create or replace.
-- ============================================================

create or replace function public.resumen_clientes_asesor()
returns table (
  origen           text,
  perfil_id        uuid,
  solicitud_id     uuid,
  nombre           text,
  cedula           text,
  grado            public.grado_policial,
  estado_afiliacion    public.estado_afiliacion,
  estado_credito       public.estado_solicitud
)
language sql
stable
security definer
set search_path = ''
as $$
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
    and (select public.es_asesor((select auth.uid())))   -- NUEVO: solo si hoy es asesor

  union all

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
  where a.asesor_id = (select auth.uid())
    and (select public.es_asesor((select auth.uid())));  -- NUEVO
$$;
revoke all on function public.resumen_clientes_asesor() from public, anon;
grant execute on function public.resumen_clientes_asesor() to authenticated;
comment on function public.resumen_clientes_asesor() is
  'Resumen de "mis clientes" para un asesor: nombre, cédula, grado, estado de afiliación y de crédito. Nunca celular, correo, nequi ni fotos. Solo devuelve filas si quien llama tiene HOY rol asesor.';
