-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Fase 2 · PARTE 1. NO APLICADA en producción.
-- Cambios a solicitudes_afiliacion pedidos por la cooperativa:
--  * nombres y apellidos separados (antes: una sola columna «nombre»).
--  * institucion ('policia' | 'ejercito') y correo institucional según cuál.
--  * nequi (10 dígitos, empieza por 3).
--  * asesor_id opcional → perfiles con rol asesor (quién refirió al candidato).
--  * 3 fotos (rutas del bucket privado 'afiliacion-documentos', no URLs).
--  * unidad deja de usarse: ya era nullable, se deja igual (no se borra).
--
-- La columna «nombre» (una sola cadena) se conserva por compatibidad con
-- cualquier lectura existente, pero pasa a ser NULLABLE y se calcula sola
-- (nombres || ' ' || apellidos) con un trigger: nadie debe escribirla a mano.
-- Idempotente: add column if not exists, drop/create constraint con nombre fijo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enum de institución
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'institucion_afiliacion') then
    create type public.institucion_afiliacion as enum ('policia', 'ejercito');
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Columnas nuevas
-- ------------------------------------------------------------
alter table public.solicitudes_afiliacion
  add column if not exists nombres      text,
  add column if not exists apellidos    text,
  add column if not exists institucion  public.institucion_afiliacion,
  add column if not exists nequi        text,
  add column if not exists asesor_id    uuid references public.perfiles(id),
  add column if not exists foto_cedula_frente   text,
  add column if not exists foto_cedula_reverso  text,
  add column if not exists foto_selfie          text;

comment on column public.solicitudes_afiliacion.nombres is 'Solo letras (con tildes y ñ) y espacios, 2 a 60 caracteres.';
comment on column public.solicitudes_afiliacion.apellidos is 'Solo letras (con tildes y ñ) y espacios, 2 a 60 caracteres.';
comment on column public.solicitudes_afiliacion.institucion is 'Define el dominio de correo institucional exigido (ver chk de email).';
comment on column public.solicitudes_afiliacion.nequi is '10 dígitos que empiezan por 3 (igual formato que el celular).';
comment on column public.solicitudes_afiliacion.asesor_id is 'Asesor que refirió al candidato (opcional). Debe ser un perfil con rol asesor.';
comment on column public.solicitudes_afiliacion.foto_cedula_frente is 'Ruta dentro del bucket privado afiliacion-documentos, no una URL pública.';
comment on column public.solicitudes_afiliacion.foto_cedula_reverso is 'Ruta dentro del bucket privado afiliacion-documentos, no una URL pública.';
comment on column public.solicitudes_afiliacion.foto_selfie is 'Ruta dentro del bucket privado afiliacion-documentos, no una URL pública.';
comment on column public.solicitudes_afiliacion.unidad is 'En desuso (la spec de fase 2 ya no la pide). Se deja nullable, sin borrar, por si hay datos antiguos.';

-- ------------------------------------------------------------
-- 3. «nombre» pasa a ser derivado (nombres || ' ' || apellidos)
-- ------------------------------------------------------------
alter table public.solicitudes_afiliacion alter column nombre drop not null;
alter table public.solicitudes_afiliacion drop constraint if exists solicitudes_afiliacion_nombre_check;

create or replace function public.componer_nombre_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nombres is not null and new.apellidos is not null then
    new.nombre := btrim(new.nombres) || ' ' || btrim(new.apellidos);
  end if;
  return new;
end;
$$;
revoke all on function public.componer_nombre_afiliacion() from public, anon, authenticated;

drop trigger if exists tr_componer_nombre_afiliacion on public.solicitudes_afiliacion;
create trigger tr_componer_nombre_afiliacion
  before insert or update of nombres, apellidos on public.solicitudes_afiliacion
  for each row execute function public.componer_nombre_afiliacion();

-- ------------------------------------------------------------
-- 4. Checks de los campos nuevos
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_nombres_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_nombres_chk
      check (nombres is not null
             and char_length(btrim(nombres)) between 2 and 60
             and nombres ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_apellidos_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_apellidos_chk
      check (apellidos is not null
             and char_length(btrim(apellidos)) between 2 and 60
             and apellidos ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_institucion_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_institucion_chk
      check (institucion is not null);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_nequi_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_nequi_chk
      check (nequi is not null and nequi ~ '^3[0-9]{9}$');
  end if;

  -- Correo institucional según la institución. Se suma al chk de formato
  -- general que ya existe (email = lower(email) y forma básica usuario@dominio).
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_email_institucion_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_email_institucion_chk
      check (
        (institucion = 'policia'::public.institucion_afiliacion and email ~ '@policia\.gov\.co$')
        or
        (institucion = 'ejercito'::public.institucion_afiliacion and email ~ '@(buzonejercito\.mil\.co|ejercito\.mil\.co)$')
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_fotos_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_fotos_chk
      check (
        foto_cedula_frente  is not null and char_length(foto_cedula_frente)  between 1 and 300
        and foto_cedula_reverso is not null and char_length(foto_cedula_reverso) between 1 and 300
        and foto_selfie         is not null and char_length(foto_selfie)         between 1 and 300
      );
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. asesor_id debe ser un perfil con rol asesor (helper de la migración anterior)
-- ------------------------------------------------------------
create or replace function public.validar_afiliacion_asesor_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asesor_id is not null and not public.es_asesor(new.asesor_id) then
    raise exception 'asesor_id debe ser un perfil con rol asesor';
  end if;
  return new;
end;
$$;
revoke all on function public.validar_afiliacion_asesor_id() from public, anon, authenticated;

drop trigger if exists tr_validar_afiliacion_asesor_id on public.solicitudes_afiliacion;
create trigger tr_validar_afiliacion_asesor_id
  before insert or update of asesor_id on public.solicitudes_afiliacion
  for each row execute function public.validar_afiliacion_asesor_id();

-- ------------------------------------------------------------
-- 6. proteger_solicitud_afiliacion: la lista de campos «solo lectura para
--    el admin» se amplía con los campos nuevos (el admin solo cambia estado).
-- ------------------------------------------------------------
create or replace function public.proteger_solicitud_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.nombres is distinct from old.nombres
    or new.apellidos is distinct from old.apellidos
    or new.cedula is distinct from old.cedula
    or new.grado is distinct from old.grado
    or new.institucion is distinct from old.institucion
    or new.unidad is distinct from old.unidad
    or new.celular is distinct from old.celular
    or new.nequi is distinct from old.nequi
    or new.email is distinct from old.email
    or new.asesor_id is distinct from old.asesor_id
    or new.foto_cedula_frente is distinct from old.foto_cedula_frente
    or new.foto_cedula_reverso is distinct from old.foto_cedula_reverso
    or new.foto_selfie is distinct from old.foto_selfie
    or new.mensaje is distinct from old.mensaje
    or new.acepto_datos_at is distinct from old.acepto_datos_at
    or new.created_at is distinct from old.created_at then
      raise exception 'Solo se puede cambiar el estado de la solicitud de afiliación';
    end if;
    if new.estado is not distinct from old.estado then
      new.revisado_por   := old.revisado_por;
      new.fecha_revision := old.fecha_revision;
    end if;
  end if;
  if new.estado is distinct from old.estado then
    new.revisado_por   := auth.uid();
    new.fecha_revision := now();
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_solicitud_afiliacion() from public, anon, authenticated;
