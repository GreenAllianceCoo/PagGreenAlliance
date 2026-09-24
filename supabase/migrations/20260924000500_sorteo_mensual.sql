-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Fase 2 · PARTE 1. NO APLICADA en producción.
-- Sorteo mensual: una sola tabla de boletas (cada fila ya identifica "el
-- sorteo" al que pertenece con año + mes; no hace falta una tabla aparte
-- para "el sorteo del mes" porque no tiene más datos propios: el ganador
-- NO se elige en la app, solo se registran los inscritos).
--
-- Flujo (todo por funciones SECURITY DEFINER, solo service_role, igual que
-- registrar_intento / correo_por_cedula):
--  1. participar_sorteo(p_asociado_id): solo del 1 al 5 de cada mes, hora
--     de Colombia. Genera un número de 6 dígitos único para ese mes,
--     guarda la boleta en estado 'enviada' y lo devuelve (el servidor lo
--     manda por correo; la función NO expone el número a authenticated).
--  2. confirmar_boleta_sorteo(p_asociado_id, p_numero): también solo del 1
--     al 5. Si el número coincide, pasa a 'confirmada'. Lleva un tope de
--     intentos.
--
-- Lectura: el asociado ve su propia boleta (RLS normal); el admin ve todas
-- (para listar las confirmadas de cada mes).
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'estado_boleta_sorteo') then
    create type public.estado_boleta_sorteo as enum ('enviada', 'confirmada');
  end if;
end $$;

create table if not exists public.boletas_sorteo (
  id                 uuid primary key default gen_random_uuid(),
  asociado_id        uuid not null references public.perfiles(id),
  anio               smallint not null check (anio between 2024 and 2100),
  mes                smallint not null check (mes between 1 and 12),
  numero             text not null check (numero ~ '^[0-9]{6}$'),
  estado             public.estado_boleta_sorteo not null default 'enviada',
  fecha_envio        timestamptz not null default now(),
  fecha_confirmacion timestamptz,
  intentos           integer not null default 0 check (intentos >= 0),
  created_at         timestamptz not null default now(),
  constraint boletas_sorteo_confirmacion_chk check (
    (estado = 'confirmada' and fecha_confirmacion is not null)
    or
    (estado = 'enviada' and fecha_confirmacion is null)
  )
);

comment on table public.boletas_sorteo is
  'Una fila por asociado y mes: su boleta del sorteo mensual. El ganador no se elige aquí; el admin solo lista las confirmadas.';
comment on column public.boletas_sorteo.numero is
  'Número de 6 dígitos enviado por correo. Único por mes (anio, mes, numero).';
comment on column public.boletas_sorteo.intentos is
  'Intentos fallidos al escribir el número en confirmar_boleta_sorteo(). Tope: 5 (ver la función).';

-- Una sola boleta por asociado y mes; un solo número por mes.
create unique index if not exists ux_boletas_sorteo_asociado_mes
  on public.boletas_sorteo (asociado_id, anio, mes);
create unique index if not exists ux_boletas_sorteo_numero_mes
  on public.boletas_sorteo (anio, mes, numero);
create index if not exists ix_boletas_sorteo_admin_lista
  on public.boletas_sorteo (anio, mes, estado);

alter table public.boletas_sorteo enable row level security;
revoke all on public.boletas_sorteo from anon, authenticated;
grant select on public.boletas_sorteo to authenticated;

-- El asociado ve su propia boleta; el admin las ve todas (para listar los
-- confirmados de cada mes). Sin política de insert/update/delete para
-- authenticated: todo pasa por las funciones de abajo (SECURITY DEFINER,
-- dueño postgres, que sí puede escribir aunque RLS no tenga política para
-- authenticated).
create policy "boletas_sorteo_select" on public.boletas_sorteo
  for select to authenticated
  using (asociado_id = (select auth.uid()) or (select public.es_admin()));

-- ------------------------------------------------------------
-- ¿Está abierta la ventana de inscripción/confirmación? Del 1 al 5, hora
-- de Colombia. Función de solo lectura, se puede exponer a authenticated
-- para que la pantalla muestre u oculte "Participar" sin adivinar la fecha
-- en el cliente (que podría tener el reloj o el huso mal puesto).
-- ------------------------------------------------------------
create or replace function public.sorteo_ventana_abierta()
returns boolean
language sql
stable
as $$
  select extract(day from (now() at time zone 'America/Bogota')) between 1 and 5;
$$;
revoke all on function public.sorteo_ventana_abierta() from public, anon;
grant execute on function public.sorteo_ventana_abierta() to authenticated, service_role;
comment on function public.sorteo_ventana_abierta() is
  'true del día 1 al 5 de cada mes, hora de Colombia (America/Bogota). No security definer: no toca datos, solo la fecha del servidor.';

-- ------------------------------------------------------------
-- Genera un número de 6 dígitos que no exista todavía para ese año/mes.
-- Función interna (no se expone).
-- ------------------------------------------------------------
create or replace function public.generar_numero_boleta_sorteo(p_anio smallint, p_mes smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero  text;
  v_intento int := 0;
begin
  loop
    v_intento := v_intento + 1;
    v_numero := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (
      select 1 from public.boletas_sorteo
      where anio = p_anio and mes = p_mes and numero = v_numero
    );
    if v_intento > 50 then
      raise exception 'No se pudo generar un número de boleta único para %/%', p_mes, p_anio;
    end if;
  end loop;
  return v_numero;
end;
$$;
revoke all on function public.generar_numero_boleta_sorteo(smallint, smallint) from public, anon, authenticated;

-- ------------------------------------------------------------
-- participar_sorteo(): crea la boleta del mes en curso. Devuelve el número
-- para que el SERVIDOR (que la llama con service role) lo mande por
-- correo; no se lo pasa nunca a authenticated.
-- ------------------------------------------------------------
create or replace function public.participar_sorteo(p_asociado_id uuid)
returns table (id uuid, numero text, anio smallint, mes smallint, fecha_envio timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio   smallint := extract(year  from (now() at time zone 'America/Bogota'))::smallint;
  v_mes    smallint := extract(month from (now() at time zone 'America/Bogota'))::smallint;
  v_dia    smallint := extract(day   from (now() at time zone 'America/Bogota'))::smallint;
  v_numero text;
  v_id     uuid;
begin
  if p_asociado_id is null then
    raise exception 'Falta el asociado';
  end if;
  if v_dia < 1 or v_dia > 5 then
    raise exception 'La inscripción al sorteo solo está abierta del 1 al 5 de cada mes';
  end if;
  if exists (
    select 1 from public.boletas_sorteo
    where asociado_id = p_asociado_id and anio = v_anio and mes = v_mes
  ) then
    raise exception 'Ya tienes una boleta para el sorteo de este mes';
  end if;

  v_numero := public.generar_numero_boleta_sorteo(v_anio, v_mes);

  insert into public.boletas_sorteo (asociado_id, anio, mes, numero)
  values (p_asociado_id, v_anio, v_mes, v_numero)
  returning boletas_sorteo.id into v_id;

  return query
    select v_id, v_numero, v_anio, v_mes, b.fecha_envio
    from public.boletas_sorteo b where b.id = v_id;
end;
$$;
revoke all on function public.participar_sorteo(uuid) from public, anon, authenticated;
grant execute on function public.participar_sorteo(uuid) to service_role;
comment on function public.participar_sorteo(uuid) is
  'Crea la boleta del mes (solo del 1 al 5) y devuelve el número para que el servidor lo envíe por correo. Solo service_role.';

-- ------------------------------------------------------------
-- confirmar_boleta_sorteo(): compara el número escrito por el asociado.
-- Tope de 5 intentos fallidos.
-- ------------------------------------------------------------
create or replace function public.confirmar_boleta_sorteo(p_asociado_id uuid, p_numero text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio  smallint := extract(year  from (now() at time zone 'America/Bogota'))::smallint;
  v_mes   smallint := extract(month from (now() at time zone 'America/Bogota'))::smallint;
  v_dia   smallint := extract(day   from (now() at time zone 'America/Bogota'))::smallint;
  v_fila  public.boletas_sorteo%rowtype;
  v_max_intentos constant integer := 5;
begin
  if p_asociado_id is null or p_numero is null then
    raise exception 'Faltan datos para confirmar la boleta';
  end if;
  if v_dia < 1 or v_dia > 5 then
    raise exception 'La ventana del sorteo (1 al 5) ya cerró';
  end if;

  select * into v_fila
  from public.boletas_sorteo
  where asociado_id = p_asociado_id and anio = v_anio and mes = v_mes
  for update;

  if not found then
    raise exception 'No tienes una boleta para el sorteo de este mes';
  end if;

  if v_fila.estado = 'confirmada'::public.estado_boleta_sorteo then
    return true; -- idempotente: ya estaba confirmada
  end if;

  if v_fila.intentos >= v_max_intentos then
    raise exception 'Superaste el número de intentos para confirmar tu boleta';
  end if;

  if v_fila.numero = btrim(p_numero) then
    update public.boletas_sorteo
       set estado = 'confirmada', fecha_confirmacion = now()
     where id = v_fila.id;
    return true;
  else
    update public.boletas_sorteo
       set intentos = intentos + 1
     where id = v_fila.id;
    return false;
  end if;
end;
$$;
revoke all on function public.confirmar_boleta_sorteo(uuid, text) from public, anon, authenticated;
grant execute on function public.confirmar_boleta_sorteo(uuid, text) to service_role;
comment on function public.confirmar_boleta_sorteo(uuid, text) is
  'Confirma la boleta del mes si el número coincide (máx. 5 intentos). Solo service_role.';
