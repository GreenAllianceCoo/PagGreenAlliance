-- ============================================================
-- 2026-10-18 — Revisión de seguridad del 18-oct (RS-M2, RS-M3, RS-B2).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica
-- (después de 20261018000000_pausa_cuenta_y_avisos). Idempotente.
--
--  RS-M3 «Editar datos» del asociado pasa a la base: admin_editar_datos_asociado()
--        exige admin, rol asociado no eliminado, que no sea el propio perfil ni
--        un cliente suyo (RS-01) y deja historial. Un UPDATE directo de nombre,
--        celular, correo institucional o nómina sobre OTRA persona (p. ej. un
--        PATCH a /rest/v1/perfiles con la sesión de un admin) se rechaza; tampoco
--        un admin se cambia a sí mismo nombre, correo institucional ni nómina.
--        El propio celular lo sigue cambiando cada quien desde su perfil.
--  RS-M2 historial_cambio_datos_perfil: quién cambió qué columnas y cuándo (sin
--        valores). El correo institucional exige una institución registrada y
--        su dominio (dominios_correo_institucional()).
--  RS-B2 marcar_aviso_visto(): mismos filtros que mis_avisos_pendientes()
--        (aviso activo, asociado activo y no eliminado).
-- Las escrituras con service role (aprobar afiliación, sincronizar perfil) no
-- tienen auth.uid() y no se ven afectadas.
-- ============================================================

-- ------------------------------------------------------------
-- Historial (sin valores: son datos personales)
-- ------------------------------------------------------------
create table if not exists public.historial_cambio_datos_perfil (
  id         bigint generated always as identity primary key,
  perfil_id  uuid not null references public.perfiles (id) on delete cascade,
  actor_id   uuid references public.perfiles (id) on delete set null,
  campos     text[] not null check (cardinality(campos) between 1 and 6),
  created_at timestamptz not null default now()
);
comment on table public.historial_cambio_datos_perfil is
  'Cambios de datos del asociado hechos por un admin («Editar datos»): quién, cuándo y qué columnas. No guarda valores. Inmutable.';
create index if not exists ix_historial_datos_perfil on public.historial_cambio_datos_perfil (perfil_id, created_at desc);
create index if not exists ix_historial_datos_actor on public.historial_cambio_datos_perfil (actor_id);

alter table public.historial_cambio_datos_perfil enable row level security;
revoke all on public.historial_cambio_datos_perfil from anon, authenticated;
grant select on public.historial_cambio_datos_perfil to authenticated;
drop policy if exists historial_datos_perfil_select_admin on public.historial_cambio_datos_perfil;
create policy historial_datos_perfil_select_admin on public.historial_cambio_datos_perfil
  for select to authenticated using ((select public.es_admin()));

-- ------------------------------------------------------------
-- Barrera: nombre, celular, correo institucional y nómina de otra persona
-- solo cambian por admin_editar_datos_asociado().
-- ------------------------------------------------------------
create or replace function public.exigir_rpc_datos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or coalesce(current_setting('ga.editar_datos_asociado', true), '') = 'si' then
    return new;
  end if;

  if new.id <> v_uid
     and (new.nombre_completo, new.telefono, new.correo_institucional, new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from
         (old.nombre_completo, old.telefono, old.correo_institucional, old.nomina_entidad, old.nomina_tipo, old.nomina_numero)
  then
    raise exception 'Los datos de un asociado solo se cambian con «Editar datos»';
  end if;

  -- Un admin tampoco se cambia a sí mismo nombre, correo institucional ni nómina
  -- (para el resto de roles ya lo impide proteger_campos_perfil). El celular sí.
  if new.id = v_uid and public.es_admin()
     and (new.nombre_completo, new.correo_institucional, new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from
         (old.nombre_completo, old.correo_institucional, old.nomina_entidad, old.nomina_tipo, old.nomina_numero)
  then
    raise exception 'No puedes cambiar tus propios datos; debe hacerlo otro administrador';
  end if;

  return new;
end;
$$;
revoke all on function public.exigir_rpc_datos_perfil() from public, anon, authenticated;

drop trigger if exists tr_exigir_rpc_datos_perfil on public.perfiles;
create trigger tr_exigir_rpc_datos_perfil
  before update of nombre_completo, telefono, correo_institucional, nomina_entidad, nomina_tipo, nomina_numero
  on public.perfiles
  for each row execute function public.exigir_rpc_datos_perfil();

-- ------------------------------------------------------------
-- RPC de «Editar datos»
-- ------------------------------------------------------------
create or replace function public.admin_editar_datos_asociado(
  p_asociado_id          uuid,
  p_nombre               text,
  p_telefono             text,
  p_correo_institucional text,
  p_nomina_entidad       text,
  p_nomina_tipo          public.tipo_cuenta_nomina,
  p_nomina_numero        text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_actual public.perfiles%rowtype;
  v_correo text := nullif(lower(btrim(coalesce(p_correo_institucional, ''))), '');
  v_campos text[] := '{}';
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede editar los datos de un asociado';
  end if;
  if p_asociado_id is null or p_asociado_id = v_uid then
    raise exception 'No puedes editar tus propios datos; debe hacerlo otro administrador';
  end if;

  select * into v_actual from public.perfiles p where p.id = p_asociado_id for update;
  if not found or v_actual.rol <> 'asociado'::public.rol_usuario or v_actual.eliminado_at is not null then
    raise exception 'No encontramos al asociado';
  end if;
  if v_actual.asesor_id = v_uid then
    raise exception 'Es uno de tus clientes: otro administrador debe editar sus datos';
  end if;

  if v_correo is not null then
    if v_actual.institucion is null then
      raise exception 'El asociado no tiene institución registrada: no se puede guardar un correo institucional';
    end if;
    if split_part(v_correo, '@', 2) <> all (public.dominios_correo_institucional(v_actual.institucion)) then
      raise exception 'El correo institucional no es del dominio de su institución';
    end if;
  end if;

  if p_nombre is distinct from v_actual.nombre_completo then v_campos := array_append(v_campos, 'nombre'); end if;
  if p_telefono is distinct from v_actual.telefono then v_campos := array_append(v_campos, 'celular'); end if;
  if v_correo is distinct from v_actual.correo_institucional then v_campos := array_append(v_campos, 'correo_institucional'); end if;
  if (p_nomina_entidad, p_nomina_tipo, p_nomina_numero)
     is distinct from (v_actual.nomina_entidad, v_actual.nomina_tipo, v_actual.nomina_numero) then
    v_campos := array_append(v_campos, 'nomina');
  end if;
  if cardinality(v_campos) = 0 then
    raise exception 'No hay cambios para guardar';
  end if;

  perform set_config('ga.editar_datos_asociado', 'si', true);
  update public.perfiles p
     set nombre_completo = p_nombre,
         telefono = p_telefono,
         correo_institucional = v_correo,
         nomina_entidad = p_nomina_entidad,
         nomina_tipo = p_nomina_tipo,
         nomina_numero = p_nomina_numero
   where p.id = p_asociado_id;
  perform set_config('ga.editar_datos_asociado', '', true);

  insert into public.historial_cambio_datos_perfil (perfil_id, actor_id, campos)
  values (p_asociado_id, v_uid, v_campos);
  return v_campos;
end;
$$;
revoke all on function public.admin_editar_datos_asociado(uuid, text, text, text, text, public.tipo_cuenta_nomina, text) from public, anon;
grant execute on function public.admin_editar_datos_asociado(uuid, text, text, text, text, public.tipo_cuenta_nomina, text) to authenticated;

-- ------------------------------------------------------------
-- RS-B2: marcar_aviso_visto con los filtros de mis_avisos_pendientes
-- ------------------------------------------------------------
create or replace function public.marcar_aviso_visto(p_aviso_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión';
  end if;
  insert into public.avisos_vistos (aviso_id, asociado_id)
  select a.id, p.id
  from public.avisos_asociados a
  join public.perfiles p on p.id = (select auth.uid())
  where a.id = p_aviso_id
    and a.activo
    and p.rol = 'asociado'::public.rol_usuario
    and p.activo
    and p.eliminado_at is null
    and a.created_at >= p.created_at
  on conflict (aviso_id, asociado_id) do nothing;
end;
$$;
revoke all on function public.marcar_aviso_visto(uuid) from public, anon;
grant execute on function public.marcar_aviso_visto(uuid) to authenticated;
