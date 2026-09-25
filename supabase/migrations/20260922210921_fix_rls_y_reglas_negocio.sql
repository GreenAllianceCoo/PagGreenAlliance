-- ============================================================
-- YA APLICADA EN PRODUCCIÓN (sqpmxizxkqorccpvjwoz) el 2026-09-22.
-- Copia textual de supabase_migrations.schema_migrations (versión
-- 20260922210921, nombre fix_rls_y_reglas_negocio), recuperada por
-- ga-auditor-supabase el 2026-09-23 para versionarla en el repo.
-- No volver a aplicar en producción. No editar: si hay que cambiar algo,
-- se hace en una migración nueva.
-- ============================================================

-- 1. es_admin()
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'admin'::public.rol_usuario);
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;
comment on function public.es_admin() is 'Indica si el usuario autenticado tiene rol admin. SECURITY DEFINER para evitar la recursión de RLS en perfiles.';

-- 2. perfiles
drop policy if exists "Admin ve todos los perfiles" on public.perfiles;
drop policy if exists "Un usuario ve y edita su propio perfil" on public.perfiles;
drop policy if exists "Un usuario actualiza su propio perfil" on public.perfiles;
drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles for select to authenticated using (auth.uid() = id);
drop policy if exists "perfiles_select_admin" on public.perfiles;
create policy "perfiles_select_admin" on public.perfiles for select to authenticated using (public.es_admin());
drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "perfiles_update_admin" on public.perfiles;
create policy "perfiles_update_admin" on public.perfiles for update to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "perfiles_insert_admin" on public.perfiles;
create policy "perfiles_insert_admin" on public.perfiles for insert to authenticated with check (public.es_admin());

create or replace function public.proteger_campos_perfil()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    if new.rol is distinct from old.rol then raise exception 'No puede modificar su propio rol'; end if;
    if new.grado is distinct from old.grado then raise exception 'No puede modificar su propio grado; solicítelo a la administración'; end if;
    if new.cedula is distinct from old.cedula then raise exception 'No puede modificar su número de cédula'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;
drop trigger if exists tr_proteger_campos_perfil on public.perfiles;
create trigger tr_proteger_campos_perfil before update on public.perfiles for each row execute function public.proteger_campos_perfil();

-- 3. handle_new_user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.perfiles (id, cedula, nombre_completo, telefono, grado)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'cedula', ''), 'PENDIENTE-' || left(new.id::text, 8)),
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre_completo', ''), 'Sin nombre'),
    nullif(new.raw_user_meta_data ->> 'telefono', ''),
    nullif(new.raw_user_meta_data ->> 'grado', '')::public.grado_policial
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists tr_on_auth_user_created on auth.users;
create trigger tr_on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 4. solicitudes_credito
drop policy if exists "Admin ve y actualiza todas las solicitudes" on public.solicitudes_credito;
drop policy if exists "Un asociado crea sus propias solicitudes" on public.solicitudes_credito;
drop policy if exists "Un asociado ve sus propias solicitudes" on public.solicitudes_credito;
drop policy if exists "solicitudes_select_propio" on public.solicitudes_credito;
create policy "solicitudes_select_propio" on public.solicitudes_credito for select to authenticated using (auth.uid() = asociado_id);
drop policy if exists "solicitudes_insert_propio" on public.solicitudes_credito;
create policy "solicitudes_insert_propio" on public.solicitudes_credito for insert to authenticated
  with check (auth.uid() = asociado_id and estado = 'pendiente'::public.estado_solicitud and revisado_por is null and fecha_respuesta is null and motivo_rechazo is null);
drop policy if exists "solicitudes_admin_todo" on public.solicitudes_credito;
create policy "solicitudes_admin_todo" on public.solicitudes_credito for all to authenticated using (public.es_admin()) with check (public.es_admin());
create unique index if not exists ux_solicitud_pendiente_por_asociado on public.solicitudes_credito (asociado_id) where estado = 'pendiente'::public.estado_solicitud;

-- 5. validación de monto / cuota / plazo
create or replace function public.validar_monto_solicitud()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_grado public.grado_policial;
  v_tope  public.grados_credito%rowtype;
begin
  select p.grado into v_grado from public.perfiles p where p.id = new.asociado_id;
  if v_grado is null then
    raise exception 'El asociado no tiene un grado asignado; no se puede calcular el tope de crédito';
  end if;
  select * into v_tope from public.grados_credito gc where gc.grado = v_grado and gc.porcentaje = new.porcentaje_devolucion;
  if not found then
    raise exception 'No hay un tope configurado para el grado % con devolución del %%%', v_grado, new.porcentaje_devolucion;
  end if;
  if new.monto_solicitado is null or new.monto_solicitado <= 0 then
    raise exception 'El monto solicitado debe ser mayor que cero';
  end if;
  if new.monto_solicitado > v_tope.capacidad_maxima then
    raise exception 'El monto solicitado (%) supera el tope de % para el grado % con devolución del %%%',
      new.monto_solicitado, v_tope.capacidad_maxima, v_grado, new.porcentaje_devolucion;
  end if;
  -- REGLA PROVISIONAL: cuota prorrateada sobre el tope del grado. Confirmar con la cooperativa.
  new.plazo_meses   := v_tope.plazo_meses;
  new.cuota_mensual := round(v_tope.cuota_mensual * new.monto_solicitado / v_tope.capacidad_maxima);
  return new;
end;
$$;
revoke all on function public.validar_monto_solicitud() from public, anon, authenticated;
drop trigger if exists chk_monto_solicitud on public.solicitudes_credito;
create trigger chk_monto_solicitud before insert or update of monto_solicitado, porcentaje_devolucion, asociado_id
  on public.solicitudes_credito for each row execute function public.validar_monto_solicitud();

create or replace function public.sellar_revision_solicitud()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado and old.estado = 'pendiente'::public.estado_solicitud then
    new.revisado_por    := auth.uid();
    new.fecha_respuesta := now();
  end if;
  if old.estado <> 'pendiente'::public.estado_solicitud and new.estado is distinct from old.estado then
    raise exception 'Una solicitud ya resuelta no puede cambiar de estado';
  end if;
  return new;
end;
$$;
revoke all on function public.sellar_revision_solicitud() from public, anon, authenticated;
drop trigger if exists tr_sellar_revision on public.solicitudes_credito;
create trigger tr_sellar_revision before update on public.solicitudes_credito for each row execute function public.sellar_revision_solicitud();

-- 6. grados_credito y convenios
drop policy if exists "Solo admin edita los topes" on public.grados_credito;
drop policy if exists "Cualquier usuario autenticado puede leer los topes" on public.grados_credito;
drop policy if exists "grados_select_autenticado" on public.grados_credito;
create policy "grados_select_autenticado" on public.grados_credito for select to authenticated using (true);
drop policy if exists "grados_admin_todo" on public.grados_credito;
create policy "grados_admin_todo" on public.grados_credito for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "Solo admin edita convenios" on public.convenios;
drop policy if exists "Cualquier usuario autenticado lee convenios activos" on public.convenios;
drop policy if exists "convenios_select_activos" on public.convenios;
create policy "convenios_select_activos" on public.convenios for select to authenticated using (activo = true or public.es_admin());
drop policy if exists "convenios_admin_todo" on public.convenios;
create policy "convenios_admin_todo" on public.convenios for all to authenticated using (public.es_admin()) with check (public.es_admin());
