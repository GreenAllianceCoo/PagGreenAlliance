-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgo H-01 (crítico): handle_new_user toma `grado` y `cedula` de
-- raw_user_meta_data, que el propio usuario controla al registrarse.
--
-- Escenario: con la anon key pública cualquiera puede llamar
--   POST /auth/v1/signup  { email, password, data: { grado: 'OF', cedula: '<cédula ajena>' } }
-- y el trigger crea su perfil con grado OF (tope 4.200.000) o se "adueña"
-- de la cédula de un policía que aún no tiene cuenta (el login por cédula
-- le mandaría luego el código al correo del atacante).
--
-- Corrección: la cédula y el grado solo se leen de raw_app_meta_data, que
-- solo puede escribir el servidor con service role
-- (auth.admin.createUser({ app_metadata: { cedula, grado } })).
-- Nombre y teléfono pueden seguir viniendo de user_metadata (no dan poder).
-- Un grado inválido ya no rompe el registro: queda en null y el admin lo asigna.
--
-- Complementa (no reemplaza) desactivar "Allow new users to sign up" en
-- Supabase > Authentication > Sign In / Providers, porque el login será
-- con shouldCreateUser: false y las cuentas las crea la cooperativa.
-- Idempotente: create or replace.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := nullif(btrim(new.raw_app_meta_data ->> 'cedula'), '');
  v_grado  text := nullif(btrim(new.raw_app_meta_data ->> 'grado'), '');
begin
  -- Solo se acepta una cédula de 6 a 10 dígitos; si no, queda como PENDIENTE-xxxx.
  if v_cedula is null or v_cedula !~ '^[0-9]{6,10}$' then
    v_cedula := 'PENDIENTE-' || left(new.id::text, 8);
  end if;

  -- Solo se acepta un valor válido del enum; si no, grado null.
  if v_grado is not null
     and v_grado <> all (enum_range(null::public.grado_policial)::text[]) then
    v_grado := null;
  end if;

  insert into public.perfiles (id, cedula, nombre_completo, telefono, grado)
  values (
    new.id,
    v_cedula,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre_completo'), ''), 'Sin nombre'),
    nullif(btrim(new.raw_user_meta_data ->> 'telefono'), ''),
    v_grado::public.grado_policial
  )
  on conflict (id) do nothing;
  -- El rol nunca se toma de metadatos: siempre queda el default 'asociado'.
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

comment on function public.handle_new_user() is
  'Crea el perfil al registrarse un usuario. Cédula y grado solo desde raw_app_meta_data (servidor); rol siempre asociado.';
