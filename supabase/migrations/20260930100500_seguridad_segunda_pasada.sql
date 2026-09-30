-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — Segunda pasada de seguridad
-- (docs/auditorias/2026-09-30-seguridad-requerimientos-ricardo.md §5):
-- RS-17, RS-18, RS-20 y RS-21.
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260930100400_seguridad_revision_ricardo.sql.
-- No reescribe migraciones anteriores: `create or replace`, `add column
-- if not exists`, `drop policy if exists` + `create policy`. Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- RS-17 (a): un admin no se asigna ni se quita clientes a sí mismo.
-- Sin esto, un admin que atiende (Ricardo) podía, por REST:
--   update perfiles set asesor_id = null where id = <su cliente>;
--   admin_actualizar_proceso_ejecutivo(<cliente>, 'operando');   -- ya no es «su» cliente
--   update perfiles set asesor_id = auth.uid() where id = <cliente>;
-- y saltarse RS-01. Ahora el primer y el último paso fallan.
-- Reemplaza COMPLETA la versión de 20260929100200 (mismo cuerpo + la regla).
-- El service role (auth.uid() null, p. ej. aprobarAfiliacion) no se afecta.
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
      if new.atiende_asociados is distinct from old.atiende_asociados then raise exception 'No puede modificar si atiende asociados; solicítelo a la administración'; end if;
      if new.correo_institucional is distinct from old.correo_institucional then raise exception 'No puede modificar su correo institucional; solicítelo a la administración'; end if;
      if (new.nomina_entidad, new.nomina_tipo, new.nomina_numero)
         is distinct from (old.nomina_entidad, old.nomina_tipo, old.nomina_numero) then
        raise exception 'No puede modificar su cuenta de nómina; solicítelo a la administración';
      end if;
    else
      -- RS-17: el admin no mueve clientes hacia sí ni desde sí.
      if new.asesor_id is distinct from old.asesor_id
         and (new.asesor_id = auth.uid() or old.asesor_id = auth.uid()) then
        raise exception 'Otro administrador debe asignar tus clientes';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;

-- ------------------------------------------------------------
-- RS-17 (b): el historial del proceso guarda el asesor que tenía el
-- cliente en cada cambio; los ingresos nuevos se pagan a ese asesor
-- (el de cuando pasó a «operando»), no al asesor actual.
-- Relleno de filas existentes: con el asesor ACTUAL (es lo único que hay);
-- solo se hace la primera vez que se crea la columna.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'historial_proceso_ejecutivo'
                    and column_name = 'asesor_id') then
    alter table public.historial_proceso_ejecutivo
      add column asesor_id uuid references public.perfiles (id) on delete set null;
    update public.historial_proceso_ejecutivo h
       set asesor_id = p.asesor_id
      from public.perfiles p
     where p.id = h.asociado_id;
  end if;
end $$;

create index if not exists ix_historial_proceso_asesor
  on public.historial_proceso_ejecutivo (asesor_id);

comment on column public.historial_proceso_ejecutivo.asesor_id is
  'Asesor del asociado en el momento del cambio (RS-17). Las filas anteriores a 20260930100500 se rellenaron con el asesor de ese día.';

create or replace function public.log_historial_proceso_ejecutivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.estado is distinct from old.estado
     or new.fecha_inicio_embargo is distinct from old.fecha_inicio_embargo then
    insert into public.historial_proceso_ejecutivo
      (asociado_id, estado_anterior, estado_nuevo, fecha_inicio_embargo, admin_id, asesor_id)
    values (
      new.asociado_id,
      case when tg_op = 'UPDATE' then old.estado end,
      new.estado,
      new.fecha_inicio_embargo,
      auth.uid(),
      (select p.asesor_id from public.perfiles p where p.id = new.asociado_id)
    );
  end if;
  return null;
end;
$$;
revoke all on function public.log_historial_proceso_ejecutivo() from public, anon, authenticated;

-- Misma firma y columnas que 20260929100500. Cambia SOLO el conteo de
-- ingresos nuevos: se atribuye al asesor guardado en la fila del historial
-- en que el proceso ENTRÓ a operando (o a terminado sin pasar por operando).
-- Clientes operativos y total_operando_hoy siguen con el asesor actual.
create or replace function public.comisiones_periodo_asesor(p_fecha date default null)
returns table (
  periodo_inicio             date,
  periodo_fin                date,
  ingresos_nuevos            integer,
  valor_ingresos_nuevos      numeric,
  clientes_operativos        integer,
  valor_clientes_operativos  numeric,
  total_operando_hoy         integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_valor_ingreso   constant numeric := 500000;
  c_valor_operativo constant numeric := 100000;
  v_uid    uuid := auth.uid();
  v_fecha  date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_inicio date;
  v_fin    date;
  v_fin_ts timestamptz;
  v_ingresos integer;
  v_operativos integer;
  v_hoy integer;
begin
  if v_uid is null or not public.puede_atender(v_uid) then
    return;
  end if;

  select pc.inicio, pc.fin into v_inicio, v_fin from public.periodo_comision(v_fecha) pc;
  v_fin_ts := ((v_fin + 1)::timestamp at time zone 'America/Bogota');

  -- RS-17: asesor de cuando el cliente pasó a operando.
  select count(*)::int into v_ingresos
  from public.procesos_ejecutivos pe
  join lateral (
    select h.asesor_id
    from public.historial_proceso_ejecutivo h
    where h.asociado_id = pe.asociado_id
      and h.estado_nuevo >= 'operando'::public.estado_proceso_ejecutivo
      and (h.estado_anterior is null or h.estado_anterior < 'operando'::public.estado_proceso_ejecutivo)
    order by h.created_at desc, h.id desc
    limit 1
  ) entrada on true
  where entrada.asesor_id = v_uid
    and pe.fecha_inicio_embargo between v_inicio and v_fin;

  select count(*)::int into v_operativos
  from public.perfiles p
  where p.asesor_id = v_uid
    and (
      select h.estado_nuevo
      from public.historial_proceso_ejecutivo h
      where h.asociado_id = p.id and h.created_at < v_fin_ts
      order by h.created_at desc, h.id desc
      limit 1
    ) = 'operando'::public.estado_proceso_ejecutivo;

  select count(*)::int into v_hoy
  from public.perfiles p
  join public.procesos_ejecutivos pe on pe.asociado_id = p.id
  where p.asesor_id = v_uid
    and pe.estado = 'operando'::public.estado_proceso_ejecutivo;

  return query select v_inicio, v_fin,
    v_ingresos, v_ingresos * c_valor_ingreso,
    v_operativos, v_operativos * c_valor_operativo,
    v_hoy;
end;
$$;
revoke all on function public.comisiones_periodo_asesor(date) from public, anon;
grant execute on function public.comisiones_periodo_asesor(date) to authenticated;
comment on function public.comisiones_periodo_asesor(date) is
  'Asesor en sesión: ingresos nuevos (fecha_inicio_embargo en el periodo, atribuidos al asesor que tenía el cliente al pasar a operando, RS-17) y clientes operativos al corte (asesor actual), con sus valores (500.000 y 100.000), periodo 16→15 que contiene p_fecha (null = hoy, hora Colombia). 0 filas si no puede_atender().';

-- ------------------------------------------------------------
-- RS-18: fotos huérfanas de afiliación, para el cron (solo service_role).
-- CONTRATO acordado con el código (lib/afiliacion/limpiezaFotos.ts):
--   public.fotos_huerfanas_afiliacion(p_limite integer default 500)
--   returns table (name text)
-- Objetos de `solicitudes/<uuid>/...` con más de 3 h cuyo <uuid> no es una
-- solicitud_afiliacion. Un segundo segmento que NO es uuid no se devuelve
-- (el CASE evita que el cast ::uuid falle).
-- ------------------------------------------------------------
create or replace function public.fotos_huerfanas_afiliacion(p_limite integer default 500)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'afiliacion-documentos'
    and o.name like 'solicitudes/%'
    and o.created_at < now() - interval '3 hours'
    and split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1 from public.solicitudes_afiliacion s
      where s.id = case
        when split_part(o.name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(o.name, '/', 2)::uuid
      end
    )
  order by o.created_at, o.name
  limit greatest(coalesce(p_limite, 500), 0);
$$;
revoke all on function public.fotos_huerfanas_afiliacion(integer) from public, anon, authenticated;
grant execute on function public.fotos_huerfanas_afiliacion(integer) to service_role;
comment on function public.fotos_huerfanas_afiliacion(integer) is
  'Solo service_role (cron de limpieza, RS-18): nombres en afiliacion-documentos/solicitudes/<uuid>/ con más de 3 h y sin solicitud de afiliación, los más viejos primero, hasta p_limite.';

-- ------------------------------------------------------------
-- RS-20: el admin que atiende no lee por RLS sus propios pagos ni su
-- bitácora (su cifra solo sale por revelar_acumulado_comision, que cuenta).
-- Las RPC security definer (editar/anular) no pasan por RLS: no cambian.
-- En la bitácora, el EXISTS sobre pagos_comision se evalúa con la RLS de
-- pagos (que ya oculta los propios); la condición explícita es redundante
-- a propósito.
-- ------------------------------------------------------------
drop policy if exists "pagos_comision_select_admin" on public.pagos_comision;
create policy "pagos_comision_select_admin" on public.pagos_comision
  for select to authenticated
  using ((select public.es_admin()) and asesor_id is distinct from (select auth.uid()));

drop policy if exists "bitacora_pagos_select_admin" on public.bitacora_pagos_comision;
create policy "bitacora_pagos_select_admin" on public.bitacora_pagos_comision
  for select to authenticated
  using (
    (select public.es_admin())
    and exists (
      select 1 from public.pagos_comision pc
      where pc.id = bitacora_pagos_comision.pago_id
        and pc.asesor_id is distinct from (select auth.uid())
    )
  );

-- ------------------------------------------------------------
-- RS-21: el contador de revelaciones suma como máximo 1 por minuto por
-- asesor (la RPC se puede llamar directo, sin el límite de 30/h del
-- servidor). Siempre devuelve la suma. ultima_at solo cambia cuando cuenta.
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
         ultima_at = now()
   where r.ultima_at <= now() - interval '1 minute';

  select coalesce(sum(pc.monto), 0) into v_total
  from public.pagos_comision pc
  where pc.asesor_id = v_uid
    and not pc.anulado;

  return v_total;
end;
$$;
revoke all on function public.revelar_acumulado_comision() from public, anon;
grant execute on function public.revelar_acumulado_comision() to authenticated;
comment on function public.revelar_acumulado_comision() is
  'Devuelve la suma de los pagos vigentes del asesor en sesión y suma 1 al contador de revelaciones, como máximo una vez por minuto (RS-21). Única vía para que el asesor vea esa cifra.';
