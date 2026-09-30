-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.10 (P-92).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Cómo funciona hoy (sin cambios): participar_sorteo (solo service role)
-- genera el número de 6 dígitos al inscribirse (días 1–5, hora Colombia) y
-- se envía al correo institucional; el asociado lo confirma con
-- confirmar_boleta_sorteo → boleta «confirmada». Participantes del mes =
-- boletas confirmadas de ese anio/mes.
--
-- Nuevo:
--   * public.sorteos_mensuales: un resultado por mes (PK mes), inmutable.
--   * admin_realizar_sorteo(p_mes date): solo admin activo; elige al azar
--     EN LA BASE (gen_random_uuid()) entre boletas confirmadas del mes cuyo
--     asociado está activo; guarda el resultado; no se repite.
--     Solo meses ya empezados y, si es el mes en curso, después del día 5.
--   * ganador_sorteo_vigente(): cualquier asociado ACTIVO con sesión; devuelve
--     SOLO mes, grado (nombre del grado) y nombre del ganador del último
--     sorteo del mes en curso o del anterior (nada más viejo).
-- Idempotente.
-- ============================================================

create table if not exists public.sorteos_mensuales (
  mes            date primary key check (extract(day from mes) = 1),
  boleta_id      uuid not null unique references public.boletas_sorteo (id),
  asociado_id    uuid not null references public.perfiles (id),
  participantes  integer not null check (participantes >= 1),
  realizado_por  uuid references public.perfiles (id),
  realizado_at   timestamptz not null default now()
);
comment on table public.sorteos_mensuales is
  'Resultado del sorteo de cada mes (spec §12.10). Lo escribe solo admin_realizar_sorteo. Inmutable.';

create index if not exists ix_sorteos_mensuales_asociado on public.sorteos_mensuales (asociado_id);
create index if not exists ix_sorteos_mensuales_realizado_por on public.sorteos_mensuales (realizado_por);

alter table public.sorteos_mensuales enable row level security;
revoke all on public.sorteos_mensuales from anon, authenticated;
grant select on public.sorteos_mensuales to authenticated;

drop policy if exists "sorteos_mensuales_select_admin" on public.sorteos_mensuales;
create policy "sorteos_mensuales_select_admin" on public.sorteos_mensuales
  for select to authenticated using ((select public.es_admin()));

create or replace function public.sorteo_inmutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'El resultado del sorteo no se puede modificar ni borrar';
end;
$$;
revoke all on function public.sorteo_inmutable() from public, anon, authenticated;

drop trigger if exists tr_sorteo_inmutable on public.sorteos_mensuales;
create trigger tr_sorteo_inmutable
  before update or delete on public.sorteos_mensuales
  for each row execute function public.sorteo_inmutable();

drop trigger if exists tr_sorteo_sin_truncate on public.sorteos_mensuales;
create trigger tr_sorteo_sin_truncate
  before truncate on public.sorteos_mensuales
  for each statement execute function public.sorteo_inmutable();

-- ------------------------------------------------------------
-- Realizar el sorteo (admin)
-- ------------------------------------------------------------
create or replace function public.admin_realizar_sorteo(p_mes date)
returns table (mes date, asociado_id uuid, numero text, nombre_completo text,
               grado text, participantes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy    date := (now() at time zone 'America/Bogota')::date;
  v_mes    date;
  v_anio   smallint;
  v_m      smallint;
  v_boleta public.boletas_sorteo%rowtype;
  v_total  integer;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede realizar el sorteo';
  end if;
  if p_mes is null then
    raise exception 'Falta el mes del sorteo';
  end if;

  v_mes  := date_trunc('month', p_mes)::date;
  v_anio := extract(year from v_mes)::smallint;
  v_m    := extract(month from v_mes)::smallint;

  if v_mes > date_trunc('month', v_hoy)::date then
    raise exception 'No se puede sortear un mes que no ha empezado';
  end if;
  if v_mes = date_trunc('month', v_hoy)::date and extract(day from v_hoy) <= 5 then
    raise exception 'El sorteo se hace cuando cierre la inscripción (después del día 5)';
  end if;

  -- Dos admins a la vez: el segundo espera y luego ve que ya se hizo.
  perform pg_advisory_xact_lock(hashtext('sorteo_mensual'), (v_anio * 100 + v_m));

  if exists (select 1 from public.sorteos_mensuales s where s.mes = v_mes) then
    raise exception 'El sorteo de ese mes ya se realizó';
  end if;

  select count(*)::int into v_total
  from public.boletas_sorteo b
  join public.perfiles p on p.id = b.asociado_id and p.activo
  where b.anio = v_anio and b.mes = v_m
    and b.estado = 'confirmada'::public.estado_boleta_sorteo;

  if v_total = 0 then
    raise exception 'No hay participantes confirmados para el sorteo de ese mes';
  end if;

  select b.* into v_boleta
  from public.boletas_sorteo b
  join public.perfiles p on p.id = b.asociado_id and p.activo
  where b.anio = v_anio and b.mes = v_m
    and b.estado = 'confirmada'::public.estado_boleta_sorteo
  order by gen_random_uuid()
  limit 1;

  insert into public.sorteos_mensuales (mes, boleta_id, asociado_id, participantes, realizado_por)
  values (v_mes, v_boleta.id, v_boleta.asociado_id, v_total, auth.uid());

  return query
    select v_mes, p.id, v_boleta.numero, p.nombre_completo, g.nombre, v_total
    from public.perfiles p
    left join public.grados g on g.codigo = p.grado
    where p.id = v_boleta.asociado_id;
end;
$$;
revoke all on function public.admin_realizar_sorteo(date) from public, anon;
grant execute on function public.admin_realizar_sorteo(date) to authenticated;

-- ------------------------------------------------------------
-- Ganador visible para asociados activos (sin cédula ni boleta)
-- ------------------------------------------------------------
create or replace function public.ganador_sorteo_vigente()
returns table (mes date, grado text, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.mes, g.nombre, p.nombre_completo
  from public.sorteos_mensuales s
  join public.perfiles p on p.id = s.asociado_id
  left join public.grados g on g.codigo = p.grado
  where exists (select 1 from public.perfiles yo
                where yo.id = (select auth.uid()) and yo.activo)
    and s.mes >= (date_trunc('month', (now() at time zone 'America/Bogota')) - interval '1 month')::date
  order by s.mes desc
  limit 1;
$$;
revoke all on function public.ganador_sorteo_vigente() from public, anon;
grant execute on function public.ganador_sorteo_vigente() to authenticated;
