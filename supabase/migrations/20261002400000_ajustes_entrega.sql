-- ============================================================
-- Ajustes de entrega (2026-10-01). PROPUESTA: NO APLICADA en producción.
--
--  1. registrar_clic_premios: el tope de 1 por minuto pasa a ser POR ASESOR Y META
--     (la apertura automática de la sección, sin meta, ya no se come el toque en 50 o 100).
--  2. admin_premios_asesores: separa aperturas (sin meta) y toques por meta (50 y 100).
--     `clics` sigue siendo el total de registros (compatibilidad).
--  3. verificar_carne (S-01): un asociado dado de baja ya no se puede verificar en público
--     (cero filas = «Carné no válido»): no se siguen mostrando sus datos (Ley 1581).
--  4. regenerar_carne_token (S-02): máx. 1 regeneración por minuto (si no, devuelve null).
--  5. admin_inscritos_sorteo: el grado sale con su nombre, no con el código.
-- Idempotente.
-- ============================================================

-- 1. Tope por asesor y meta
create or replace function public.registrar_clic_premios(p_meta integer default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.puede_atender(v_uid) then
    return false;
  end if;
  if p_meta is not null and p_meta not in (50, 100) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('premios_clic:' || v_uid::text));
  if exists (select 1 from public.premios_asesores_clics c
              where c.asesor_id = v_uid
                and c.meta is not distinct from p_meta
                and c.created_at > now() - interval '1 minute') then
    return false;   -- máx. 1 registro por minuto por asesor y por meta
  end if;
  insert into public.premios_asesores_clics (asesor_id, meta) values (v_uid, p_meta);
  return true;
end;
$$;
revoke all on function public.registrar_clic_premios(integer) from public, anon;
grant execute on function public.registrar_clic_premios(integer) to authenticated;
comment on function public.registrar_clic_premios(integer) is
  'Registra que el asesor en sesión abrió (meta null) o tocó «Premios» (meta 50/100). Máx. 1 por minuto por asesor y meta; devuelve true si lo registró.';

-- 2. Admin: aperturas y toques por meta
drop function if exists public.admin_premios_asesores();
create function public.admin_premios_asesores()
returns table (
  asesor_id           uuid,
  clientes_acumulados integer,
  clics               integer,
  ultimo_clic         timestamptz,
  gano_50_at          timestamptz,
  gano_100_at         timestamptz,
  aperturas           integer,
  toques_50           integer,
  toques_100          integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.es_admin()) then
    return;
  end if;
  return query
    select p.id,
           public.conteo_acumulado_asesor_interno(p.id),
           (select count(*)::int from public.premios_asesores_clics c where c.asesor_id = p.id),
           (select max(c.created_at) from public.premios_asesores_clics c where c.asesor_id = p.id),
           (select g.alcanzado_at from public.premios_asesores_ganadores g where g.meta = 50 and g.asesor_id = p.id),
           (select g.alcanzado_at from public.premios_asesores_ganadores g where g.meta = 100 and g.asesor_id = p.id),
           (select count(*)::int from public.premios_asesores_clics c where c.asesor_id = p.id and c.meta is null),
           (select count(*)::int from public.premios_asesores_clics c where c.asesor_id = p.id and c.meta = 50),
           (select count(*)::int from public.premios_asesores_clics c where c.asesor_id = p.id and c.meta = 100)
    from public.perfiles p
    where p.rol in ('asesor'::public.rol_usuario, 'admin'::public.rol_usuario)
      and (public.puede_atender(p.id)
           or exists (select 1 from public.premios_asesores_clics c where c.asesor_id = p.id)
           or exists (select 1 from public.premios_asesores_ganadores g where g.asesor_id = p.id));
end;
$$;
revoke all on function public.admin_premios_asesores() from public, anon;
grant execute on function public.admin_premios_asesores() to authenticated;
comment on function public.admin_premios_asesores() is
  'Solo admin: por asesor, asociados acumulados, registros totales, aperturas (sin meta), toques en 50 y en 100, y fecha en que ganó cada meta. 0 filas si no es admin.';

-- 3. Verificación pública: solo asociados activos
create or replace function public.verificar_carne(p_token uuid)
returns table (nombre text, grado text, institucion text, activo boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.nombre_completo::text,
    coalesce(g.nombre, 'Sin asignar')::text,
    case p.institucion::text
      when 'policia'  then 'Policía Nacional'
      when 'ejercito' then 'Ejército Nacional'
      else null
    end,
    p.activo
  from public.carne_tokens t
  join public.perfiles p on p.id = t.asociado_id and p.rol = 'asociado' and p.activo
  left join public.grados g on g.codigo = p.grado
  where p_token is not null and t.token = p_token;
$$;
revoke all on function public.verificar_carne(uuid) from public, anon, authenticated;
grant execute on function public.verificar_carne(uuid) to anon, authenticated;

-- 4. Regenerar con tope de 1 por minuto
create or replace function public.regenerar_carne_token()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_token uuid;
begin
  if v_uid is null then
    return null;
  end if;
  if not exists (select 1 from public.perfiles p where p.id = v_uid and p.rol = 'asociado' and p.activo) then
    return null;
  end if;
  if exists (select 1 from public.carne_tokens t
              where t.asociado_id = v_uid and t.rotado_at > now() - interval '1 minute') then
    return null;   -- demasiado pronto
  end if;
  insert into public.carne_tokens (asociado_id) values (v_uid)
    on conflict (asociado_id) do update
      set token = gen_random_uuid(), rotado_at = now()
    returning token into v_token;
  return v_token;
end;
$$;
revoke all on function public.regenerar_carne_token() from public, anon, authenticated;
grant execute on function public.regenerar_carne_token() to authenticated;

-- 5. Inscritos del sorteo: grado con nombre
create or replace function public.admin_inscritos_sorteo(p_anio smallint, p_mes smallint)
returns table (nombre_completo text, grado text, cedula_enmascarada text, estado text, fecha_envio timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nombre_completo,
         coalesce(g.nombre, p.grado),
         repeat('•', greatest(length(p.cedula) - 3, 0)) || right(p.cedula, 3),
         b.estado::text,
         b.fecha_envio
  from public.boletas_sorteo b
  join public.perfiles p on p.id = b.asociado_id
  left join public.grados g on g.codigo = p.grado
  where (select public.es_admin())
    and b.anio = p_anio
    and b.mes = p_mes
  order by p.nombre_completo;
$$;
revoke all on function public.admin_inscritos_sorteo(smallint, smallint) from public, anon;
grant execute on function public.admin_inscritos_sorteo(smallint, smallint) to authenticated;
