-- ============================================================
-- ga-funcionalidad-botones, 2026-09-23 — NO APLICADA en producción.
-- Límite de frecuencia simple en la base (no hay Upstash ni otro
-- servicio configurado). Lo usan las Server Actions:
--   * /afiliacion: por IP y por cédula (spec §2 «Seguridad»).
--   * /ingresar y «Reenviar código»: por IP y por cédula (45 s entre
--     códigos a la misma cédula; tope por ventana de 15 min).
--
-- Cómo funciona: cada intento guarda una fila (clave, fecha). La función
-- cuenta los intentos de esa clave dentro de la ventana; si ya llegó al
-- máximo devuelve false y no guarda nada; si no, guarda el intento y
-- devuelve true. Un candado por clave (advisory lock) evita que dos
-- peticiones simultáneas pasen las dos.
--
-- La clave la arma el servidor con un hash (sha-256) de la IP o de la
-- cédula: la tabla no guarda datos personales en claro.
-- Solo service_role puede ejecutar la función; la tabla no tiene acceso
-- por la API (RLS habilitado sin políticas).
-- Idempotente.
-- ============================================================

create table if not exists public.limites_intentos (
  id         bigint generated always as identity primary key,
  clave      text not null check (char_length(clave) between 1 and 200),
  creado_at  timestamptz not null default now()
);

comment on table public.limites_intentos is
  'Intentos recientes por clave (hash de IP o cédula) para limitar la frecuencia de envíos. Solo la usa public.registrar_intento() con service role.';

create index if not exists ix_limites_intentos_clave_fecha
  on public.limites_intentos (clave, creado_at desc);

alter table public.limites_intentos enable row level security;
revoke all on public.limites_intentos from public, anon, authenticated;

create or replace function public.registrar_intento(
  p_clave text,
  p_maximo integer,
  p_ventana_segundos integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := now() - make_interval(secs => p_ventana_segundos);
  v_usados integer;
begin
  if p_clave is null or char_length(p_clave) = 0 or char_length(p_clave) > 200 then
    raise exception 'Clave de límite inválida';
  end if;
  if p_maximo is null or p_maximo < 1 or p_ventana_segundos is null or p_ventana_segundos < 1 then
    raise exception 'Parámetros de límite inválidos';
  end if;

  -- Un intento a la vez por clave (se libera al terminar la transacción).
  perform pg_advisory_xact_lock(hashtextextended(p_clave, 0));

  select count(*) into v_usados
    from public.limites_intentos
   where clave = p_clave
     and creado_at > v_desde;

  if v_usados >= p_maximo then
    return false;
  end if;

  insert into public.limites_intentos (clave) values (p_clave);

  -- Limpieza ocasional: las ventanas más largas que se usan son de 1 día.
  if random() < 0.02 then
    delete from public.limites_intentos where creado_at < now() - interval '2 days';
  end if;

  return true;
end;
$$;

revoke all on function public.registrar_intento(text, integer, integer) from public, anon, authenticated;
grant execute on function public.registrar_intento(text, integer, integer) to service_role;

comment on function public.registrar_intento(text, integer, integer) is
  'Devuelve true y registra el intento si la clave no ha llegado a p_maximo intentos en los últimos p_ventana_segundos; si llegó, devuelve false. Solo service_role.';
