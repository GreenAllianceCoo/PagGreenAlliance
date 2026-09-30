-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — Hallazgos de base de
-- docs/auditorias/2026-09-30-seguridad-requerimientos-ricardo.md
-- (RS-01, RS-05, RS-09, RS-10, RS-11, RS-12).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260930100300_ocultar_tasa_solicitudes_credito.sql.
-- No reescribe ninguna migración anterior: reemplaza funciones con
-- `create or replace` (o drop + create si cambia el tipo de retorno).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- RS-05: un admin dado de baja (perfiles.activo = false) deja de ser admin.
-- Afecta TODAS las políticas y funciones que usan es_admin().
-- ------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and p.rol = 'admin'::public.rol_usuario
      and p.activo
  );
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;
comment on function public.es_admin() is
  'Indica si el usuario autenticado tiene rol admin Y está activo (RS-05). SECURITY DEFINER para evitar la recursión de RLS en perfiles.';

-- ------------------------------------------------------------
-- RS-01 + RS-10: pagos de comisión
--   * Nadie registra, corrige ni anula pagos a su propio nombre (Ricardo es
--     admin y atiende asociados: otro admin debe hacerlo).
--   * Al crear: anulado = false y campos de anulación en null (no se puede
--     insertar un pago «ya anulado» atribuido a otra persona).
--   * Tope del monto: 10.000.000 por pago (en valor absoluto, también para
--     ajustes). Ningún concepto de la presentación pasa de 1.000.000 (el bono
--     de 50 embargos); el tope deja margen para un pago acumulado de varios
--     meses y frena un error de dedo (100.000.000). Si la cooperativa
--     necesita más, se sube con otra migración.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_comision_monto_tope_chk') then
    alter table public.pagos_comision
      add constraint pagos_comision_monto_tope_chk check (abs(monto) <= 10000000);
  end if;
end $$;

create or replace function public.sellar_pago_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo para admins: a un no admin lo frena RLS (42501) después de este trigger.
  if auth.uid() is not null and public.es_admin() and new.asesor_id = auth.uid() then
    raise exception 'Otro administrador debe registrar tus comisiones';
  end if;
  if not public.puede_atender(new.asesor_id) then
    raise exception 'El pago debe ser para un asesor activo';
  end if;
  -- Quién y cuándo: siempre del servidor. Un pago nace vigente.
  new.registrado_por   := auth.uid();
  new.created_at       := now();
  new.anulado          := false;
  new.anulado_por      := null;
  new.anulado_at       := null;
  new.motivo_anulacion := null;
  return new;
end;
$$;
revoke all on function public.sellar_pago_comision() from public, anon, authenticated;

-- Corregir o anular: la regla va en el trigger, así cubre las dos RPC y
-- cualquier camino futuro.
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

  if auth.uid() is not null and old.asesor_id = auth.uid() then
    raise exception 'Otro administrador debe registrar tus comisiones';
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

-- ------------------------------------------------------------
-- RS-01: nadie cambia el proceso ejecutivo de sus propios clientes (lo que
-- cuenta como ingreso nuevo y cliente operativo) ni el suyo propio.
-- Se agrega al trigger normalizar_proceso_ejecutivo (cubre la RPC).
-- ------------------------------------------------------------
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
    if not public.es_admin() then
      raise exception 'Solo un administrador puede cambiar el proceso ejecutivo';
    end if;
    if new.asociado_id = auth.uid() then
      raise exception 'Otro administrador debe actualizar tu propio proceso';
    end if;
    if exists (select 1 from public.perfiles p
                where p.id = new.asociado_id and p.asesor_id = auth.uid()) then
      raise exception 'Otro administrador debe actualizar el proceso de tus clientes';
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

-- ------------------------------------------------------------
-- RS-09: cuota_mensual (columna sin uso; en solicitudes anteriores al
-- 23-sep tiene valor y tasa ≈ cuota / monto) tampoco la lee authenticated.
-- La función del admin devuelve tasa y cuota (cambia su tipo de retorno →
-- drop + create; mismo nombre, mismo parámetro).
-- ------------------------------------------------------------
revoke select (cuota_mensual) on public.solicitudes_credito from authenticated;

drop function if exists public.admin_tasas_solicitudes(uuid[]);
create function public.admin_tasas_solicitudes(p_ids uuid[])
returns table (id uuid, tasa_interes_mensual numeric, cuota_mensual numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.tasa_interes_mensual, s.cuota_mensual
  from public.solicitudes_credito s
  where (select public.es_admin())
    and s.id = any (p_ids);
$$;
revoke all on function public.admin_tasas_solicitudes(uuid[]) from public, anon;
grant execute on function public.admin_tasas_solicitudes(uuid[]) to authenticated;
comment on function public.admin_tasas_solicitudes(uuid[]) is
  'Solo admin: tasa de interés y cuota (sin uso, antiguas) de cada solicitud de la lista. Cualquier otro recibe 0 filas.';

comment on column public.solicitudes_credito.cuota_mensual is
  'Sin uso: la cuota no se calcula (null). Las antiguas pueden tener valor y revelan la tasa: authenticated no la lee (RS-09); el admin, con admin_tasas_solicitudes().';

-- ------------------------------------------------------------
-- RS-11: bitácora e historiales solo los escriben las funciones y los
-- triggers (que corren como su dueño, postgres). Se quita la escritura
-- también a service_role (la tenía por los privilegios por defecto de
-- Supabase): si la llave de servicio se filtra o el servidor se equivoca,
-- no puede fabricar entradas. service_role conserva SELECT.
-- Lo que NO se puede impedir: el propio postgres (SQL Editor, dueño de las
-- tablas) sí puede insertar; es el superusuario del proyecto.
-- ------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on public.bitacora_pagos_comision, public.historial_proceso_ejecutivo, public.historial_solicitudes
  from anon, authenticated, service_role;

-- ------------------------------------------------------------
-- RS-12: resumen_clientes_asesor devuelve la cédula ENMASCARADA
-- (mismo patrón que lib/mascara.ts enmascararCedula: «1.2••.•••.890»).
-- La búsqueda exacta sigue siendo buscar_cliente_asesor(cédula).
-- Misma firma y mismas columnas: create or replace.
-- ------------------------------------------------------------
create or replace function public.enmascarar_cedula(p_cedula text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos text := regexp_replace(coalesce(p_cedula, ''), '\D', '', 'g');
  v_grupos  text[] := '{}';
  v_i       integer;
  v_n       integer;
  v_salida  text[] := '{}';
begin
  if char_length(v_digitos) < 4 then
    return p_cedula;
  end if;
  v_i := char_length(v_digitos);
  while v_i > 0 loop
    v_grupos := array_prepend(substr(v_digitos, greatest(1, v_i - 2), least(3, v_i)), v_grupos);
    v_i := v_i - 3;
  end loop;
  v_n := cardinality(v_grupos);
  for v_i in 1..v_n loop
    if v_i = 1 or v_i = v_n then
      v_salida := v_salida || v_grupos[v_i];
    elsif v_i = 2 then
      v_salida := v_salida || (left(v_grupos[v_i], 1) || repeat('•', char_length(v_grupos[v_i]) - 1));
    else
      v_salida := v_salida || repeat('•', char_length(v_grupos[v_i]));
    end if;
  end loop;
  return array_to_string(v_salida, '.');
end;
$$;
revoke all on function public.enmascarar_cedula(text) from public, anon;
grant execute on function public.enmascarar_cedula(text) to authenticated, service_role;
comment on function public.enmascarar_cedula(text) is
  'Cédula enmascarada para listas (primer grupo, primera cifra del segundo y último grupo visibles). Igual a enmascararCedula() de lib/mascara.ts.';

create or replace function public.resumen_clientes_asesor()
returns table (
  origen            text,
  perfil_id         uuid,
  solicitud_id      uuid,
  nombre            text,
  cedula            text,
  grado             text,
  estado_afiliacion public.estado_afiliacion,
  estado_credito    public.estado_solicitud
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'asociado'::text,
    p.id,
    null::uuid,
    p.nombre_completo,
    public.enmascarar_cedula(p.cedula),
    p.grado,
    null::public.estado_afiliacion,
    ultima.estado
  from public.perfiles p
  left join lateral (
    select s.estado
    from public.solicitudes_credito s
    where s.asociado_id = p.id
    order by s.fecha_solicitud desc
    limit 1
  ) ultima on true
  where p.asesor_id = (select auth.uid())
    and (select public.puede_atender((select auth.uid())))

  union all

  select
    'solicitud_afiliacion'::text,
    null::uuid,
    a.id,
    a.nombre,
    public.enmascarar_cedula(a.cedula),
    a.grado,
    a.estado,
    null::public.estado_solicitud
  from public.solicitudes_afiliacion a
  where a.asesor_id = (select auth.uid())
    and (select public.puede_atender((select auth.uid())));
$$;
revoke all on function public.resumen_clientes_asesor() from public, anon;
grant execute on function public.resumen_clientes_asesor() to authenticated;
comment on function public.resumen_clientes_asesor() is
  'Resumen de "mis clientes": nombre, cédula ENMASCARADA (RS-12), código de grado, estado de afiliación y de crédito. Nunca celular, correo, nequi, nómina ni fotos. Solo devuelve filas si quien llama puede_atender() HOY.';
