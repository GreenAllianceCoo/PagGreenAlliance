-- ============================================================
-- Carné virtual con QR (pedido de Sebas, 2026-10-01).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
--   * public.carne_tokens: un token aleatorio (uuid v4) por asociado. RLS
--     habilitado SIN políticas y sin permisos para anon/authenticated: el
--     token no se puede listar ni leer con la API; solo se obtiene el propio
--     por la RPC mi_carne_token().
--   * mi_carne_token(): devuelve (y crea si falta) el token del asociado en sesión.
--   * regenerar_carne_token(): el asociado cambia su token (el QR anterior deja de valer).
--   * verificar_carne(p_token): RPC PÚBLICA (anon). Devuelve SOLO nombre,
--     grado (nombre legible), institución (texto legible) y activo.
--     Nunca cédula, celular, correo, montos ni tasa. Token inexistente o
--     de formato inválido = cero filas (respuesta idéntica, sin enumerar).
-- Idempotente. Funciones security definer con search_path = ''.
-- ============================================================

create table if not exists public.carne_tokens (
  asociado_id uuid primary key references public.perfiles (id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  rotado_at   timestamptz
);
comment on table public.carne_tokens is
  'Token no adivinable del QR del carné. Sin políticas: solo se accede por mi_carne_token(), regenerar_carne_token() y verificar_carne().';

alter table public.carne_tokens enable row level security;
revoke all on public.carne_tokens from anon, authenticated;

-- ------------------------------------------------------------
-- Token propio (se crea la primera vez)
-- ------------------------------------------------------------
create or replace function public.mi_carne_token()
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
  insert into public.carne_tokens (asociado_id) values (v_uid)
    on conflict (asociado_id) do nothing;
  select t.token into v_token from public.carne_tokens t where t.asociado_id = v_uid;
  return v_token;
end;
$$;

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
  insert into public.carne_tokens (asociado_id) values (v_uid)
    on conflict (asociado_id) do update
      set token = gen_random_uuid(), rotado_at = now()
    returning token into v_token;
  return v_token;
end;
$$;

-- ------------------------------------------------------------
-- Verificación pública: SOLO nombre, grado, institución, activo
-- ------------------------------------------------------------
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
  join public.perfiles p on p.id = t.asociado_id and p.rol = 'asociado'
  left join public.grados g on g.codigo = p.grado
  where p_token is not null and t.token = p_token;
$$;

revoke all on function public.mi_carne_token()         from public, anon, authenticated;
revoke all on function public.regenerar_carne_token()  from public, anon, authenticated;
revoke all on function public.verificar_carne(uuid)    from public, anon, authenticated;
grant execute on function public.mi_carne_token()        to authenticated;
grant execute on function public.regenerar_carne_token() to authenticated;
grant execute on function public.verificar_carne(uuid)   to anon, authenticated;
