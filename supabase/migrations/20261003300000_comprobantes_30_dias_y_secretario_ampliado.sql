-- ============================================================
-- 2026-10-02 — Diferencias que quedaron FUERA de producción.
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Producción ya tiene 20261003000000, 20261003100000 y 20261003200000 en su
-- versión del commit 7d3249a. Después se editaron esos archivos en el lugar;
-- esos cambios se restauraron y se traen AQUÍ, como migración nueva:
--
--  A. Comprobantes de desembolso de un asociado eliminado: se conservan 30 días
--     (solicitudes_credito.comprobante_borrar_at) y los borra la tarea
--     programada (comprobantes_vencidos / liberar_comprobantes /
--     comprobantes_huerfanos, solo service_role). admin_registrar_comprobante
--     rechaza créditos de un asociado eliminado. admin_confirmar_eliminacion ya
--     no borra los comprobantes en el acto (versión de 20261003200000 + este cambio).
--  B. Secretario ampliado: ve Asociados y Créditos en solo lectura (sin tasa) y
--     cambia el estado del proceso ejecutivo (normalizar_proceso_ejecutivo y
--     admin_actualizar_proceso_ejecutivo aceptan es_admin_o_secretario()).
--  C. Nadie (ni un admin) cambia su propio rol (proteger_campos_perfil).
--  D. Cambio de rol del equipo con motivo (admin_cambiar_rol_equipo,
--     historial_cambio_rol.motivo) y asesor anterior/nuevo en
--     historial_cambio_asesor.
--  E. «Historial del equipo» (admin_historial_equipo, solo admin).
--  F. Búsqueda de asesores: muestra el nombre del admin que atiende (antes
--     «Cooperativa»).
-- Idempotente.
-- ============================================================

-- ============================================================
-- A. Comprobantes guardados 30 días
-- ============================================================
alter table public.solicitudes_credito
  add column if not exists comprobante_borrar_at timestamptz;

comment on column public.solicitudes_credito.comprobante_borrar_at is
  'Borrado programado del comprobante (eliminación definitiva del asociado + 30 días). La tarea programada lo borra de Storage y limpia la referencia al vencer.';

grant select (comprobante_subido_at, comprobante_borrar_at) on public.solicitudes_credito to authenticated;

create index if not exists ix_solicitudes_comprobante_borrar_at
  on public.solicitudes_credito (comprobante_borrar_at) where comprobante_borrar_at is not null;

-- ------------------------------------------------------------
-- A.3 RPC del admin: registrar / reemplazar el comprobante
--     Devuelve la ruta ANTERIOR (null si no había) para borrarla de Storage.
-- ------------------------------------------------------------
create or replace function public.admin_registrar_comprobante(p_solicitud_id uuid, p_ruta text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes_credito%rowtype;
  v_anterior text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede subir comprobantes';
  end if;
  if p_solicitud_id is null or p_ruta is null then
    raise exception 'Faltan datos del comprobante';
  end if;

  select * into v_sol from public.solicitudes_credito s where s.id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe';
  end if;
  if v_sol.fecha_desembolso is null then
    raise exception 'Primero marca el desembolso de este crédito';
  end if;
  if v_sol.asociado_id = auth.uid() then
    raise exception 'No puede subir el comprobante de su propio crédito; debe hacerlo otro administrador';
  end if;
  if exists (select 1 from public.perfiles pe where pe.id = v_sol.asociado_id and pe.eliminado_at is not null) then
    raise exception 'Este asociado ya fue eliminado; su comprobante ya no se puede cambiar';
  end if;
  if p_ruta !~ ('^' || p_solicitud_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') then
    raise exception 'La ruta del comprobante no es válida';
  end if;
  if not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'comprobantes-desembolso' and o.name = p_ruta
  ) then
    raise exception 'El archivo del comprobante no se encontró';
  end if;

  v_anterior := v_sol.comprobante_path;

  update public.solicitudes_credito s
     set comprobante_path = p_ruta,
         comprobante_subido_at = now(),
         comprobante_subido_por = auth.uid()
   where s.id = p_solicitud_id;

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values ('solicitud_credito'::public.historial_entidad, p_solicitud_id, auth.uid(),
          'comprobante_desembolso',
          case when v_anterior is null then 'Comprobante subido' else 'Comprobante reemplazado' end);

  return v_anterior;
end;
$$;
revoke all on function public.admin_registrar_comprobante(uuid, text) from public, anon;
grant execute on function public.admin_registrar_comprobante(uuid, text) to authenticated;

-- Eliminar definitivamente: igual que 20261003200000 (con la foto del carné),
-- pero los comprobantes NO se borran en el acto: se programan a 30 días.
create or replace function public.admin_confirmar_eliminacion(
  p_admin_id    uuid,
  p_solicitud_id uuid,
  p_codigo_hash text
)
returns table (resultado text, intentos_restantes integer, archivos text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol      public.solicitudes_eliminacion_asociado%rowtype;
  v_perfil   public.perfiles%rowtype;
  v_archivos text[];
begin
  select * into v_sol from public.solicitudes_eliminacion_asociado s
   where s.id = p_solicitud_id for update;
  if not found or v_sol.admin_id is distinct from p_admin_id then
    return query select 'no_existe'::text, 0, null::text[];
    return;
  end if;

  if v_sol.estado = 'ejecutada' and v_sol.limpieza_pendiente then
    return query select 'ok'::text, 0, coalesce(v_sol.archivos, '{}'::text[]);
    return;
  end if;
  if v_sol.estado <> 'pendiente' then
    return query select (case when v_sol.estado = 'bloqueada' then 'bloqueada'
                              when v_sol.estado = 'vencida' then 'vencida'
                              else 'no_existe' end)::text, 0, null::text[];
    return;
  end if;
  if v_sol.expira_at < now() then
    update public.solicitudes_eliminacion_asociado s
       set estado = 'vencida', resuelta_at = now(), codigo_hash = null where s.id = v_sol.id;
    return query select 'vencida'::text, 0, null::text[];
    return;
  end if;
  if v_sol.intentos >= 3 then
    update public.solicitudes_eliminacion_asociado s
       set estado = 'bloqueada', resuelta_at = now(), codigo_hash = null where s.id = v_sol.id;
    return query select 'bloqueada'::text, 0, null::text[];
    return;
  end if;

  if p_codigo_hash is distinct from v_sol.codigo_hash then
    if v_sol.intentos + 1 >= 3 then
      update public.solicitudes_eliminacion_asociado s
         set intentos = 3, estado = 'bloqueada', resuelta_at = now(), codigo_hash = null where s.id = v_sol.id;
      return query select 'bloqueada'::text, 0, null::text[];
    else
      update public.solicitudes_eliminacion_asociado s
         set intentos = s.intentos + 1 where s.id = v_sol.id;
      return query select 'codigo_incorrecto'::text, 3 - (v_sol.intentos + 1), null::text[];
    end if;
    return;
  end if;

  -- Código correcto: se vuelven a comprobar las reglas (pudo cambiar algo en 10 minutos).
  perform public.validar_eliminacion_asociado(p_admin_id, v_sol.asociado_id);
  select * into v_perfil from public.perfiles p where p.id = v_sol.asociado_id for update;

  -- Archivos de Storage a borrar ya (afiliación y foto del carné), antes de limpiar las filas.
  -- Los comprobantes de desembolso NO van aquí: se guardan 30 días (más abajo).
  v_archivos :=
    coalesce((
      select array_agg('afiliacion-documentos/' || regexp_replace(f.ruta, '^afiliacion-documentos/', ''))
        from public.solicitudes_afiliacion sa
        cross join lateral unnest(array[sa.foto_cedula_frente, sa.foto_cedula_reverso, sa.foto_selfie]) as f(ruta)
       where sa.cedula = v_perfil.cedula and f.ruta is not null
    ), '{}'::text[])
    || coalesce((
      select array_agg('fotos-carne/' || fc.ruta)
        from public.fotos_carne fc
       where fc.asociado_id = v_perfil.id
    ), '{}'::text[]);

  -- Datos personales fuera.
  delete from public.solicitudes_afiliacion sa where sa.cedula = v_perfil.cedula;
  delete from public.solicitudes_recuperacion_acceso r where r.perfil_id = v_perfil.id;
  delete from public.carne_tokens t where t.asociado_id = v_perfil.id;
  delete from public.fotos_carne fc where fc.asociado_id = v_perfil.id;
  delete from public.historial_foto_carne hf where hf.asociado_id = v_perfil.id;
  update public.historial_cambio_correo_ingreso h
     set motivo = 'Registro anonimizado'
   where h.perfil_id = v_perfil.id;
  -- Comprobantes de desembolso: se conservan 30 días, solo visibles al admin; luego los borra la tarea programada.
  update public.solicitudes_credito sc
     set comprobante_borrar_at = now() + interval '30 days'
   where sc.asociado_id = v_perfil.id and sc.comprobante_path is not null;

  update public.perfiles p
     set nombre_completo = 'Asociado eliminado',
         cedula = 'ELIMINADO-' || substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12),
         telefono = null,
         correo_institucional = null,
         nomina_entidad = null,
         nomina_tipo = null,
         nomina_numero = null,
         avisar_apertura_sorteo = false,
         atiende_asociados = false,
         activo = false,
         eliminado_at = now()
   where p.id = v_perfil.id;

  insert into public.eliminaciones_asociados (asociado_id, solicitud_id, admin_id, motivo)
  values (v_perfil.id, v_sol.id, p_admin_id, v_sol.motivo);

  update public.solicitudes_eliminacion_asociado s
     set estado = 'ejecutada', resuelta_at = now(), codigo_hash = null,
         intentos = s.intentos + 1, limpieza_pendiente = true, archivos = v_archivos
   where s.id = v_sol.id;

  return query select 'ok'::text, 0, v_archivos;
end;
$$;
revoke all on function public.admin_confirmar_eliminacion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_confirmar_eliminacion(uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- C. Tarea programada: borrar comprobantes vencidos y huérfanos (SOLO service_role)
-- ------------------------------------------------------------
-- Comprobantes de asociados eliminados cuyo plazo de 30 días ya venció.
create or replace function public.comprobantes_vencidos(p_limite integer default 200)
returns table (solicitud_id uuid, ruta text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.comprobante_path
    from public.solicitudes_credito s
   where s.comprobante_path is not null
     and s.comprobante_borrar_at is not null
     and s.comprobante_borrar_at <= now()
   order by s.comprobante_borrar_at, s.id
   limit greatest(coalesce(p_limite, 200), 0);
$$;
revoke all on function public.comprobantes_vencidos(integer) from public, anon, authenticated;
grant execute on function public.comprobantes_vencidos(integer) to service_role;

-- Después de borrar el archivo de Storage: limpia la referencia (solo si ya venció).
create or replace function public.liberar_comprobantes(p_solicitud_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.solicitudes_credito s
     set comprobante_path = null, comprobante_subido_at = null, comprobante_borrar_at = null
   where s.id = any (coalesce(p_solicitud_ids, '{}'::uuid[]))
     and s.comprobante_borrar_at is not null
     and s.comprobante_borrar_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.liberar_comprobantes(uuid[]) from public, anon, authenticated;
grant execute on function public.liberar_comprobantes(uuid[]) to service_role;

-- Archivos subidos y nunca ligados a una solicitud, con más de 24 h.
create or replace function public.comprobantes_huerfanos(p_limite integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'comprobantes-desembolso'
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.solicitudes_credito s where s.comprobante_path = o.name)
   order by o.created_at, o.name
   limit greatest(coalesce(p_limite, 500), 0);
$$;
revoke all on function public.comprobantes_huerfanos(integer) from public, anon, authenticated;
grant execute on function public.comprobantes_huerfanos(integer) to service_role;

-- ============================================================
-- B–F. Secretario ampliado, cambio de rol, historial del equipo y búsqueda
-- ============================================================
comment on type public.rol_usuario is
  'asociado: usuario normal. admin: panel de administración completo. asesor: ve un resumen de sus clientes. secretario: ve el Resumen, ve/edita afiliaciones, ve Asociados y Créditos en solo lectura (sin tasa) y cambia el proceso ejecutivo (sin baja, eliminar, habilitar crédito, correo de ingreso, aprobar/desembolsar créditos, convenios, sorteo ni configuración).';


-- Créditos y proceso ejecutivo: SOLO lectura. La tasa de interés sigue sin
-- poder leerla nadie por la API (privilegios por columna de
-- 20260930100300; el admin la pide con admin_tasas_solicitudes, solo admin).
-- Sin insert/update/delete: aprobar, rechazar y desembolsar siguen siendo del admin.
drop policy if exists "solicitudes_select_secretario" on public.solicitudes_credito;
create policy "solicitudes_select_secretario" on public.solicitudes_credito
  for select to authenticated using ((select public.es_secretario()));

drop policy if exists "procesos_select_secretario" on public.procesos_ejecutivos;
create policy "procesos_select_secretario" on public.procesos_ejecutivos
  for select to authenticated using ((select public.es_secretario()));

drop policy if exists "historial_proceso_select_secretario" on public.historial_proceso_ejecutivo;
create policy "historial_proceso_select_secretario" on public.historial_proceso_ejecutivo
  for select to authenticated using ((select public.es_secretario()));

-- El secretario cambia el estado del proceso ejecutivo (y la fecha de inicio
-- del embargo) SOLO por la función de abajo; la tabla sigue sin privilegios de
-- escritura. Mismas reglas que el admin (nadie cambia su propio proceso).
create or replace function public.normalizar_proceso_ejecutivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if auth.uid() is not null then
    if not public.es_admin_o_secretario() then
      raise exception 'Solo un administrador puede cambiar el proceso ejecutivo';
    end if;
    if new.asociado_id = auth.uid() then
      raise exception 'Otro administrador debe actualizar tu propio proceso';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.asociado_id is distinct from old.asociado_id then
      raise exception 'El proceso no puede cambiar de asociado';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;

  if new.estado < 'operando'::public.estado_proceso_ejecutivo then
    new.fecha_inicio_embargo := null;
  elsif new.estado = 'operando'::public.estado_proceso_ejecutivo and new.fecha_inicio_embargo is null then
    new.fecha_inicio_embargo := v_hoy;
  end if;

  if new.fecha_inicio_embargo is not null and new.fecha_inicio_embargo > v_hoy + 31 then
    raise exception 'La fecha de inicio del embargo no puede estar a más de un mes en el futuro';
  end if;

  new.actualizado_por := auth.uid();
  new.updated_at      := now();
  return new;
end;
$$;
revoke all on function public.normalizar_proceso_ejecutivo() from public, anon, authenticated;

create or replace function public.admin_actualizar_proceso_ejecutivo(
  p_asociado_id          uuid,
  p_estado               public.estado_proceso_ejecutivo,
  p_fecha_inicio_embargo date default null
)
returns public.procesos_ejecutivos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.procesos_ejecutivos;
begin
  if not (select public.es_admin_o_secretario()) then
    raise exception 'Solo un administrador puede cambiar el proceso ejecutivo';
  end if;
  if p_asociado_id is null or p_estado is null then
    raise exception 'Faltan datos para actualizar el proceso ejecutivo';
  end if;
  if not exists (select 1 from public.perfiles p where p.id = p_asociado_id) then
    raise exception 'No existe ese asociado';
  end if;
  if p_fecha_inicio_embargo is not null
     and p_estado < 'operando'::public.estado_proceso_ejecutivo then
    raise exception 'La fecha de inicio del embargo solo se registra desde el paso «Operando»';
  end if;

  insert into public.procesos_ejecutivos as pe (asociado_id, estado, fecha_inicio_embargo)
  values (p_asociado_id, p_estado, p_fecha_inicio_embargo)
  on conflict (asociado_id) do update
     set estado = excluded.estado,
         fecha_inicio_embargo = coalesce(excluded.fecha_inicio_embargo, pe.fecha_inicio_embargo)
  returning pe.* into v_fila;

  return v_fila;
end;
$$;
revoke all on function public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date) from public, anon;
grant execute on function public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date) to authenticated;
comment on function public.admin_actualizar_proceso_ejecutivo(uuid, public.estado_proceso_ejecutivo, date) is
  'Admin o secretario (lo revisa la función). Crea o cambia el estado del proceso ejecutivo; al pasar a operando fija la fecha de inicio (hoy si no se manda). Deja historial con quién lo hizo.';

-- ------------------------------------------------------------
-- C) proteger_campos_perfil: como en 20261003100000 + nadie cambia su propio rol.
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
    -- Ni siquiera un admin cambia su propio rol: debe hacerlo otro admin.
    if new.rol is distinct from old.rol and new.id = auth.uid() then raise exception 'No puede modificar su propio rol'; end if;

    if not public.es_admin() then
      if new.rol is distinct from old.rol then raise exception 'No puede modificar su propio rol'; end if;
      if new.grado is distinct from old.grado then raise exception 'No puede modificar su propio grado; solicítelo a la administración'; end if;
      if new.cedula is distinct from old.cedula then raise exception 'No puede modificar su número de cédula'; end if;
      if new.nombre_completo is distinct from old.nombre_completo then raise exception 'No puede modificar su nombre; solicítelo a la administración'; end if;
      if new.asesor_id is distinct from old.asesor_id
         and not (public.es_secretario() and coalesce(current_setting('ga.secretario_asigna_asesor', true), '') = 'si') then
        raise exception 'No puede modificar su propio asesor; solicítelo a la administración';
      end if;
      if new.institucion is distinct from old.institucion then raise exception 'No puede modificar su institución; solicítelo a la administración'; end if;
      if new.activo is distinct from old.activo then raise exception 'No puede modificar su estado de asociado; solicítelo a la administración'; end if;
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
-- D) Motivo en el historial de cambios de rol.
-- ------------------------------------------------------------
alter table public.historial_cambio_rol
  add column if not exists motivo text check (motivo is null or char_length(motivo) between 5 and 300);
comment on table public.historial_cambio_rol is
  'Cambios de perfiles.rol (quién, cuándo y, si lo hizo admin_cambiar_rol_equipo, el motivo). Lo escribe un trigger; solo lo lee el admin.';

create or replace function public.registrar_cambio_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rol is distinct from old.rol then
    insert into public.historial_cambio_rol (perfil_id, actor_id, rol_anterior, rol_nuevo, motivo)
    values (
      new.id,
      (select p.id from public.perfiles p where p.id = auth.uid()),
      old.rol::text,
      new.rol::text,
      nullif(btrim(coalesce(current_setting('ga.motivo_cambio_rol', true), '')), '')
    );
  end if;
  return new;
end;
$$;
revoke all on function public.registrar_cambio_rol() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2c) Admin: cambiar el rol de un miembro del equipo, con motivo.
--     Solo estas transiciones: secretario -> asesor, secretario -> admin y
--     asesor -> secretario (un asesor con clientes no pasa a secretario:
--     primero hay que reasignarlos). Nunca el propio rol. Queda en
--     historial_cambio_rol con el motivo.
-- ------------------------------------------------------------
create or replace function public.admin_cambiar_rol_equipo(p_perfil_id uuid, p_rol text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual text;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede cambiar el rol del equipo' using errcode = '42501';
  end if;
  if p_perfil_id is null or p_rol is null then
    raise exception 'Faltan datos para cambiar el rol';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;
  if p_perfil_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol; debe hacerlo otro administrador';
  end if;
  select p.rol::text into v_actual from public.perfiles p where p.id = p_perfil_id for update;
  if not found then
    raise exception 'La persona no existe';
  end if;
  if not (
       (v_actual = 'secretario' and p_rol in ('asesor', 'admin'))
    or (v_actual = 'asesor' and p_rol = 'secretario')
  ) then
    raise exception 'Ese cambio de rol no está permitido';
  end if;
  if p_rol = 'secretario' and exists (select 1 from public.perfiles c where c.asesor_id = p_perfil_id) then
    raise exception 'Tiene clientes asignados; reasígnalos antes de pasarlo a secretario';
  end if;

  perform set_config('ga.motivo_cambio_rol', v_motivo, true);
  update public.perfiles p set rol = p_rol::public.rol_usuario where p.id = p_perfil_id;
  perform set_config('ga.motivo_cambio_rol', '', true);
end;
$$;
revoke all on function public.admin_cambiar_rol_equipo(uuid, text, text) from public, anon;
grant execute on function public.admin_cambiar_rol_equipo(uuid, text, text) to authenticated;
comment on function public.admin_cambiar_rol_equipo(uuid, text, text) is
  'Solo admin. Cambia el rol de un miembro del equipo (secretario<->asesor/admin) con motivo obligatorio; queda en historial_cambio_rol. No el propio.';

-- ------------------------------------------------------------
-- 2d) Historial de asignaciones de asesor: ahora guarda también de quién a
--     quién (para el «Historial del equipo»). Los registros viejos quedan sin esos datos.
-- ------------------------------------------------------------
alter table public.historial_cambio_asesor
  add column if not exists asesor_anterior_id uuid references public.perfiles (id) on delete set null,
  add column if not exists asesor_nuevo_id    uuid references public.perfiles (id) on delete set null;
create index if not exists ix_historial_asesor_anterior on public.historial_cambio_asesor (asesor_anterior_id);
create index if not exists ix_historial_asesor_nuevo on public.historial_cambio_asesor (asesor_nuevo_id);

create or replace function public.registrar_cambio_asesor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asesor_id is distinct from old.asesor_id then
    insert into public.historial_cambio_asesor (perfil_id, actor_id, asesor_anterior_id, asesor_nuevo_id)
    values (new.id, (select p.id from public.perfiles p where p.id = auth.uid()), old.asesor_id, new.asesor_id);
  end if;
  return new;
end;
$$;
revoke all on function public.registrar_cambio_asesor() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2e) «Historial del equipo» (solo admin): lo que hicieron admins y secretarios,
--     reunido de los historiales que ya existen. Filtros por persona y fechas
--     (días de Colombia, ambos incluidos); paginado (total en cada fila).
-- ------------------------------------------------------------
create or replace function public.admin_historial_equipo(
  p_actor  uuid default null,
  p_desde  date default null,
  p_hasta  date default null,
  p_limite integer default 25,
  p_pagina integer default 1
)
returns table (
  cuando         timestamptz,
  actor_id       uuid,
  actor_nombre   text,
  actor_rol      text,
  tipo           text,
  objetivo       text,
  detalle        text,
  extra          text,
  motivo         text,
  total          bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 25), 1), 100);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
begin
  if not (select public.es_admin()) then
    raise exception 'Solo un administrador puede ver el historial del equipo' using errcode = '42501';
  end if;

  return query
  with ev as (
    -- Afiliaciones: quién cambió el estado.
    select h.created_at as cuando, h.actor_id as actor, 'afiliacion'::text as tipo,
           coalesce(s.nombre, 'un solicitante') as objetivo,
           h.estado_nuevo::text as detalle, h.estado_anterior::text as extra, null::text as motivo
      from public.historial_afiliaciones h
      join public.solicitudes_afiliacion s on s.id = h.solicitud_id
    union all
    -- Proceso ejecutivo.
    select h.created_at, h.admin_id, 'proceso',
           coalesce(a.nombre_completo, 'un asociado'),
           h.estado_nuevo::text, h.fecha_inicio_embargo::text, null
      from public.historial_proceso_ejecutivo h
      left join public.perfiles a on a.id = h.asociado_id
    union all
    -- Asignaciones de asesor.
    select h.created_at, h.actor_id, 'asesor',
           coalesce(a.nombre_completo, 'un asociado'),
           (select n.nombre_completo from public.perfiles n where n.id = h.asesor_nuevo_id),
           (select n.nombre_completo from public.perfiles n where n.id = h.asesor_anterior_id), null
      from public.historial_cambio_asesor h
      left join public.perfiles a on a.id = h.perfil_id
    union all
    -- Cambios de rol.
    select h.created_at, h.actor_id, 'rol',
           coalesce(a.nombre_completo, 'una persona'),
           h.rol_nuevo, h.rol_anterior, h.motivo
      from public.historial_cambio_rol h
      left join public.perfiles a on a.id = h.perfil_id
    union all
    -- Bajas, reactivaciones y desactivaciones del equipo.
    select h.created_at, h.admin_id, 'estado',
           coalesce(a.nombre_completo, 'una persona'),
           h.activo_nuevo::text, a.rol::text, h.motivo
      from public.historial_estado_asociado h
      left join public.perfiles a on a.id = h.asociado_id
    union all
    -- Créditos: aprobar, rechazar, desembolsar, habilitar, comprobante.
    select h.created_at, h.actor_id, 'credito',
           coalesce(a.nombre_completo, 'un asociado'),
           h.accion,
           null,
           case when h.accion in ('rechazado', 'credito_habilitado') then h.detalle end
      from public.historial_solicitudes h
      join public.solicitudes_credito c on c.id = h.entidad_id
      left join public.perfiles a on a.id = c.asociado_id
     where h.entidad = 'solicitud_credito'::public.historial_entidad
       and h.accion in ('aprobado', 'rechazado', 'desembolsado', 'credito_habilitado', 'comprobante_desembolso')
  )
  select e.cuando, e.actor, p.nombre_completo::text, p.rol::text, e.tipo, e.objetivo, e.detalle, e.extra, e.motivo,
         count(*) over ()
    from ev e
    join public.perfiles p on p.id = e.actor and p.rol::text <> 'asociado'
   where (p_actor is null or e.actor = p_actor)
     and (p_desde is null or (e.cuando at time zone 'America/Bogota')::date >= p_desde)
     and (p_hasta is null or (e.cuando at time zone 'America/Bogota')::date <= p_hasta)
   order by e.cuando desc, e.tipo
   limit v_limite offset (v_pagina - 1) * v_limite;
end;
$$;
revoke all on function public.admin_historial_equipo(uuid, date, date, integer, integer) from public, anon;
grant execute on function public.admin_historial_equipo(uuid, date, date, integer, integer) to authenticated;
comment on function public.admin_historial_equipo(uuid, date, date, integer, integer) is
  'Solo admin. Lo que hicieron admins, secretarios y asesores (afiliaciones, proceso ejecutivo, asesor, rol, bajas, créditos), más reciente primero, filtrable por persona y fechas y paginado.';

-- ------------------------------------------------------------
-- 3) Búsqueda general para asesores.
--    Devuelve SOLO: nombre, cédula enmascarada y a quién pertenece el
--    asociado (el nombre de quien lo atiende, sea asesor o administrador, o
--    «Sin asesor»). Sin estados, créditos ni contacto.
--    Mínimo 4 caracteres (4 dígitos si es una cédula), máximo 10 resultados,
--    solo asociados activos. Solo quien puede atender (asesor activo o admin
--    con «Atiende asociados»). El límite por minuto lo pone el servidor
--    (dentroDelLimite) porque aquí no hay forma de contar sin una tabla.
-- ------------------------------------------------------------
create or replace function public.buscar_asociados_general(p_texto text)
returns table (nombre text, cedula_enmascarada text, asesor_texto text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_texto   text := btrim(coalesce(p_texto, ''));
  v_digitos text := regexp_replace(btrim(coalesce(p_texto, '')), '[\s.\-]', '', 'g');
  v_patron  text;
begin
  if auth.uid() is null or not public.puede_atender(auth.uid()) then
    raise exception 'Solo los asesores pueden buscar asociados' using errcode = '42501';
  end if;

  if v_digitos ~ '^[0-9]+$' then
    if char_length(v_digitos) < 4 or char_length(v_digitos) > 10 then
      return;
    end if;
    return query
      select p.nombre_completo::text,
             public.enmascarar_cedula(p.cedula),
             (case
                when p.asesor_id is null then 'Sin asesor'
                else coalesce(a.nombre_completo, 'Sin asesor')
              end)::text
        from public.perfiles p
        left join public.perfiles a on a.id = p.asesor_id
       where p.rol = 'asociado'::public.rol_usuario
         and p.activo
         and p.cedula like '%' || v_digitos || '%'
       order by p.nombre_completo
       limit 10;
  else
    if char_length(v_texto) < 4 or char_length(v_texto) > 60 then
      return;
    end if;
    v_patron := '%' || replace(replace(replace(v_texto, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    return query
      select p.nombre_completo::text,
             public.enmascarar_cedula(p.cedula),
             (case
                when p.asesor_id is null then 'Sin asesor'
                else coalesce(a.nombre_completo, 'Sin asesor')
              end)::text
        from public.perfiles p
        left join public.perfiles a on a.id = p.asesor_id
       where p.rol = 'asociado'::public.rol_usuario
         and p.activo
         and p.nombre_completo ilike v_patron
       order by p.nombre_completo
       limit 10;
  end if;
end;
$$;
revoke all on function public.buscar_asociados_general(text) from public, anon;
grant execute on function public.buscar_asociados_general(text) to authenticated;
comment on function public.buscar_asociados_general(text) is
  'Búsqueda general de asociados activos por nombre o cédula para asesores: nombre, cédula enmascarada y nombre de quien lo atiende (asesor o admin). Mínimo 4 caracteres, máximo 10 resultados. Solo puede_atender().';
