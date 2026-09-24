-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Auditoría fase 2, hallazgo F2-05 (MEDIA).
-- PROPUESTA: NO APLICADA. Independiente de las demás; puede ir en la misma tanda.
--
-- Contexto: `auth.admin.createUser({ app_metadata })` de GoTrue hace primero
-- el INSERT en auth.users y DESPUÉS, en la misma transacción, un UPDATE de
-- raw_app_meta_data. handle_new_user (AFTER INSERT) no alcanza a ver la
-- cédula ni el grado y el perfil queda con cedula = 'PENDIENTE-xxxxxxxx' y
-- grado null. Hoy la app lo parchea con un segundo update desde el servidor
-- (app/admin/afiliaciones/actions.ts y app/admin/asesores/actions.ts), pero
-- ese update va en OTRA transacción: si falla (p. ej. cédula duplicada por
-- carrera), queda un usuario de Auth huérfano con cédula PENDIENTE que no
-- puede ingresar, y reintentar falla con "correo ya registrado".
--
-- Corrección: trigger AFTER UPDATE OF raw_app_meta_data en auth.users que
-- completa cédula y grado DENTRO de la transacción de GoTrue. Si la cédula
-- choca con otra, falla toda la creación del usuario (no queda huérfano).
--
-- Reglas (conservadoras, para no pisar al admin):
--  * Solo cuando app_metadata realmente cambia (cláusula WHEN).
--  * cédula: solo si viene válida (6–10 dígitos), cambió respecto a la de
--    antes en app_metadata y el perfil sigue con 'PENDIENTE-%'.
--  * grado: solo si es un valor válido del enum, cambió en app_metadata y el
--    perfil tiene grado null.
--  * NUNCA toca rol ni asesor_id. app_metadata solo lo puede escribir
--    service_role (el usuario final no puede), así que no abre escalada.
--  * proteger_campos_perfil no estorba: en la conexión de GoTrue auth.uid()
--    es null.
-- El parche de la app puede quedarse: es idempotente con esto.
-- Idempotente: create or replace + drop trigger if exists.
-- ============================================================

create or replace function public.sincronizar_perfil_desde_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula       text := nullif(btrim(new.raw_app_meta_data ->> 'cedula'), '');
  v_cedula_antes text := nullif(btrim(old.raw_app_meta_data ->> 'cedula'), '');
  v_grado        text := nullif(btrim(new.raw_app_meta_data ->> 'grado'), '');
  v_grado_antes  text := nullif(btrim(old.raw_app_meta_data ->> 'grado'), '');
begin
  if v_cedula is not null
     and v_cedula ~ '^[0-9]{6,10}$'
     and v_cedula is distinct from v_cedula_antes then
    update public.perfiles
       set cedula = v_cedula
     where id = new.id
       and cedula like 'PENDIENTE-%';
  end if;

  if v_grado is not null
     and v_grado is distinct from v_grado_antes
     and v_grado = any (enum_range(null::public.grado_policial)::text[]) then
    update public.perfiles
       set grado = v_grado::public.grado_policial
     where id = new.id
       and grado is null;
  end if;

  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;
revoke all on function public.sincronizar_perfil_desde_app_metadata() from public, anon, authenticated;
comment on function public.sincronizar_perfil_desde_app_metadata() is
  'Completa cédula (si sigue PENDIENTE-) y grado (si es null) del perfil cuando GoTrue guarda app_metadata después del insert. Nunca toca rol ni asesor_id.';

drop trigger if exists tr_on_auth_user_app_metadata on auth.users;
create trigger tr_on_auth_user_app_metadata
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function public.sincronizar_perfil_desde_app_metadata();
