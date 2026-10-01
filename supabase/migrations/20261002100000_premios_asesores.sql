-- ============================================================
-- Premios de asesores por cantidad de asociados (presentación de negocio, pág. 25).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
--  * Bono al mérito: $1.000.000 al alcanzar 50 asociados (embargos operativos).
--  * Bono al compromiso: viaje a San Andrés (3 días / 2 noches, con acompañante) al alcanzar 100.
--  Cada premio es de una sola vez y lo gana SOLO EL PRIMER asesor que llegue a la meta.
--
-- 1. premios_asesores_ganadores: una fila por meta (PK = meta => un solo ganador). La asigna un
--    trigger cuando un asociado pasa a «operando» (historial_proceso_ejecutivo). Atómico: lock
--    consultivo + PK; si dos asesores llegan a la vez, gana el que toma el lock primero.
--    El ganador no se quita aunque después su conteo baje (única vez).
-- 2. premios_asesores_clics: cada toque del asesor sobre «Premios». Sin lectura ni escritura directa.
-- 3. RPC del asesor: mis_premios_asesor() (conteo, metas y estado; NO revela quién ganó si fue otro)
--    y registrar_clic_premios() (máx. 1 por minuto por asesor).
-- 4. RPC admin: admin_premios_asesores() (asociados, clics, último clic y ganadores por asesor).
-- Conteo = el mismo de bonos_acumulados_asesor (acumulado, sin dados de baja ni retiro anticipado atendido).
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ganadores por meta
-- ------------------------------------------------------------
create table if not exists public.premios_asesores_ganadores (
  meta              integer primary key check (meta in (50, 100)),
  asesor_id         uuid not null references public.perfiles (id),
  clientes_al_ganar integer not null check (clientes_al_ganar >= meta),
  alcanzado_at      timestamptz not null default now()
);
comment on table public.premios_asesores_ganadores is
  'Primer asesor que alcanzó 50 y primer asesor que alcanzó 100 asociados (una sola vez). La PK por meta garantiza un único ganador. Solo la escribe la función interna evaluar_premios_asesor().';

create index if not exists ix_premios_ganadores_asesor on public.premios_asesores_ganadores (asesor_id);

alter table public.premios_asesores_ganadores enable row level security;
revoke all on public.premios_asesores_ganadores from public, anon, authenticated;
grant select on public.premios_asesores_ganadores to authenticated;

drop policy if exists "premios_ganadores_select_admin" on public.premios_asesores_ganadores;
create policy "premios_ganadores_select_admin" on public.premios_asesores_ganadores
  for select to authenticated using ((select public.es_admin()));
-- Sin políticas de insert/update/delete: nadie escribe desde la API.

-- ------------------------------------------------------------
-- 2. Clics sobre la sección «Premios»
-- ------------------------------------------------------------
create table if not exists public.premios_asesores_clics (
  id         bigint generated always as identity primary key,
  asesor_id  uuid not null references public.perfiles (id) on delete cascade,
  meta       integer check (meta is null or meta in (50, 100)),
  created_at timestamptz not null default now()
);
comment on table public.premios_asesores_clics is
  'Cada vez que un asesor abre o toca la sección «Premios» (meta opcional: 50 o 100). Se escribe solo con registrar_clic_premios() (máx. 1 por minuto por asesor) y se lee solo con admin_premios_asesores().';

create index if not exists ix_premios_clics_asesor on public.premios_asesores_clics (asesor_id, created_at desc);

alter table public.premios_asesores_clics enable row level security;
revoke all on public.premios_asesores_clics from public, anon, authenticated;
-- Sin políticas a propósito: todo pasa por funciones SECURITY DEFINER.

-- ------------------------------------------------------------
-- 3. Conteo interno y asignación automática
-- ------------------------------------------------------------
create or replace function public.conteo_acumulado_asesor_interno(p_asesor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.perfiles p
  join lateral (
    select h.asesor_id
    from public.historial_proceso_ejecutivo h
    where h.asociado_id = p.id
      and h.estado_nuevo = 'operando'::public.estado_proceso_ejecutivo
      and (h.estado_anterior is null or h.estado_anterior < 'operando'::public.estado_proceso_ejecutivo)
    order by h.created_at desc, h.id desc
    limit 1
  ) entrada on true
  where entrada.asesor_id = p_asesor
    and p.activo
    and not exists (
      select 1 from public.alertas_asociado a
      where a.asociado_id = p.id
        and a.tipo = 'retiro_anticipado'::public.tipo_alerta_asociado
        and a.estado = 'atendida'::public.estado_alerta_asociado
    );
$$;
revoke all on function public.conteo_acumulado_asesor_interno(uuid) from public, anon, authenticated;

create or replace function public.evaluar_premios_asesor(p_asesor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_meta integer;
begin
  if p_asesor is null or not public.puede_atender(p_asesor) then
    return;
  end if;
  -- Un solo evaluador a la vez: el primero en tomar el lock gana la carrera.
  perform pg_advisory_xact_lock(hashtext('premios_asesores'));
  v_total := public.conteo_acumulado_asesor_interno(p_asesor);
  foreach v_meta in array array[50, 100] loop
    if v_total >= v_meta then
      insert into public.premios_asesores_ganadores (meta, asesor_id, clientes_al_ganar)
      values (v_meta, p_asesor, v_total)
      on conflict (meta) do nothing;   -- ya tiene ganador: no se cambia
    end if;
  end loop;
end;
$$;
revoke all on function public.evaluar_premios_asesor(uuid) from public, anon, authenticated;

create or replace function public.tr_premios_asesores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado_nuevo = 'operando'::public.estado_proceso_ejecutivo
     and (new.estado_anterior is null or new.estado_anterior < 'operando'::public.estado_proceso_ejecutivo) then
    perform public.evaluar_premios_asesor(new.asesor_id);
  end if;
  return null;
end;
$$;
revoke all on function public.tr_premios_asesores() from public, anon, authenticated;

drop trigger if exists tr_premios_asesores on public.historial_proceso_ejecutivo;
create trigger tr_premios_asesores
  after insert on public.historial_proceso_ejecutivo
  for each row execute function public.tr_premios_asesores();

-- Relleno inicial: si hoy ya hay asesores sobre una meta, gana quien la alcanzó primero
-- (fecha en que su asociado número «meta» pasó a operando).
do $$
declare
  v_meta integer;
begin
  foreach v_meta in array array[50, 100] loop
    insert into public.premios_asesores_ganadores (meta, asesor_id, clientes_al_ganar, alcanzado_at)
    select v_meta, x.asesor_id, public.conteo_acumulado_asesor_interno(x.asesor_id), x.cuando
    from (
      select e.asesor_id, e.created_at as cuando,
             row_number() over (partition by e.asesor_id order by e.created_at, e.id) as n
      from (
        select h.id, h.asesor_id, h.created_at,
               row_number() over (partition by h.asociado_id order by h.created_at desc, h.id desc) as rn
        from public.historial_proceso_ejecutivo h
        join public.perfiles p on p.id = h.asociado_id and p.activo
        where h.estado_nuevo = 'operando'::public.estado_proceso_ejecutivo
          and (h.estado_anterior is null or h.estado_anterior < 'operando'::public.estado_proceso_ejecutivo)
          and h.asesor_id is not null
          and not exists (
            select 1 from public.alertas_asociado a
            where a.asociado_id = p.id
              and a.tipo = 'retiro_anticipado'::public.tipo_alerta_asociado
              and a.estado = 'atendida'::public.estado_alerta_asociado)
      ) e
      where e.rn = 1
    ) x
    where x.n = v_meta
      and public.conteo_acumulado_asesor_interno(x.asesor_id) >= v_meta
    order by x.cuando
    limit 1
    on conflict (meta) do nothing;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 4. RPC del asesor
-- ------------------------------------------------------------
create or replace function public.mis_premios_asesor()
returns table (
  clientes_acumulados integer,
  meta                integer,
  estado              text,          -- 'disponible' | 'ya_ganado' | 'ganado_por_mi'
  ganado_at           timestamptz    -- solo si es mío; null si no
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
begin
  if v_uid is null or not public.puede_atender(v_uid) then
    return;
  end if;
  v_total := public.conteo_acumulado_asesor_interno(v_uid);
  return query
    select v_total, m.meta,
           case when g.asesor_id is null then 'disponible'
                when g.asesor_id = v_uid then 'ganado_por_mi'
                else 'ya_ganado' end,
           case when g.asesor_id = v_uid then g.alcanzado_at end
    from (values (50), (100)) as m(meta)
    left join public.premios_asesores_ganadores g on g.meta = m.meta
    order by m.meta;
end;
$$;
revoke all on function public.mis_premios_asesor() from public, anon;
grant execute on function public.mis_premios_asesor() to authenticated;
comment on function public.mis_premios_asesor() is
  'Asesor en sesión: su conteo acumulado y, por cada meta (50 y 100), si está disponible, ya la ganó otro (sin decir quién) o la ganó él. 0 filas si no puede_atender().';

create or replace function public.registrar_clic_premios(p_meta integer default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.puede_atender(v_uid) then
    return false;
  end if;
  if p_meta is not null and p_meta not in (50, 100) then
    return false;
  end if;
  -- Atómico por asesor: dos toques simultáneos no pasan los dos.
  perform pg_advisory_xact_lock(hashtext('premios_clic:' || v_uid::text));
  if exists (select 1 from public.premios_asesores_clics c
              where c.asesor_id = v_uid and c.created_at > now() - interval '1 minute') then
    return false;   -- máx. 1 registro por minuto por asesor
  end if;
  insert into public.premios_asesores_clics (asesor_id, meta) values (v_uid, p_meta);
  return true;
end;
$$;
revoke all on function public.registrar_clic_premios(integer) from public, anon;
grant execute on function public.registrar_clic_premios(integer) to authenticated;
comment on function public.registrar_clic_premios(integer) is
  'Registra que el asesor en sesión abrió o tocó «Premios» (meta opcional 50/100). Máx. 1 por minuto por asesor; devuelve true si lo registró.';

-- ------------------------------------------------------------
-- 5. RPC del admin
-- ------------------------------------------------------------
create or replace function public.admin_premios_asesores()
returns table (
  asesor_id           uuid,
  clientes_acumulados integer,
  clics               integer,
  ultimo_clic         timestamptz,
  gano_50_at          timestamptz,
  gano_100_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.es_admin()) then
    return;
  end if;
  return query
    select p.id,
           public.conteo_acumulado_asesor_interno(p.id),
           (select count(*)::int from public.premios_asesores_clics c where c.asesor_id = p.id),
           (select max(c.created_at) from public.premios_asesores_clics c where c.asesor_id = p.id),
           (select g.alcanzado_at from public.premios_asesores_ganadores g where g.meta = 50 and g.asesor_id = p.id),
           (select g.alcanzado_at from public.premios_asesores_ganadores g where g.meta = 100 and g.asesor_id = p.id)
    from public.perfiles p
    where p.rol in ('asesor'::public.rol_usuario, 'admin'::public.rol_usuario)
      and (public.puede_atender(p.id)
           or exists (select 1 from public.premios_asesores_clics c where c.asesor_id = p.id)
           or exists (select 1 from public.premios_asesores_ganadores g where g.asesor_id = p.id));
end;
$$;
revoke all on function public.admin_premios_asesores() from public, anon;
grant execute on function public.admin_premios_asesores() to authenticated;
comment on function public.admin_premios_asesores() is
  'Solo admin: por asesor, asociados acumulados, clics en «Premios» y fecha en que ganó cada meta (null si no la ganó). 0 filas si no es admin.';
