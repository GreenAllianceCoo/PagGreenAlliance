-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Fase 2 · PARTE 1. NO APLICADA en producción.
-- Cada asociado puede tener un asesor: perfiles.asesor_id → perfiles(id)
-- con rol 'asesor'. Puede ser null (sin asesor asignado).
--
-- Reglas:
--  * Solo el admin asigna o cambia el asesor de un perfil (nadie se asigna
--    un asesor a sí mismo, igual que ya pasa con rol, grado y cédula).
--  * asesor_id debe apuntar a un perfil con rol = 'asesor' (no a cualquiera).
--  * Un perfil no puede ser su propio asesor.
-- Idempotente.
-- ============================================================

alter table public.perfiles
  add column if not exists asesor_id uuid references public.perfiles(id);

create index if not exists ix_perfiles_asesor_id on public.perfiles (asesor_id);

comment on column public.perfiles.asesor_id is
  'Asesor asignado a este asociado (perfil con rol asesor). Solo lo asigna el admin.';

-- ------------------------------------------------------------
-- public.es_asesor(): helper reutilizable (perfiles y solicitudes_afiliacion)
-- ------------------------------------------------------------
create or replace function public.es_asesor(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = p_id and p.rol = 'asesor'::public.rol_usuario
  );
$$;
revoke all on function public.es_asesor(uuid) from public, anon, authenticated;
comment on function public.es_asesor(uuid) is
  'Indica si el perfil dado tiene rol asesor. SECURITY DEFINER para poder usarse en checks/triggers sin depender de RLS.';

-- ------------------------------------------------------------
-- Validación de asesor_id en perfiles: debe ser un asesor real y no uno mismo.
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
    if not public.es_asesor(new.asesor_id) then
      raise exception 'asesor_id debe ser un perfil con rol asesor';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validar_perfil_asesor_id() from public, anon, authenticated;

drop trigger if exists tr_validar_perfil_asesor_id on public.perfiles;
create trigger tr_validar_perfil_asesor_id
  before insert or update of asesor_id on public.perfiles
  for each row execute function public.validar_perfil_asesor_id();

-- ------------------------------------------------------------
-- Nadie se asigna un asesor a sí mismo: se extiende el trigger existente
-- proteger_campos_perfil (creado en 20260922210921, reemplazado varias veces).
-- Se repite aquí completo porque `create or replace` reemplaza toda la función.
-- ------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id then raise exception 'No se puede cambiar el id de un perfil'; end if;
    if new.created_at is distinct from old.created_at then raise exception 'No se puede cambiar la fecha de creación del perfil'; end if;

    if not public.es_admin() then
      if new.rol is distinct from old.rol then raise exception 'No puede modificar su propio rol'; end if;
      if new.grado is distinct from old.grado then raise exception 'No puede modificar su propio grado; solicítelo a la administración'; end if;
      if new.cedula is distinct from old.cedula then raise exception 'No puede modificar su número de cédula'; end if;
      -- P-10: el asociado solo puede cambiar su teléfono.
      if new.nombre_completo is distinct from old.nombre_completo then raise exception 'No puede modificar su nombre; solicítelo a la administración'; end if;
      -- Nadie se asigna (ni se quita) un asesor a sí mismo: solo el admin.
      if new.asesor_id is distinct from old.asesor_id then raise exception 'No puede modificar su propio asesor; solicítelo a la administración'; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;
