-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgo H-10: la tabla solicitudes_afiliacion de
-- docs/spec-afiliacion-y-login.md no existe en producción.
--
-- Decisiones (revisar):
--  * La spec dice "grado_id → grados_credito", pero la PK de grados_credito
--    es compuesta (grado, porcentaje) y el porcentaje no se pide en la
--    afiliación. Se usa el enum public.grado_policial (mismos valores).
--  * Insert SOLO desde el servidor con service role (bypassa RLS). No hay
--    política de insert: ni anon ni authenticated pueden insertar directo.
--  * El admin lee y cambia el estado. Nadie borra desde la API.
--  * Una sola solicitud pendiente por cédula: índice único parcial.
--  * Límite por IP / honeypot van en la Server Action, no aquí.
-- Idempotente en lo posible.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'estado_afiliacion') then
    create type public.estado_afiliacion as enum ('pendiente', 'contactado', 'aprobada', 'rechazada');
  end if;
end $$;

create table if not exists public.solicitudes_afiliacion (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (char_length(btrim(nombre)) between 3 and 120),
  cedula           text not null check (cedula ~ '^[0-9]{6,10}$'),
  grado            public.grado_policial not null,
  unidad           text check (unidad is null or char_length(unidad) <= 120),
  celular          text not null check (celular ~ '^3[0-9]{9}$'),
  email            text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  mensaje          text check (mensaje is null or char_length(mensaje) <= 500),
  acepto_datos_at  timestamptz not null,           -- autorización Ley 1581 de 2012
  estado           public.estado_afiliacion not null default 'pendiente',
  revisado_por     uuid references public.perfiles(id),
  fecha_revision   timestamptz,
  created_at       timestamptz not null default now()
);

comment on table public.solicitudes_afiliacion is
  'Solicitudes del formulario «Deseo afiliarme». Insert solo desde el servidor (service role). Contiene datos personales: sin acceso anon.';

create unique index if not exists ux_afiliacion_pendiente_por_cedula
  on public.solicitudes_afiliacion (cedula) where estado = 'pendiente'::public.estado_afiliacion;
create index if not exists ix_afiliacion_estado_fecha
  on public.solicitudes_afiliacion (estado, created_at desc);
create index if not exists ix_afiliacion_revisado_por
  on public.solicitudes_afiliacion (revisado_por);

alter table public.solicitudes_afiliacion enable row level security;

-- Privilegios: anon nada; authenticated solo lo que RLS le permita al admin.
revoke all on public.solicitudes_afiliacion from anon, authenticated;
grant select, update on public.solicitudes_afiliacion to authenticated;

drop policy if exists "afiliacion_select_admin" on public.solicitudes_afiliacion;
create policy "afiliacion_select_admin" on public.solicitudes_afiliacion
  for select to authenticated using ((select public.es_admin()));

drop policy if exists "afiliacion_update_admin" on public.solicitudes_afiliacion;
create policy "afiliacion_update_admin" on public.solicitudes_afiliacion
  for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- El admin solo cambia el estado: los datos que envió el solicitante no se tocan.
create or replace function public.proteger_solicitud_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then  -- service role (auth.uid() null) puede corregir datos
    if new.nombre is distinct from old.nombre
    or new.cedula is distinct from old.cedula
    or new.grado is distinct from old.grado
    or new.unidad is distinct from old.unidad
    or new.celular is distinct from old.celular
    or new.email is distinct from old.email
    or new.mensaje is distinct from old.mensaje
    or new.acepto_datos_at is distinct from old.acepto_datos_at
    or new.created_at is distinct from old.created_at then
      raise exception 'Solo se puede cambiar el estado de la solicitud de afiliación';
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

drop trigger if exists tr_proteger_solicitud_afiliacion on public.solicitudes_afiliacion;
create trigger tr_proteger_solicitud_afiliacion
  before update on public.solicitudes_afiliacion
  for each row execute function public.proteger_solicitud_afiliacion();
