-- ============================================================
-- 2026-10-22 — Aviso al asociado cuando un admin le cambia datos sensibles
-- (revisión de seguridad del 18-oct, RS-M2; decisión de Sebas: sin correo,
-- como aviso al próximo ingreso).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica
-- (después de 20261018100000_editar_datos_en_la_base). Idempotente.
--
--  - avisos_asociados.destinatario_id: null = aviso para todos (los que publica
--    el admin en /admin/plataforma); con valor = aviso personal para ese asociado.
--  - admin_editar_datos_asociado(): si cambian el correo institucional o la
--    cuenta de nómina, crea un aviso personal («Actualizamos tus datos») que el
--    asociado ve una vez la próxima vez que entra a /cuenta. No dice los valores
--    nuevos (pueden verse en una pantalla ajena): solo qué cambió y cuándo.
--  - mis_avisos_pendientes() y marcar_aviso_visto() respetan el destinatario.
-- ============================================================

alter table public.avisos_asociados
  add column if not exists destinatario_id uuid references public.perfiles (id) on delete cascade;
comment on column public.avisos_asociados.destinatario_id is
  'null = aviso para todos los asociados (publicado en /admin/plataforma); con valor = aviso personal (p. ej. cambio de datos).';
create index if not exists ix_avisos_asociados_destinatario
  on public.avisos_asociados (destinatario_id) where destinatario_id is not null;

create or replace function public.mis_avisos_pendientes()
returns table (id uuid, titulo text, mensaje text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.titulo, a.mensaje, a.created_at
  from public.avisos_asociados a
  join public.perfiles p on p.id = (select auth.uid())
  where a.activo
    and (a.destinatario_id is null or a.destinatario_id = p.id)
    and p.rol = 'asociado'::public.rol_usuario
    and p.activo
    and p.eliminado_at is null
    and a.created_at >= p.created_at
    and not exists (
      select 1 from public.avisos_vistos v where v.aviso_id = a.id and v.asociado_id = p.id
    )
  order by a.created_at
  limit 5;
$$;
revoke all on function public.mis_avisos_pendientes() from public, anon;
grant execute on function public.mis_avisos_pendientes() to authenticated;

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
    and (a.destinatario_id is null or a.destinatario_id = p.id)
    and p.rol = 'asociado'::public.rol_usuario
    and p.activo
    and p.eliminado_at is null
    and a.created_at >= p.created_at
  on conflict (aviso_id, asociado_id) do nothing;
end;
$$;
revoke all on function public.marcar_aviso_visto(uuid) from public, anon;
grant execute on function public.marcar_aviso_visto(uuid) to authenticated;

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
  v_uid     uuid := (select auth.uid());
  v_actual  public.perfiles%rowtype;
  v_correo  text := nullif(lower(btrim(coalesce(p_correo_institucional, ''))), '');
  v_campos  text[] := '{}';
  v_sensibles text[] := '{}';
  v_fecha   text := to_char(now() at time zone 'America/Bogota', 'DD/MM/YYYY');
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
  if v_correo is distinct from v_actual.correo_institucional then
    v_campos := array_append(v_campos, 'correo_institucional');
    v_sensibles := array_append(v_sensibles, 'tu correo institucional');
  end if;
  if (p_nomina_entidad, p_nomina_tipo, p_nomina_numero)
     is distinct from (v_actual.nomina_entidad, v_actual.nomina_tipo, v_actual.nomina_numero) then
    v_campos := array_append(v_campos, 'nomina');
    v_sensibles := array_append(v_sensibles, 'tu cuenta de nómina');
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

  -- RS-M2: el asociado se entera la próxima vez que entra (sin los valores nuevos).
  if cardinality(v_sensibles) > 0 then
    insert into public.avisos_asociados (titulo, mensaje, creado_por, destinatario_id)
    values (
      'Actualizamos tus datos',
      'El ' || v_fecha || ' la cooperativa actualizó ' || array_to_string(v_sensibles, ' y ') ||
        '. Si no pediste este cambio, escríbenos por WhatsApp.',
      v_uid,
      p_asociado_id
    );
  end if;

  return v_campos;
end;
$$;
revoke all on function public.admin_editar_datos_asociado(uuid, text, text, text, text, public.tipo_cuenta_nomina, text) from public, anon;
grant execute on function public.admin_editar_datos_asociado(uuid, text, text, text, text, public.tipo_cuenta_nomina, text) to authenticated;
