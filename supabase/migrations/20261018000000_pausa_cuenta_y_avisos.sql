-- ============================================================
-- 2026-10-18 — Pausa del ingreso de asociados y avisos al entrar (pedido de Sebas).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica
-- (después de 20261014000000_afiliacion_sin_repetidos). Idempotente.
--
-- A) Pausa: un administrador puede cerrar /cuenta a los asociados (por
--    ejemplo, si algo falla y no hay nadie del equipo técnico). Admins,
--    secretarios y asesores siguen entrando. La app la consulta en proxy.ts
--    en cada petición a /cuenta (páginas y Server Actions) con
--    estado_pausa_cuenta(); solo se cambia con admin_cambiar_pausa_cuenta()
--    y cada cambio queda en historial_pausa_cuenta (inmutable).
--
-- B) Avisos: el administrador escribe un aviso y cada asociado lo ve una vez
--    la próxima vez que entra a /cuenta; al cerrarlo queda en avisos_vistos.
--    Solo lo ven los asociados que ya existían cuando se publicó.
-- ============================================================

-- ------------------------------------------------------------
-- A) Pausa del ingreso a /cuenta
-- ------------------------------------------------------------
create table if not exists public.configuracion_plataforma (
  id              boolean primary key default true check (id),
  cuenta_pausada  boolean not null default false,
  mensaje_pausa   text check (mensaje_pausa is null or char_length(mensaje_pausa) between 5 and 300),
  actualizado_por uuid references public.perfiles (id) on delete set null,
  actualizado_at  timestamptz not null default now()
);
comment on table public.configuracion_plataforma is
  'Una sola fila. cuenta_pausada = true cierra /cuenta a los asociados (lo aplica proxy.ts). Solo se cambia con admin_cambiar_pausa_cuenta().';
insert into public.configuracion_plataforma (id) values (true) on conflict (id) do nothing;

alter table public.configuracion_plataforma enable row level security;
revoke all on public.configuracion_plataforma from anon, authenticated;
grant select on public.configuracion_plataforma to authenticated;
drop policy if exists configuracion_plataforma_select_admin on public.configuracion_plataforma;
create policy configuracion_plataforma_select_admin on public.configuracion_plataforma
  for select to authenticated using ((select public.es_admin()));

create table if not exists public.historial_pausa_cuenta (
  id         bigint generated always as identity primary key,
  pausada    boolean not null,
  mensaje    text,
  actor_id   uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.historial_pausa_cuenta is 'Cada vez que un admin pausó o reanudó el ingreso de asociados (inmutable).';
create index if not exists ix_historial_pausa_cuenta_actor on public.historial_pausa_cuenta (actor_id);
create index if not exists ix_historial_pausa_cuenta_fecha on public.historial_pausa_cuenta (created_at desc);

alter table public.historial_pausa_cuenta enable row level security;
revoke all on public.historial_pausa_cuenta from anon, authenticated;
grant select on public.historial_pausa_cuenta to authenticated;
drop policy if exists historial_pausa_cuenta_select_admin on public.historial_pausa_cuenta;
create policy historial_pausa_cuenta_select_admin on public.historial_pausa_cuenta
  for select to authenticated using ((select public.es_admin()));

/**
 * ¿Está cerrada /cuenta PARA QUIEN LLAMA? Solo es true para el rol asociado
 * (los demás roles nunca quedan fuera). Devuelve también el mensaje.
 */
create or replace function public.estado_pausa_cuenta()
returns table (pausada boolean, mensaje text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.cuenta_pausada and coalesce(
      (select p.rol = 'asociado'::public.rol_usuario from public.perfiles p where p.id = (select auth.uid())),
      false
    ),
    c.mensaje_pausa
  from public.configuracion_plataforma c
  where c.id;
$$;
revoke all on function public.estado_pausa_cuenta() from public, anon;
grant execute on function public.estado_pausa_cuenta() to authenticated;

create or replace function public.admin_cambiar_pausa_cuenta(p_pausada boolean, p_mensaje text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mensaje text := nullif(btrim(regexp_replace(coalesce(p_mensaje, ''), '\s+', ' ', 'g')), '');
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede pausar el ingreso de asociados';
  end if;
  if p_pausada is null then
    raise exception 'Faltan datos para cambiar la pausa';
  end if;
  if v_mensaje is not null and char_length(v_mensaje) not between 5 and 300 then
    raise exception 'El mensaje debe tener entre 5 y 300 caracteres';
  end if;

  update public.configuracion_plataforma
     set cuenta_pausada = p_pausada,
         mensaje_pausa = case when p_pausada then v_mensaje else null end,
         actualizado_por = (select auth.uid()),
         actualizado_at = now()
   where id;

  insert into public.historial_pausa_cuenta (pausada, mensaje, actor_id)
  values (p_pausada, case when p_pausada then v_mensaje else null end, (select auth.uid()));
end;
$$;
revoke all on function public.admin_cambiar_pausa_cuenta(boolean, text) from public, anon;
grant execute on function public.admin_cambiar_pausa_cuenta(boolean, text) to authenticated;

-- ------------------------------------------------------------
-- B) Avisos para el próximo ingreso
-- ------------------------------------------------------------
create table if not exists public.avisos_asociados (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null check (char_length(btrim(titulo)) between 3 and 80),
  mensaje         text not null check (char_length(btrim(mensaje)) between 5 and 1000),
  activo          boolean not null default true,
  creado_por      uuid references public.perfiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  desactivado_por uuid references public.perfiles (id) on delete set null,
  desactivado_at  timestamptz
);
comment on table public.avisos_asociados is
  'Avisos que el admin publica; cada asociado que ya existía al publicarlo lo ve una vez al entrar a /cuenta. Se escriben solo por RPC.';
create index if not exists ix_avisos_asociados_activos on public.avisos_asociados (created_at desc) where activo;
create index if not exists ix_avisos_asociados_creado_por on public.avisos_asociados (creado_por);
create index if not exists ix_avisos_asociados_desactivado_por on public.avisos_asociados (desactivado_por);

alter table public.avisos_asociados enable row level security;
revoke all on public.avisos_asociados from anon, authenticated;
grant select on public.avisos_asociados to authenticated;
drop policy if exists avisos_asociados_select_admin on public.avisos_asociados;
create policy avisos_asociados_select_admin on public.avisos_asociados
  for select to authenticated using ((select public.es_admin()));

create table if not exists public.avisos_vistos (
  aviso_id    uuid not null references public.avisos_asociados (id) on delete cascade,
  asociado_id uuid not null references public.perfiles (id) on delete cascade,
  visto_at    timestamptz not null default now(),
  primary key (aviso_id, asociado_id)
);
create index if not exists ix_avisos_vistos_asociado on public.avisos_vistos (asociado_id);

alter table public.avisos_vistos enable row level security;
revoke all on public.avisos_vistos from anon, authenticated;
grant select on public.avisos_vistos to authenticated;
drop policy if exists avisos_vistos_select_admin on public.avisos_vistos;
create policy avisos_vistos_select_admin on public.avisos_vistos
  for select to authenticated using ((select public.es_admin()));

/** Avisos activos que el asociado que llama todavía no ha visto (el más antiguo primero). */
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
  -- Solo se marca un aviso que exista y que le corresponda (mismas reglas de mis_avisos_pendientes).
  insert into public.avisos_vistos (aviso_id, asociado_id)
  select a.id, p.id
  from public.avisos_asociados a
  join public.perfiles p on p.id = (select auth.uid())
  where a.id = p_aviso_id
    and p.rol = 'asociado'::public.rol_usuario
    and a.created_at >= p.created_at
  on conflict (aviso_id, asociado_id) do nothing;
end;
$$;
revoke all on function public.marcar_aviso_visto(uuid) from public, anon;
grant execute on function public.marcar_aviso_visto(uuid) to authenticated;

create or replace function public.admin_crear_aviso(p_titulo text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo  text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
  v_mensaje text := btrim(coalesce(p_mensaje, ''));
  v_id      uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede publicar avisos';
  end if;
  if char_length(v_titulo) not between 3 and 80 then
    raise exception 'El título debe tener entre 3 y 80 caracteres';
  end if;
  if char_length(v_mensaje) not between 5 and 1000 then
    raise exception 'El mensaje debe tener entre 5 y 1000 caracteres';
  end if;
  insert into public.avisos_asociados (titulo, mensaje, creado_por)
  values (v_titulo, v_mensaje, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_crear_aviso(text, text) from public, anon;
grant execute on function public.admin_crear_aviso(text, text) to authenticated;

create or replace function public.admin_desactivar_aviso(p_aviso_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede retirar avisos';
  end if;
  update public.avisos_asociados
     set activo = false, desactivado_por = (select auth.uid()), desactivado_at = now()
   where id = p_aviso_id and activo;
  if not found then
    raise exception 'El aviso no existe o ya estaba retirado';
  end if;
end;
$$;
revoke all on function public.admin_desactivar_aviso(uuid) from public, anon;
grant execute on function public.admin_desactivar_aviso(uuid) to authenticated;
