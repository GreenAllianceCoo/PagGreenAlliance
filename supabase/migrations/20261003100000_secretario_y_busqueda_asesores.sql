-- ============================================================
-- Rol «secretario» y búsqueda general para asesores (reunión del 1-oct).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20261003000000_comprobante_desembolso_y_eliminacion.sql.
--
-- NOTA SOBRE EL ENUM: `alter type ... add value` no deja USAR el valor nuevo
-- dentro de la misma transacción. Por eso, en TODO este archivo el rol se
-- compara como texto (`p.rol::text = 'secretario'`) y nunca con un literal
-- del enum. Las funciones y las políticas funcionan cuando la transacción
-- termina; ningún dato se inserta aquí con ese valor.
--
-- 1) Rol secretario: ve el Resumen y ve/edita afiliaciones (estado y asesor
--    del asociado). NO tiene es_admin(): todo lo demás sigue siendo solo admin.
-- 2) Historial de afiliaciones y de cambios de rol (quién y cuándo).
-- 3) Búsqueda general para asesores: nombre, cédula enmascarada y asesor.
-- Idempotente.
-- ============================================================

alter type public.rol_usuario add value if not exists 'secretario';

-- ------------------------------------------------------------
-- 1a) Helpers
-- ------------------------------------------------------------
create or replace function public.es_secretario()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and p.rol::text = 'secretario'
      and p.activo
  );
$$;
revoke all on function public.es_secretario() from public, anon;
grant execute on function public.es_secretario() to authenticated;
comment on function public.es_secretario() is
  'true si el usuario autenticado tiene rol secretario Y está activo. NO es admin: solo lo usan las políticas y funciones que le dan acceso a afiliaciones y al resumen.';

create or replace function public.es_admin_o_secretario()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.es_admin(), false) or coalesce(public.es_secretario(), false);
$$;
revoke all on function public.es_admin_o_secretario() from public, anon;
grant execute on function public.es_admin_o_secretario() to authenticated;
comment on function public.es_admin_o_secretario() is
  'true si el usuario autenticado es admin o secretario (activos). Para lo que ambos pueden ver o hacer.';

comment on type public.rol_usuario is
  'asociado: usuario normal. admin: panel de administración completo. asesor: ve un resumen de sus clientes. secretario: ve el Resumen y ve/edita afiliaciones (sin eliminar, baja, convenios, sorteo, créditos ni configuración).';

-- ------------------------------------------------------------
-- 1b) Afiliaciones: el secretario lee y actualiza (el trigger
--     proteger_solicitud_afiliacion ya limita el cambio al estado).
--     Perfiles: solo lectura (nombre del asesor, asesores disponibles, cuenta
--     ya creada). Nunca insert ni update directo sobre perfiles.
-- ------------------------------------------------------------
drop policy if exists "afiliacion_select_secretario" on public.solicitudes_afiliacion;
create policy "afiliacion_select_secretario" on public.solicitudes_afiliacion
  for select to authenticated using ((select public.es_secretario()));

drop policy if exists "afiliacion_update_secretario" on public.solicitudes_afiliacion;
create policy "afiliacion_update_secretario" on public.solicitudes_afiliacion
  for update to authenticated
  using ((select public.es_secretario()))
  with check ((select public.es_secretario()));

drop policy if exists "perfiles_select_secretario" on public.perfiles;
create policy "perfiles_select_secretario" on public.perfiles
  for select to authenticated using ((select public.es_secretario()));

-- ------------------------------------------------------------
-- 1c) Resumen del admin: también para el secretario (misma función, misma
--     salida; solo cambia quién puede pedirla).
-- ------------------------------------------------------------
create or replace function public.admin_metricas_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mes as (
    select date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota' as ini,
           (date_trunc('month', now() at time zone 'America/Bogota'))::date as ini_fecha,
           extract(year  from now() at time zone 'America/Bogota')::int as anio,
           extract(month from now() at time zone 'America/Bogota')::int as mes
  )
  select case when not coalesce((select public.es_admin_o_secretario()), false) then null else jsonb_build_object(
    'asociados_activos', (select count(*) from public.perfiles p
                          where p.rol = 'asociado'::public.rol_usuario and p.activo),
    'asociados_por_grado', coalesce((select jsonb_object_agg(g, n) from (
        select coalesce(p.grado::text, 'sin_grado') g, count(*) n
        from public.perfiles p
        where p.rol = 'asociado'::public.rol_usuario and p.activo
        group by 1) x), '{}'::jsonb),
    'asociados_por_institucion', coalesce((select jsonb_object_agg(i, n) from (
        select coalesce(p.institucion::text, 'sin_institucion') i, count(*) n
        from public.perfiles p
        where p.rol = 'asociado'::public.rol_usuario and p.activo
        group by 1) x), '{}'::jsonb),
    'afiliaciones_pendientes', (select count(*) from public.solicitudes_afiliacion a
                                where a.estado = 'pendiente'::public.estado_afiliacion),
    'creditos_pendientes', (select count(*) from public.solicitudes_credito s
                            where s.estado = 'pendiente'::public.estado_solicitud),
    'monto_solicitado_mes', (select coalesce(sum(s.monto_solicitado), 0) from public.solicitudes_credito s, mes
                             where s.fecha_solicitud >= mes.ini),
    'monto_aprobado_mes', (select coalesce(sum(s.monto_solicitado), 0) from public.solicitudes_credito s, mes
                           where s.estado = 'aprobado'::public.estado_solicitud
                             and s.fecha_respuesta >= mes.ini),
    'inscritos_sorteo_mes', (select count(distinct b.asociado_id) from public.boletas_sorteo b, mes
                             where b.anio = mes.anio and b.mes = mes.mes),
    'por_estado_proceso', coalesce((select jsonb_object_agg(e, n) from (
        select coalesce(pe.estado::text, 'sin_proceso') e, count(*) n
        from public.perfiles p
        left join public.procesos_ejecutivos pe on pe.asociado_id = p.id
        where p.rol = 'asociado'::public.rol_usuario and p.activo
        group by 1) x), '{}'::jsonb),
    'desembolsos_mes', (select jsonb_build_object('conteo', count(*),
                                                  'monto', coalesce(sum(s.monto_solicitado), 0))
                        from public.solicitudes_credito s, mes
                        where s.fecha_desembolso >= mes.ini_fecha
                          and s.fecha_desembolso < (mes.ini_fecha + interval '1 month')::date)
  ) end;
$$;
revoke all on function public.admin_metricas_dashboard() from public, anon;
grant execute on function public.admin_metricas_dashboard() to authenticated;

-- ------------------------------------------------------------
-- 1d) El secretario asigna asesor a un asociado SIN tener update sobre
--     perfiles: por esta función, que solo toca asesor_id, solo si el
--     asociado aún no tiene asesor y solo hacia alguien que puede atender.
--     El cambio queda en historial_cambio_asesor (trigger existente).
--     La bandera de sesión (local a la transacción) deja pasar ese único
--     cambio por proteger_campos_perfil; además el trigger exige es_secretario().
-- ------------------------------------------------------------
create or replace function public.secretario_asignar_asesor(p_perfil_id uuid, p_asesor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filas integer;
begin
  if not (select public.es_secretario()) then
    raise exception 'Solo un secretario puede usar esta función' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.perfiles p
     where p.id = p_perfil_id and p.rol = 'asociado'::public.rol_usuario
  ) then
    raise exception 'El asociado no existe';
  end if;
  if not public.puede_atender(p_asesor_id) then
    raise exception 'asesor_id debe ser un perfil con rol asesor';
  end if;
  perform set_config('ga.secretario_asigna_asesor', 'si', true);
  update public.perfiles
     set asesor_id = p_asesor_id
   where id = p_perfil_id and asesor_id is null;
  get diagnostics v_filas = row_count;
  perform set_config('ga.secretario_asigna_asesor', '', true);
  if v_filas = 0 then
    raise exception 'Este asociado ya tiene un asesor asignado';
  end if;
end;
$$;
revoke all on function public.secretario_asignar_asesor(uuid, uuid) from public, anon;
grant execute on function public.secretario_asignar_asesor(uuid, uuid) to authenticated;
comment on function public.secretario_asignar_asesor(uuid, uuid) is
  'Un secretario asigna asesor a un asociado que aún no tiene. No cambia ni quita un asesor ya asignado (eso es del admin).';

-- proteger_campos_perfil: igual que en 20261002600000 + el cambio de asesor_id
-- hecho por secretario_asignar_asesor(). Cualquier otro cambio del secretario
-- (rol, grado, cédula…) sigue bloqueado: nunca puede escalar su propio rol.
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
-- 2a) Historial de afiliaciones: quién cambió el estado, de cuál a cuál y cuándo.
--     Lo escribe un trigger (nadie lo escribe desde la API); lo leen admin y secretario.
-- ------------------------------------------------------------
create table if not exists public.historial_afiliaciones (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes_afiliacion (id) on delete cascade,
  actor_id        uuid references public.perfiles (id) on delete set null,
  rol_actor       text,
  estado_anterior public.estado_afiliacion,
  estado_nuevo    public.estado_afiliacion not null,
  created_at      timestamptz not null default now()
);
comment on table public.historial_afiliaciones is
  'Cambios de estado de solicitudes_afiliacion (quién, con qué rol y cuándo). Lo escribe un trigger; lo leen admin y secretario.';
create index if not exists ix_historial_afiliaciones_solicitud on public.historial_afiliaciones (solicitud_id, created_at desc);
create index if not exists ix_historial_afiliaciones_actor on public.historial_afiliaciones (actor_id);
alter table public.historial_afiliaciones enable row level security;
revoke all on public.historial_afiliaciones from anon, authenticated;
grant select on public.historial_afiliaciones to authenticated;
drop policy if exists "historial_afiliaciones_select" on public.historial_afiliaciones;
create policy "historial_afiliaciones_select" on public.historial_afiliaciones
  for select to authenticated
  using ((select public.es_admin_o_secretario()));

create or replace function public.registrar_historial_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.historial_afiliaciones (solicitud_id, actor_id, rol_actor, estado_anterior, estado_nuevo)
    values (
      new.id,
      (select p.id from public.perfiles p where p.id = auth.uid()),
      (select p.rol::text from public.perfiles p where p.id = auth.uid()),
      old.estado,
      new.estado
    );
  end if;
  return new;
end;
$$;
revoke all on function public.registrar_historial_afiliacion() from public, anon, authenticated;
drop trigger if exists tr_registrar_historial_afiliacion on public.solicitudes_afiliacion;
create trigger tr_registrar_historial_afiliacion
  after update of estado on public.solicitudes_afiliacion
  for each row execute function public.registrar_historial_afiliacion();

-- ------------------------------------------------------------
-- 2b) Historial de cambios de rol (quién convirtió a quién en secretario/asesor).
-- ------------------------------------------------------------
create table if not exists public.historial_cambio_rol (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.perfiles (id) on delete cascade,
  actor_id     uuid references public.perfiles (id) on delete set null,
  rol_anterior text not null,
  rol_nuevo    text not null,
  created_at   timestamptz not null default now()
);
comment on table public.historial_cambio_rol is
  'Cambios de perfiles.rol (quién y cuándo). Lo escribe un trigger; solo lo lee el admin.';
create index if not exists ix_historial_rol_perfil on public.historial_cambio_rol (perfil_id, created_at desc);
create index if not exists ix_historial_rol_actor on public.historial_cambio_rol (actor_id);
alter table public.historial_cambio_rol enable row level security;
revoke all on public.historial_cambio_rol from anon, authenticated;
grant select on public.historial_cambio_rol to authenticated;
drop policy if exists "historial_rol_select_admin" on public.historial_cambio_rol;
create policy "historial_rol_select_admin" on public.historial_cambio_rol
  for select to authenticated
  using ((select public.es_admin()));

create or replace function public.registrar_cambio_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rol is distinct from old.rol then
    insert into public.historial_cambio_rol (perfil_id, actor_id, rol_anterior, rol_nuevo)
    values (new.id, (select p.id from public.perfiles p where p.id = auth.uid()), old.rol::text, new.rol::text);
  end if;
  return new;
end;
$$;
revoke all on function public.registrar_cambio_rol() from public, anon, authenticated;
drop trigger if exists tr_registrar_cambio_rol on public.perfiles;
create trigger tr_registrar_cambio_rol
  after update of rol on public.perfiles
  for each row execute function public.registrar_cambio_rol();

-- ------------------------------------------------------------
-- 3) Búsqueda general para asesores.
--    Devuelve SOLO: nombre, cédula enmascarada y a quién pertenece el
--    asociado («Cooperativa» si lo atiende un administrador, el nombre del
--    asesor, o «Sin asesor»). Sin estados, créditos ni contacto.
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
                when a.rol = 'admin'::public.rol_usuario then 'Cooperativa'
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
                when a.rol = 'admin'::public.rol_usuario then 'Cooperativa'
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
  'Búsqueda general de asociados activos por nombre o cédula para asesores: nombre, cédula enmascarada y asesor. Mínimo 4 caracteres, máximo 10 resultados. Solo puede_atender().';
