-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §0, §5, §6).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100300_proceso_ejecutivo.sql.
--
-- Panel del asesor (embajador):
--  1. pagos_comision: los pagos que registra el admin (asesor, periodo de
--     corte, concepto, monto, cliente opcional, quién y cuándo). Libro
--     contable: sin update ni delete desde la API; una corrección se
--     registra como concepto 'ajuste' (puede ser negativo).
--     El ASESOR NO LEE ESTA TABLA: si pudiera, sacaría la suma sin pasar
--     por el contador de revelaciones. La cifra solo sale por
--     revelar_acumulado_comision().
--  2. revelaciones_acumulado_comision: cuántas veces reveló cada asesor su
--     «Acumulado ganado a la fecha». RLS sin ninguna política y sin
--     privilegios para anon, authenticated NI service_role: nadie lo lee
--     desde la app (ni el asesor ni el admin, ni con la llave de servicio).
--     Solo se ve desde el SQL Editor (postgres).
--  3. periodo_comision(fecha): el periodo de corte que contiene esa fecha,
--     del día 16 al día 15 del mes siguiente (spec §0 [Sebas]).
--  4. comisiones_periodo_asesor(fecha): ingresos nuevos y clientes
--     operativos del periodo, de los clientes DEL ASESOR EN SESIÓN, con
--     los valores de la presentación (500.000 y 100.000).
--       - Ingreso nuevo (R-08): cliente cuya fecha_inicio_embargo cae dentro
--         del periodo (el embargo ya descuenta).
--       - Cliente operativo: cliente cuyo proceso estaba en «operando» al
--         cierre del periodo según el historial (para el periodo en curso,
--         el estado de hoy).
--  5. buscar_cliente_asesor(cédula): un cliente SUYO por cédula exacta, con
--     estado del proceso y capacidad de endeudamiento (cupos 50 % y 100 %
--     de su grupo; null = «sin cupo configurado»). Nunca contacto, nómina,
--     fotos ni tasa.
-- Todas las funciones del asesor mantienen el blindaje F2-03: exigen que
-- quien llama puede_atender() HOY (asesor, o admin con atiende_asociados);
-- si no, 0 filas. revoke from public, anon.
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'concepto_comision') then
    create type public.concepto_comision as enum (
      'ingreso_nuevo', 'embargo_operativo', 'bono_50_embargos', 'viaje_100_embargos', 'ajuste'
    );
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Pagos de comisión
-- ------------------------------------------------------------
create table if not exists public.pagos_comision (
  id              uuid primary key default gen_random_uuid(),
  asesor_id       uuid not null references public.perfiles (id),
  asociado_id     uuid references public.perfiles (id),   -- cliente que originó el pago (opcional)
  periodo_corte   date not null,                           -- día 15 que cierra el periodo
  concepto        public.concepto_comision not null,
  monto           numeric(14, 0) not null,
  nota            text,
  registrado_por  uuid references public.perfiles (id),
  created_at      timestamptz not null default now(),
  constraint pagos_comision_corte_chk check (extract(day from periodo_corte) = 15),
  constraint pagos_comision_monto_chk check (
    (concepto = 'ajuste'::public.concepto_comision and monto <> 0)
    or (concepto = 'viaje_100_embargos'::public.concepto_comision and monto >= 0)
    or (concepto not in ('ajuste'::public.concepto_comision, 'viaje_100_embargos'::public.concepto_comision) and monto > 0)
  ),
  constraint pagos_comision_nota_chk check (nota is null or char_length(nota) <= 300)
);

comment on table public.pagos_comision is
  'Pagos de comisión a asesores que registra el admin. Sin update/delete: corregir con concepto ajuste. El asesor no la lee: su total sale por revelar_acumulado_comision().';
comment on column public.pagos_comision.periodo_corte is
  'Día 15 que cierra el periodo (16 del mes anterior → 15). Ver periodo_comision().';

create index if not exists ix_pagos_comision_asesor on public.pagos_comision (asesor_id, periodo_corte desc);
create index if not exists ix_pagos_comision_asociado on public.pagos_comision (asociado_id);
create index if not exists ix_pagos_comision_registrado_por on public.pagos_comision (registrado_por);

alter table public.pagos_comision enable row level security;
revoke all on public.pagos_comision from anon, authenticated;
grant select, insert on public.pagos_comision to authenticated;

drop policy if exists "pagos_comision_select_admin" on public.pagos_comision;
create policy "pagos_comision_select_admin" on public.pagos_comision
  for select to authenticated using ((select public.es_admin()));

drop policy if exists "pagos_comision_insert_admin" on public.pagos_comision;
create policy "pagos_comision_insert_admin" on public.pagos_comision
  for insert to authenticated with check ((select public.es_admin()));

create or replace function public.sellar_pago_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.puede_atender(new.asesor_id) then
    raise exception 'El pago debe ser para un asesor activo';
  end if;
  -- Quién y cuándo: siempre del servidor.
  new.registrado_por := auth.uid();
  new.created_at     := now();
  return new;
end;
$$;
revoke all on function public.sellar_pago_comision() from public, anon, authenticated;

drop trigger if exists tr_sellar_pago_comision on public.pagos_comision;
create trigger tr_sellar_pago_comision
  before insert on public.pagos_comision
  for each row execute function public.sellar_pago_comision();

-- ------------------------------------------------------------
-- 2. Contador de revelaciones (invisible desde la app)
-- ------------------------------------------------------------
create table if not exists public.revelaciones_acumulado_comision (
  asesor_id   uuid primary key references public.perfiles (id) on delete cascade,
  veces       integer not null default 0 check (veces >= 0),
  primera_at  timestamptz not null default now(),
  ultima_at   timestamptz not null default now()
);

comment on table public.revelaciones_acumulado_comision is
  'Cuántas veces cada asesor reveló su «Acumulado ganado a la fecha». Nadie lo lee desde la app (sin políticas ni privilegios para anon/authenticated/service_role). Solo desde el SQL Editor.';

alter table public.revelaciones_acumulado_comision enable row level security;
revoke all on public.revelaciones_acumulado_comision from public, anon, authenticated, service_role;
-- Sin políticas a propósito.

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
  where pc.asesor_id = v_uid;

  return v_total;
end;
$$;
revoke all on function public.revelar_acumulado_comision() from public, anon;
grant execute on function public.revelar_acumulado_comision() to authenticated;
comment on function public.revelar_acumulado_comision() is
  'Suma 1 al contador de revelaciones del asesor en sesión y devuelve la suma de sus pagos de comisión. Única vía para que el asesor vea esa cifra.';

-- ------------------------------------------------------------
-- 3. Periodo de corte (16 → 15)
-- ------------------------------------------------------------
create or replace function public.periodo_comision(p_fecha date)
returns table (inicio date, fin date)
language sql
immutable
set search_path = ''
as $$
  select
    case when extract(day from p_fecha) >= 16
         then make_date(extract(year from p_fecha)::int, extract(month from p_fecha)::int, 16)
         else (make_date(extract(year from p_fecha)::int, extract(month from p_fecha)::int, 16) - interval '1 month')::date
    end,
    case when extract(day from p_fecha) >= 16
         then (make_date(extract(year from p_fecha)::int, extract(month from p_fecha)::int, 15) + interval '1 month')::date
         else make_date(extract(year from p_fecha)::int, extract(month from p_fecha)::int, 15)
    end;
$$;
revoke all on function public.periodo_comision(date) from public, anon;
grant execute on function public.periodo_comision(date) to authenticated, service_role;
comment on function public.periodo_comision(date) is
  'Periodo de comisiones que contiene la fecha: del día 16 al día 15 del mes siguiente. Pásale la fecha en hora de Colombia.';

-- ------------------------------------------------------------
-- 4. Comisiones del periodo del asesor en sesión
-- ------------------------------------------------------------
create or replace function public.comisiones_periodo_asesor(p_fecha date default null)
returns table (
  periodo_inicio             date,
  periodo_fin                date,
  ingresos_nuevos            integer,
  valor_ingresos_nuevos      numeric,
  clientes_operativos        integer,
  valor_clientes_operativos  numeric,
  total_operando_hoy         integer     -- para el avance a los bonos de 50 y 100
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Valores de la presentación (spec §0). Si cambian, nueva migración.
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
  -- F2-03: solo quien HOY puede atender; si no, 0 filas.
  if v_uid is null or not public.puede_atender(v_uid) then
    return;
  end if;

  select pc.inicio, pc.fin into v_inicio, v_fin from public.periodo_comision(v_fecha) pc;
  -- Fin del periodo = medianoche del día 16 en Colombia.
  v_fin_ts := ((v_fin + 1)::timestamp at time zone 'America/Bogota');

  select count(*)::int into v_ingresos
  from public.perfiles p
  join public.procesos_ejecutivos pe on pe.asociado_id = p.id
  where p.asesor_id = v_uid
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
  'Asesor en sesión: ingresos nuevos (fecha_inicio_embargo en el periodo) y clientes operativos al corte, con sus valores (500.000 y 100.000), para el periodo 16→15 que contiene p_fecha (null = hoy, hora Colombia). 0 filas si no puede_atender().';

-- ------------------------------------------------------------
-- 5. Buscar un cliente propio por cédula
-- ------------------------------------------------------------
create or replace function public.buscar_cliente_asesor(p_cedula text)
returns table (
  perfil_id             uuid,
  nombre                text,
  cedula                text,
  grado                 text,
  grado_nombre          text,
  institucion           public.institucion_afiliacion,
  estado_proceso        public.estado_proceso_ejecutivo,
  fecha_inicio_embargo  date,
  grupo_credito         public.grado_policial,
  cupo_50               numeric,   -- null = sin cupo configurado
  cupo_100              numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.nombre_completo,
         p.cedula,
         p.grado,
         g.nombre,
         p.institucion,
         pe.estado,
         pe.fecha_inicio_embargo,
         g.grupo_credito,
         (select gc.capacidad_maxima from public.grados_credito gc
           where gc.grado = g.grupo_credito and gc.porcentaje = '50'::public.porcentaje_devolucion),
         (select gc.capacidad_maxima from public.grados_credito gc
           where gc.grado = g.grupo_credito and gc.porcentaje = '100'::public.porcentaje_devolucion)
  from public.perfiles p
  left join public.grados g on g.codigo = p.grado
  left join public.procesos_ejecutivos pe on pe.asociado_id = p.id
  where p_cedula ~ '^\s*[0-9]{6,10}\s*$'
    and p.cedula = btrim(p_cedula)
    and p.asesor_id = (select auth.uid())
    and (select public.puede_atender((select auth.uid())));
$$;
revoke all on function public.buscar_cliente_asesor(text) from public, anon;
grant execute on function public.buscar_cliente_asesor(text) to authenticated;
comment on function public.buscar_cliente_asesor(text) is
  'Asesor en sesión: un cliente SUYO por cédula exacta, con estado del proceso y cupos 50/100 de su grupo (null = sin cupo). Nunca contacto, nómina, fotos ni tasa. 0 filas si no es su cliente o si quien llama no puede_atender().';
