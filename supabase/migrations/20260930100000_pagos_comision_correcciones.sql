-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — Respuestas de Sebas (spec §8).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100500_comisiones_asesor.sql (no la reescribe).
--
-- Los pagos de comisión mal registrados se corrigen:
--   * admin_editar_pago_comision(): cambia monto, concepto y/o nota.
--   * admin_anular_pago_comision(): el pago queda anulado (no se borra).
--   * Motivo OBLIGATORIO en los dos casos.
--   * Todo queda en bitacora_pagos_comision: quién, cuándo, antes y después
--     (jsonb de la fila completa), motivo. También se registra la creación.
--   * Nadie edita ni borra la bitácora (ni con service role: un trigger lo
--     impide; solo un superusuario que apague el trigger podría).
--   * Los pagos siguen sin delete: ni la API ni postgres los borra (trigger).
--   * revelar_acumulado_comision() suma SOLO los pagos vigentes.
--
-- Cómo se garantiza el motivo: authenticated no tiene UPDATE sobre
-- pagos_comision; solo las funciones de abajo (security definer) lo
-- actualizan, y antes dejan el motivo en una variable de la transacción
-- (ga.motivo_cambio). Un trigger BEFORE UPDATE exige ese motivo y solo deja
-- cambiar monto, concepto, nota y los campos de anulación. Un trigger AFTER
-- escribe la bitácora. Así, incluso un UPDATE hecho a mano en el SQL Editor
-- sin motivo falla.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Anulación en pagos_comision
-- ------------------------------------------------------------
alter table public.pagos_comision
  add column if not exists anulado           boolean not null default false,
  add column if not exists anulado_por       uuid references public.perfiles (id),
  add column if not exists anulado_at        timestamptz,
  add column if not exists motivo_anulacion  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_comision_anulacion_chk') then
    alter table public.pagos_comision
      add constraint pagos_comision_anulacion_chk check (
        (not anulado and anulado_por is null and anulado_at is null and motivo_anulacion is null)
        or (anulado and anulado_at is not null
            and char_length(btrim(motivo_anulacion)) between 5 and 300)
      );
  end if;
end $$;

create index if not exists ix_pagos_comision_anulado_por on public.pagos_comision (anulado_por);

comment on column public.pagos_comision.anulado is
  'true = pago anulado por el admin (no cuenta en el acumulado del asesor). Se anula con admin_anular_pago_comision().';

-- ------------------------------------------------------------
-- 2. Bitácora inmutable
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'accion_bitacora_pago') then
    create type public.accion_bitacora_pago as enum ('creacion', 'edicion', 'anulacion');
  end if;
end $$;

create table if not exists public.bitacora_pagos_comision (
  id          bigint generated always as identity primary key,
  pago_id     uuid not null references public.pagos_comision (id),
  accion      public.accion_bitacora_pago not null,
  antes       jsonb,
  despues     jsonb not null,
  motivo      text,
  actor_id    uuid references public.perfiles (id),
  created_at  timestamptz not null default now(),
  constraint bitacora_pagos_motivo_chk check (
    accion = 'creacion'::public.accion_bitacora_pago
    or char_length(btrim(motivo)) between 5 and 300
  )
);

comment on table public.bitacora_pagos_comision is
  'Registro inmutable de cada creación, edición o anulación de un pago de comisión: quién, cuándo, antes/después y motivo. Solo lo lee el admin; nadie lo edita ni lo borra.';

create index if not exists ix_bitacora_pagos_pago on public.bitacora_pagos_comision (pago_id, created_at);
create index if not exists ix_bitacora_pagos_actor on public.bitacora_pagos_comision (actor_id);

alter table public.bitacora_pagos_comision enable row level security;
revoke all on public.bitacora_pagos_comision from anon, authenticated;
grant select on public.bitacora_pagos_comision to authenticated;

drop policy if exists "bitacora_pagos_select_admin" on public.bitacora_pagos_comision;
create policy "bitacora_pagos_select_admin" on public.bitacora_pagos_comision
  for select to authenticated using ((select public.es_admin()));

create or replace function public.bitacora_inmutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'La bitácora no se puede modificar ni borrar';
end;
$$;
revoke all on function public.bitacora_inmutable() from public, anon, authenticated;

drop trigger if exists tr_bitacora_pagos_inmutable on public.bitacora_pagos_comision;
create trigger tr_bitacora_pagos_inmutable
  before update or delete on public.bitacora_pagos_comision
  for each row execute function public.bitacora_inmutable();

drop trigger if exists tr_bitacora_pagos_sin_truncate on public.bitacora_pagos_comision;
create trigger tr_bitacora_pagos_sin_truncate
  before truncate on public.bitacora_pagos_comision
  for each statement execute function public.bitacora_inmutable();

-- ------------------------------------------------------------
-- 3. Reglas de cambio en pagos_comision
-- ------------------------------------------------------------
create or replace function public.proteger_pago_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(current_setting('ga.motivo_cambio', true)), '');
begin
  if tg_op = 'DELETE' then
    raise exception 'Los pagos de comisión no se borran; anúlelos con un motivo';
  end if;

  if v_motivo is null or char_length(v_motivo) < 5 then
    raise exception 'Para corregir un pago hace falta un motivo (mínimo 5 caracteres)';
  end if;

  if old.anulado then
    raise exception 'Un pago anulado ya no se puede modificar';
  end if;

  if (new.id, new.asesor_id, new.asociado_id, new.periodo_corte, new.registrado_por, new.created_at)
     is distinct from
     (old.id, old.asesor_id, old.asociado_id, old.periodo_corte, old.registrado_por, old.created_at) then
    raise exception 'Solo se puede corregir el monto, el concepto o la nota, o anular el pago';
  end if;

  if new.anulado then
    new.anulado_por      := auth.uid();
    new.anulado_at       := now();
    new.motivo_anulacion := v_motivo;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_pago_comision() from public, anon, authenticated;

drop trigger if exists tr_proteger_pago_comision on public.pagos_comision;
create trigger tr_proteger_pago_comision
  before update or delete on public.pagos_comision
  for each row execute function public.proteger_pago_comision();

create or replace function public.log_bitacora_pago_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.bitacora_pagos_comision (pago_id, accion, antes, despues, motivo, actor_id)
    values (new.id, 'creacion', null, to_jsonb(new), null, auth.uid());
  else
    insert into public.bitacora_pagos_comision (pago_id, accion, antes, despues, motivo, actor_id)
    values (
      new.id,
      case when new.anulado and not old.anulado then 'anulacion'::public.accion_bitacora_pago
           else 'edicion'::public.accion_bitacora_pago end,
      to_jsonb(old),
      to_jsonb(new),
      nullif(btrim(current_setting('ga.motivo_cambio', true)), ''),
      auth.uid()
    );
  end if;
  return null;
end;
$$;
revoke all on function public.log_bitacora_pago_comision() from public, anon, authenticated;

drop trigger if exists tr_bitacora_pago_comision on public.pagos_comision;
create trigger tr_bitacora_pago_comision
  after insert or update on public.pagos_comision
  for each row execute function public.log_bitacora_pago_comision();

-- ------------------------------------------------------------
-- 4. RPC del admin
-- ------------------------------------------------------------
create or replace function public.admin_editar_pago_comision(
  p_pago_id  uuid,
  p_motivo   text,
  p_monto    numeric default null,
  p_concepto public.concepto_comision default null,
  p_nota     text default null
)
returns public.pagos_comision
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.pagos_comision;
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede corregir pagos de comisión';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 5 or char_length(p_motivo) > 300 then
    raise exception 'Escribe el motivo de la corrección (5 a 300 caracteres)';
  end if;
  if p_monto is null and p_concepto is null and p_nota is null then
    raise exception 'No hay cambios para guardar';
  end if;

  perform set_config('ga.motivo_cambio', btrim(p_motivo), true);

  update public.pagos_comision pc
     set monto    = coalesce(p_monto, pc.monto),
         concepto = coalesce(p_concepto, pc.concepto),
         -- p_nota null = no cambiar; '' = borrar la nota.
         nota     = case when p_nota is null then pc.nota else nullif(btrim(p_nota), '') end
   where pc.id = p_pago_id
  returning pc.* into v_fila;

  perform set_config('ga.motivo_cambio', '', true);

  if not found then
    raise exception 'No existe ese pago';
  end if;
  return v_fila;
end;
$$;
revoke all on function public.admin_editar_pago_comision(uuid, text, numeric, public.concepto_comision, text) from public, anon;
grant execute on function public.admin_editar_pago_comision(uuid, text, numeric, public.concepto_comision, text) to authenticated;
comment on function public.admin_editar_pago_comision(uuid, text, numeric, public.concepto_comision, text) is
  'Solo admin (lo revisa la función). Corrige monto, concepto y/o nota de un pago vigente con motivo obligatorio; queda en bitacora_pagos_comision. Parámetro null = no cambiar; p_nota = '''' borra la nota.';

create or replace function public.admin_anular_pago_comision(p_pago_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede anular pagos de comisión';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 5 or char_length(p_motivo) > 300 then
    raise exception 'Escribe el motivo de la anulación (5 a 300 caracteres)';
  end if;

  perform set_config('ga.motivo_cambio', btrim(p_motivo), true);

  update public.pagos_comision
     set anulado = true
   where id = p_pago_id;

  perform set_config('ga.motivo_cambio', '', true);

  if not found then
    raise exception 'No existe ese pago';
  end if;
end;
$$;
revoke all on function public.admin_anular_pago_comision(uuid, text) from public, anon;
grant execute on function public.admin_anular_pago_comision(uuid, text) to authenticated;
comment on function public.admin_anular_pago_comision(uuid, text) is
  'Solo admin (lo revisa la función). Anula un pago vigente con motivo obligatorio; deja de contar en el acumulado y queda en la bitácora.';

-- ------------------------------------------------------------
-- 5. El acumulado solo suma pagos vigentes
-- ------------------------------------------------------------
create or replace function public.revelar_acumulado_comision()
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_total numeric;
begin
  if v_uid is null or not public.puede_atender(v_uid) then
    raise exception 'Solo los asesores pueden ver su acumulado de comisiones';
  end if;

  insert into public.revelaciones_acumulado_comision as r (asesor_id, veces)
  values (v_uid, 1)
  on conflict (asesor_id) do update
     set veces = r.veces + 1,
         ultima_at = now();

  select coalesce(sum(pc.monto), 0) into v_total
  from public.pagos_comision pc
  where pc.asesor_id = v_uid
    and not pc.anulado;

  return v_total;
end;
$$;
revoke all on function public.revelar_acumulado_comision() from public, anon;
grant execute on function public.revelar_acumulado_comision() to authenticated;
