-- ============================================================
-- Inscritos al sorteo en el panel del admin (decisión de la cooperativa: SÍ aparecen).
-- admin_inscritos_sorteo(anio, mes): nombre, grado, cédula ENMASCARADA y estado de la boleta.
-- Nunca devuelve el número de boleta. Quien no sea admin recibe 0 filas.
-- (La métrica `inscritos_sorteo_mes` de admin_metricas_dashboard ya existe; no se cambia.)
-- ============================================================
create or replace function public.admin_inscritos_sorteo(p_anio smallint, p_mes smallint)
returns table (nombre_completo text, grado text, cedula_enmascarada text, estado text, fecha_envio timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nombre_completo,
         p.grado,
         repeat('•', greatest(length(p.cedula) - 3, 0)) || right(p.cedula, 3),
         b.estado::text,
         b.fecha_envio
  from public.boletas_sorteo b
  join public.perfiles p on p.id = b.asociado_id
  where (select public.es_admin())
    and b.anio = p_anio
    and b.mes = p_mes
  order by p.nombre_completo;
$$;
revoke all on function public.admin_inscritos_sorteo(smallint, smallint) from public, anon;
grant execute on function public.admin_inscritos_sorteo(smallint, smallint) to authenticated;
comment on function public.admin_inscritos_sorteo(smallint, smallint) is
  'Solo admin: inscritos del mes (nombre, grado, cédula enmascarada, estado). Sin número de boleta.';
