-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.6 (P-91).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Dar de baja / reactivar a un asociado con motivo obligatorio.
--   * public.historial_estado_asociado: inmutable (sin permisos de escritura
--     para authenticated + trigger que impide update/delete/truncate).
--   * RPC public.admin_cambiar_estado_asociado(p_asociado_id, p_activo,
--     p_motivo): solo admin activo; motivo 5–300; no a sí mismo.
--   * perfiles.activo ya NO se cambia con un update directo desde la app
--     (ni siquiera el admin): solo por la RPC, que deja el historial.
--     El service role y las migraciones (auth.uid() null) no se frenan.
--   * Un asociado inactivo:
--       - no crea solicitudes de crédito (ya lo exigía
--         exigir_proceso_operando_credito; ahora con mensaje claro),
--       - no crea alertas (retiro/renovación),
--       - no se inscribe ni confirma boleta del sorteo,
--       - mi_proceso_ejecutivo() y mi_boleta_sorteo() no le devuelven filas.
--     Las lecturas directas por RLS (su fila de perfiles, sus solicitudes)
--     se mantienen: el servidor necesita leer perfiles.activo para mostrar
--     «Tu cuenta está inactiva…» y cortar /cuenta en cada carga (§12.6).
--     Cerrar la sesión (auth.admin.signOut) lo hace el servidor con service
--     role; la base no toca el esquema auth.
--   * es_admin() y puede_atender() ya exigen activo: un admin o asesor dado
--     de baja pierde sus permisos al instante.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Historial
-- ------------------------------------------------------------
create table if not exists public.historial_estado_asociado (
  id              bigint generated always as identity primary key,
  asociado_id     uuid not null references public.perfiles (id),
  activo_anterior boolean not null,
  activo_nuevo    boolean not null,
  motivo          text not null check (char_length(btrim(motivo)) between 5 and 300),
  admin_id        uuid references public.perfiles (id),
  created_at      timestamptz not null default now(),
  constraint historial_estado_asociado_cambio_chk check (activo_anterior <> activo_nuevo)
);
comment on table public.historial_estado_asociado is
  'Bajas y reactivaciones de asociados (spec §12.6). Inmutable. Solo la escribe admin_cambiar_estado_asociado.';

create index if not exists ix_historial_estado_asociado_asociado
  on public.historial_estado_asociado (asociado_id, created_at desc);
create index if not exists ix_historial_estado_asociado_admin
  on public.historial_estado_asociado (admin_id);

alter table public.historial_estado_asociado enable row level security;
revoke all on public.historial_estado_asociado from anon, authenticated;
grant select on public.historial_estado_asociado to authenticated;

drop policy if exists "historial_estado_asociado_select_admin" on public.historial_estado_asociado;
create policy "historial_estado_asociado_select_admin" on public.historial_estado_asociado
  for select to authenticated using ((select public.es_admin()));

create or replace function public.historial_estado_inmutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'El historial de estado del asociado no se puede modificar ni borrar';
end;
$$;
revoke all on function public.historial_estado_inmutable() from public, anon, authenticated;

drop trigger if exists tr_historial_estado_inmutable on public.historial_estado_asociado;
create trigger tr_historial_estado_inmutable
  before update or delete on public.historial_estado_asociado
  for each row execute function public.historial_estado_inmutable();

drop trigger if exists tr_historial_estado_sin_truncate on public.historial_estado_asociado;
create trigger tr_historial_estado_sin_truncate
  before truncate on public.historial_estado_asociado
  for each statement execute function public.historial_estado_inmutable();

-- ------------------------------------------------------------
-- 2. perfiles.activo solo por la RPC (cuando hay sesión)
-- ------------------------------------------------------------
create or replace function public.exigir_rpc_cambio_activo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.activo is distinct from old.activo
     and coalesce(current_setting('ga.cambio_estado_asociado', true), '') <> 'si' then
    raise exception 'El estado del asociado solo se cambia con «Dar de baja» o «Reactivar», con un motivo';
  end if;
  return new;
end;
$$;
revoke all on function public.exigir_rpc_cambio_activo() from public, anon, authenticated;

drop trigger if exists tr_exigir_rpc_cambio_activo on public.perfiles;
create trigger tr_exigir_rpc_cambio_activo
  before update of activo on public.perfiles
  for each row execute function public.exigir_rpc_cambio_activo();

-- ------------------------------------------------------------
-- 3. RPC
-- ------------------------------------------------------------
create or replace function public.admin_cambiar_estado_asociado(
  p_asociado_id uuid, p_activo boolean, p_motivo text)
returns table (asociado_id uuid, activo boolean, historial_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_actual boolean;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_hist   bigint;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar el estado de un asociado';
  end if;
  if p_asociado_id is null or p_activo is null then
    raise exception 'Faltan datos para cambiar el estado';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_asociado_id = v_uid then
    raise exception 'No puedes cambiar tu propio estado; debe hacerlo otro administrador';
  end if;

  select p.activo into v_actual from public.perfiles p where p.id = p_asociado_id for update;
  if not found then
    raise exception 'El asociado no existe';
  end if;
  if v_actual = p_activo then
    if p_activo then
      raise exception 'El asociado ya está activo';
    else
      raise exception 'El asociado ya está dado de baja';
    end if;
  end if;

  perform set_config('ga.cambio_estado_asociado', 'si', true);
  update public.perfiles p set activo = p_activo where p.id = p_asociado_id;
  perform set_config('ga.cambio_estado_asociado', '', true);

  insert into public.historial_estado_asociado (asociado_id, activo_anterior, activo_nuevo, motivo, admin_id)
  values (p_asociado_id, v_actual, p_activo, v_motivo, v_uid)
  returning id into v_hist;

  return query select p_asociado_id, p_activo, v_hist;
end;
$$;
revoke all on function public.admin_cambiar_estado_asociado(uuid, boolean, text) from public, anon;
grant execute on function public.admin_cambiar_estado_asociado(uuid, boolean, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Un inactivo no crea solicitudes, alertas ni boletas
-- ------------------------------------------------------------
create or replace function public.exigir_asociado_activo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.perfiles p where p.id = new.asociado_id and p.activo) then
    raise exception 'Tu cuenta está inactiva. Comunícate con la cooperativa.';
  end if;
  return new;
end;
$$;
revoke all on function public.exigir_asociado_activo() from public, anon, authenticated;

-- «chk_asociado…» corre antes que «chk_credito_proceso_operando» (orden alfabético).
drop trigger if exists chk_asociado_activo_credito on public.solicitudes_credito;
create trigger chk_asociado_activo_credito
  before insert on public.solicitudes_credito
  for each row execute function public.exigir_asociado_activo();

drop trigger if exists tr_exigir_activo_alerta on public.alertas_asociado;
create trigger tr_exigir_activo_alerta
  before insert on public.alertas_asociado
  for each row execute function public.exigir_asociado_activo();

-- Boletas: inscribirse (insert) y confirmar (update de estado/intentos).
drop trigger if exists tr_exigir_activo_boleta on public.boletas_sorteo;
create trigger tr_exigir_activo_boleta
  before insert or update on public.boletas_sorteo
  for each row execute function public.exigir_asociado_activo();

-- ------------------------------------------------------------
-- 5. Lecturas de /cuenta: nada para un inactivo
-- ------------------------------------------------------------
create or replace function public.mi_proceso_ejecutivo()
returns table (estado public.estado_proceso_ejecutivo, fecha_inicio_embargo date, fecha_fin_embargo date,
               fecha_habilita_renovacion date, conteo_activo boolean, puede_pedir_retiro boolean,
               puede_pedir_renovacion boolean, retiro_pendiente boolean, renovacion_pendiente boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select pe.estado,
           pe.fecha_inicio_embargo,
           (pe.fecha_inicio_embargo + interval '36 months')::date as fin,
           (pe.fecha_inicio_embargo + interval '24 months')::date as renov,
           (now() at time zone 'America/Bogota')::date as hoy,
           exists (select 1 from public.alertas_asociado a
                    where a.asociado_id = pe.asociado_id
                      and a.tipo = 'retiro_anticipado'::public.tipo_alerta_asociado
                      and a.estado = 'pendiente'::public.estado_alerta_asociado) as ret_pend,
           exists (select 1 from public.alertas_asociado a
                    where a.asociado_id = pe.asociado_id
                      and a.tipo = 'renovacion'::public.tipo_alerta_asociado
                      and a.estado = 'pendiente'::public.estado_alerta_asociado) as ren_pend
    from public.procesos_ejecutivos pe
    join public.perfiles p on p.id = pe.asociado_id and p.activo   -- §12.6
    where pe.asociado_id = (select auth.uid())
  )
  select b.estado,
         b.fecha_inicio_embargo,
         b.fin,
         b.renov,
         coalesce(b.estado = 'operando'::public.estado_proceso_ejecutivo and b.hoy < b.fin, false),
         coalesce(b.estado = 'operando'::public.estado_proceso_ejecutivo and b.hoy < b.fin and not b.ret_pend, false),
         coalesce(b.estado = 'operando'::public.estado_proceso_ejecutivo and b.hoy >= b.renov and not b.ren_pend, false),
         b.ret_pend,
         b.ren_pend
  from base b;
$$;
revoke all on function public.mi_proceso_ejecutivo() from public, anon;
grant execute on function public.mi_proceso_ejecutivo() to authenticated;

create or replace function public.mi_boleta_sorteo(p_anio smallint, p_mes smallint)
returns table (estado public.estado_boleta_sorteo, numero text, intentos integer,
               fecha_envio timestamptz, fecha_confirmacion timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.estado,
         case when b.estado = 'confirmada'::public.estado_boleta_sorteo then b.numero end,
         b.intentos,
         b.fecha_envio,
         b.fecha_confirmacion
  from public.boletas_sorteo b
  join public.perfiles p on p.id = b.asociado_id and p.activo   -- §12.6
  where b.asociado_id = (select auth.uid())
    and b.anio = p_anio
    and b.mes = p_mes;
$$;
revoke all on function public.mi_boleta_sorteo(smallint, smallint) from public, anon;
grant execute on function public.mi_boleta_sorteo(smallint, smallint) to authenticated;
