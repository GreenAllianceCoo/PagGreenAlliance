-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §2.9, §6).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Requiere antes: 20260925200100_perfiles_institucion_y_activo.sql (columna
-- perfiles.activo), que también es propuesta. Van en la misma tanda.
--
-- Qué hace:
--  1. perfiles.atiende_asociados (boolean, por defecto false): un ADMIN con
--     este interruptor también atiende asociados (caso Ricardo Varón, que
--     sigue siendo admin y además aparece como asesor). Para el rol
--     'asesor' el interruptor no cuenta: un asesor siempre atiende.
--     La protege proteger_campos_perfil (migración 20260929100200): solo el
--     admin la cambia.
--  2. public.puede_atender(uuid): la regla única de «¿este perfil puede
--     tener clientes?» = rol asesor, o rol admin con atiende_asociados; en
--     ambos casos con activo = true. La usan los triggers de asesor_id, el
--     desplegable del formulario y las funciones del panel del asesor.
--     Sigue siendo el blindaje F2-03: mira el rol ACTUAL de la persona, no
--     solo el asesor_id guardado en el cliente.
--  3. validar_perfil_asesor_id / validar_afiliacion_asesor_id aceptan
--     cualquier perfil que puede_atender (antes: solo rol asesor). El mensaje
--     de error no cambia (la app y las pruebas lo buscan tal cual).
--  4. obtener_asesores_publico(): lista a quien puede_atender (id y nombre).
--     Sigue siendo solo para service_role (el formulario /afiliacion no tiene
--     sesión; el servidor la llama y pasa id + nombre al desplegable).
-- Idempotente: add column if not exists + create or replace.
-- ============================================================

alter table public.perfiles
  add column if not exists atiende_asociados boolean not null default false;

comment on column public.perfiles.atiende_asociados is
  'Solo aplica a admins: true = además de administrar, atiende asociados (aparece en el desplegable de asesores y puede tener clientes). Un rol asesor siempre atiende. Solo lo cambia el admin.';

-- ------------------------------------------------------------
-- 2. puede_atender(): la regla en un solo sitio
-- ------------------------------------------------------------
create or replace function public.puede_atender(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = p_id
      and p.activo
      and (
        p.rol = 'asesor'::public.rol_usuario
        or (p.rol = 'admin'::public.rol_usuario and p.atiende_asociados)
      )
  );
$$;
revoke all on function public.puede_atender(uuid) from public, anon, authenticated;
comment on function public.puede_atender(uuid) is
  'true si el perfil puede tener clientes: rol asesor, o admin con atiende_asociados; y activo. Interna (triggers y funciones del asesor); no se expone por la API.';

-- ------------------------------------------------------------
-- 3. Triggers de asesor_id: aceptan asesor o admin que atiende
-- ------------------------------------------------------------
create or replace function public.validar_perfil_asesor_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asesor_id is not null then
    if new.asesor_id = new.id then
      raise exception 'Un perfil no puede ser su propio asesor';
    end if;
    if not public.puede_atender(new.asesor_id) then
      -- Mismo texto de antes: la app (asignarAsesor) busca «rol asesor».
      raise exception 'asesor_id debe ser un perfil con rol asesor';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validar_perfil_asesor_id() from public, anon, authenticated;

create or replace function public.validar_afiliacion_asesor_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asesor_id is not null and not public.puede_atender(new.asesor_id) then
    raise exception 'asesor_id debe ser un perfil con rol asesor';
  end if;
  return new;
end;
$$;
revoke all on function public.validar_afiliacion_asesor_id() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Desplegable «Asesor» de /afiliacion: solo id y nombre
-- ------------------------------------------------------------
create or replace function public.obtener_asesores_publico()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_completo
  from public.perfiles p
  where p.activo
    and (
      p.rol = 'asesor'::public.rol_usuario
      or (p.rol = 'admin'::public.rol_usuario and p.atiende_asociados)
    )
  order by p.nombre_completo;
$$;
revoke all on function public.obtener_asesores_publico() from public, anon, authenticated;
grant execute on function public.obtener_asesores_publico() to service_role;
comment on function public.obtener_asesores_publico() is
  'Id y nombre de quienes atienden asociados (asesores y admins con atiende_asociados), para el desplegable de /afiliacion. Solo service_role.';
