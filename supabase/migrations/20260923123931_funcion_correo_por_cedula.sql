-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgo H-12 (medio, preventivo): el login de la spec (sección 1)
-- necesita pasar de cédula a correo, pero perfiles no tiene correo (vive
-- en auth.users) y RLS no deja a anon leer perfiles (correcto).
-- Riesgo a evitar: resolverlo con una política anon sobre perfiles o
-- copiando el correo a una columna legible, lo que permitiría enumerar
-- cédulas y correos de más de 200 policías.
--
-- Corrección: función que SOLO puede ejecutar service_role (la Server
-- Action del login). No se expone a anon ni a authenticated.
-- El servidor siempre responde el mensaje fijo «Si tu cédula está
-- registrada, te enviamos un código», exista o no.
-- ============================================================

create or replace function public.correo_por_cedula(p_cedula text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.cedula = btrim(p_cedula)
    and p_cedula ~ '^\s*[0-9]{6,10}\s*$'
  limit 1;
$$;

revoke all on function public.correo_por_cedula(text) from public, anon, authenticated;
grant execute on function public.correo_por_cedula(text) to service_role;

comment on function public.correo_por_cedula(text) is
  'Devuelve el correo de Auth asociado a una cédula. Solo service_role (login por OTP). No exponer a anon/authenticated.';
