-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §2.6, §2.8, §2.12).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100100_catalogo_grados.sql y requiere
-- 20260925200100_perfiles_institucion_y_activo.sql (perfiles.institucion/activo).
--
-- 1. Cuenta de nómina (entidad, tipo, número) en solicitudes_afiliacion y
--    en perfiles (al aprobar, el servidor la copia al perfil).
--      tipo: 'ahorros' | 'corriente' | 'deposito_electronico' (billeteras,
--      R-03: el número es el celular, 10 dígitos que empiezan por 3).
--      entidad: texto libre de 2 a 60 caracteres (la lista de bancos y
--      billeteras vive en la app; incluye «Otra, ¿cuál?»).
--      número: 6 a 20 dígitos (ahorros/corriente) o celular (depósito).
-- 2. Dos correos:
--      solicitudes_afiliacion.email  = CORREO PERSONAL (es el de Auth: el
--        ingreso con código queda anclado a este). Se conserva el nombre de
--        la columna para no romper aprobarAfiliacion, que ya crea el usuario
--        con `email`.
--      solicitudes_afiliacion.correo_institucional = nuevo, cualquier
--        dominio (R-04), distinto del personal.
--      perfiles.correo_institucional = nuevo. El personal NO se copia a
--        perfiles: vive en auth.users.email (una sola fuente; evita que se
--        desincronicen y no expone el correo por la API de perfiles).
-- 3. Obligatoriedad: los checks validan FORMATO cuando el dato viene; que
--    vengan (nómina y correo institucional obligatorios) lo exige la Server
--    Action (zod), que es la única que inserta (service role). No se exige
--    en la base para no romper afiliaciones antiguas ni las pruebas/seed
--    existentes. Al final del archivo queda comentado el trigger para
--    endurecerlo cuando el código nuevo esté en producción.
-- 4. Solo lectura para el asociado: proteger_campos_perfil suma nómina,
--    correo institucional y atiende_asociados. El admin, en
--    solicitudes_afiliacion, sigue sin poder tocar lo que envió el
--    solicitante (proteger_solicitud_afiliacion suma los campos nuevos).
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'tipo_cuenta_nomina') then
    create type public.tipo_cuenta_nomina as enum ('ahorros', 'corriente', 'deposito_electronico');
  end if;
end $$;

comment on type public.tipo_cuenta_nomina is
  'Tipo de la cuenta de nómina. deposito_electronico = billetera (Nequi, Daviplata, …): el número es el celular.';

-- ------------------------------------------------------------
-- Columnas
-- ------------------------------------------------------------
alter table public.solicitudes_afiliacion
  add column if not exists correo_institucional text,
  add column if not exists nomina_entidad       text,
  add column if not exists nomina_tipo          public.tipo_cuenta_nomina,
  add column if not exists nomina_numero        text;

alter table public.perfiles
  add column if not exists correo_institucional text,
  add column if not exists nomina_entidad       text,
  add column if not exists nomina_tipo          public.tipo_cuenta_nomina,
  add column if not exists nomina_numero        text;

comment on column public.solicitudes_afiliacion.email is
  'CORREO PERSONAL (minúsculas). Es el correo de Auth: el ingreso con código llega aquí.';
comment on column public.solicitudes_afiliacion.correo_institucional is
  'Correo institucional (cualquier dominio, R-04). Debe ser distinto del personal (email).';
comment on column public.solicitudes_afiliacion.nomina_entidad is 'Banco o billetera de la cuenta de nómina (texto de la lista de la app u «Otra»).';
comment on column public.solicitudes_afiliacion.nomina_tipo is 'ahorros | corriente | deposito_electronico (billetera).';
comment on column public.solicitudes_afiliacion.nomina_numero is '6 a 20 dígitos; si es depósito electrónico, el celular (3 + 9 dígitos).';
comment on column public.perfiles.correo_institucional is
  'Correo institucional copiado de la afiliación. El personal está en auth.users.email. Solo lo cambia el admin.';
comment on column public.perfiles.nomina_entidad is 'Cuenta de nómina (copiada de la afiliación). Solo la cambia el admin.';
comment on column public.perfiles.nomina_tipo is 'Cuenta de nómina (copiada de la afiliación). Solo la cambia el admin.';
comment on column public.perfiles.nomina_numero is 'Cuenta de nómina (copiada de la afiliación). Solo la cambia el admin.';

-- ------------------------------------------------------------
-- Checks de formato (se permiten null; ver punto 3 del encabezado)
-- ------------------------------------------------------------
do $$
begin
  -- solicitudes_afiliacion
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_correo_institucional_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_correo_institucional_chk
      check (correo_institucional is null
             or (correo_institucional = lower(correo_institucional)
                 and char_length(correo_institucional) <= 254
                 and correo_institucional ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_correos_distintos_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_correos_distintos_chk
      check (correo_institucional is null or correo_institucional <> email);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_nomina_chk') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_nomina_chk
      check (
        (nomina_entidad is null and nomina_tipo is null and nomina_numero is null)
        or (
          nomina_entidad is not null and nomina_tipo is not null and nomina_numero is not null
          and char_length(btrim(nomina_entidad)) between 2 and 60
          and (
            (nomina_tipo = 'deposito_electronico'::public.tipo_cuenta_nomina and nomina_numero ~ '^3[0-9]{9}$')
            or (nomina_tipo in ('ahorros'::public.tipo_cuenta_nomina, 'corriente'::public.tipo_cuenta_nomina)
                and nomina_numero ~ '^[0-9]{6,20}$')
          )
        )
      );
  end if;

  -- perfiles (mismas reglas)
  if not exists (select 1 from pg_constraint where conname = 'perfiles_correo_institucional_chk') then
    alter table public.perfiles
      add constraint perfiles_correo_institucional_chk
      check (correo_institucional is null
             or (correo_institucional = lower(correo_institucional)
                 and char_length(correo_institucional) <= 254
                 and correo_institucional ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfiles_nomina_chk') then
    alter table public.perfiles
      add constraint perfiles_nomina_chk
      check (
        (nomina_entidad is null and nomina_tipo is null and nomina_numero is null)
        or (
          nomina_entidad is not null and nomina_tipo is not null and nomina_numero is not null
          and char_length(btrim(nomina_entidad)) between 2 and 60
          and (
            (nomina_tipo = 'deposito_electronico'::public.tipo_cuenta_nomina and nomina_numero ~ '^3[0-9]{9}$')
            or (nomina_tipo in ('ahorros'::public.tipo_cuenta_nomina, 'corriente'::public.tipo_cuenta_nomina)
                and nomina_numero ~ '^[0-9]{6,20}$')
          )
        )
      );
  end if;
end $$;

-- ------------------------------------------------------------
-- perfiles: el asociado solo cambia su teléfono (y sus preferencias, como
-- avisar_apertura_sorteo). Todo lo demás, solo el admin.
-- Reemplaza COMPLETA la versión de 20260925200100.
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
      if new.nombre_completo is distinct from old.nombre_completo then raise exception 'No puede modificar su nombre; solicítelo a la administración'; end if;
      if new.asesor_id is distinct from old.asesor_id then raise exception 'No puede modificar su propio asesor; solicítelo a la administración'; end if;
      if new.institucion is distinct from old.institucion then raise exception 'No puede modificar su institución; solicítelo a la administración'; end if;
      if new.activo is distinct from old.activo then raise exception 'No puede modificar su estado de asociado; solicítelo a la administración'; end if;
      -- NUEVO (requerimientos de Ricardo)
      if new.atiende_asociados is distinct from old.atiende_asociados then raise exception 'No puede modificar si atiende asociados; solicítelo a la administración'; end if;
      if new.correo_institucional is distinct from old.correo_institucional then raise exception 'No puede modificar su correo institucional; solicítelo a la administración'; end if;
      if (new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from (old.nomina_entidad, old.nomina_tipo, old.nomina_numero) then
        raise exception 'No puede modificar su cuenta de nómina; solicítelo a la administración';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;

-- ------------------------------------------------------------
-- solicitudes_afiliacion: el admin solo cambia el estado.
-- Reemplaza COMPLETA la versión de 20260924000200.
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
    or new.correo_institucional is distinct from old.correo_institucional
    or new.nomina_entidad is distinct from old.nomina_entidad
    or new.nomina_tipo is distinct from old.nomina_tipo
    or new.nomina_numero is distinct from old.nomina_numero
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

-- ------------------------------------------------------------
-- ENDURECER MÁS ADELANTE (no se aplica ahora): cuando el formulario nuevo
-- esté en producción, exigir en la base los campos nuevos al CREAR una
-- afiliación (solo en insert, para no bloquear el cambio de estado de las
-- antiguas):
--
-- create or replace function public.exigir_campos_afiliacion_v3()
-- returns trigger language plpgsql security definer set search_path = '' as $f$
-- begin
--   if new.correo_institucional is null then raise exception 'Falta el correo institucional'; end if;
--   if new.nomina_numero is null then raise exception 'Falta la cuenta de nómina'; end if;
--   return new;
-- end $f$;
-- revoke all on function public.exigir_campos_afiliacion_v3() from public, anon, authenticated;
-- create trigger tr_exigir_campos_afiliacion_v3 before insert on public.solicitudes_afiliacion
--   for each row execute function public.exigir_campos_afiliacion_v3();
-- ------------------------------------------------------------
