-- ============================================================
-- ga-auditor-supabase, 2026-09-23 — APLICADA en producción el 2026-09-23
-- Hallazgos H-05, H-06, H-07, H-08 (medio/bajo).
--
-- 1. Rendimiento de RLS (advisor auth_rls_initplan y
--    multiple_permissive_policies): se envuelve auth.uid() y es_admin()
--    en (select ...) para que se evalúen una vez por consulta, y se
--    fusiona en una sola política por acción (antes: "_propio" + "_admin"
--    + "for all"). LA SEMÁNTICA NO CAMBIA: quien podía leer/escribir antes
--    puede hacerlo ahora, y quien no, sigue sin poder.
-- 2. search_path = '' en las funciones security definer (hoy tienen
--    'public, pg_temp', que es aceptable; '' es la práctica recomendada
--    y todas ya usan nombres calificados).
-- 3. Privilegios de tabla: hoy anon y authenticated tienen TRUNCATE,
--    REFERENCES y TRIGGER, y anon tiene INSERT/UPDATE/DELETE en todo.
--    RLS ya lo bloquea (anon no tiene ninguna política), pero TRUNCATE
--    no pasa por RLS: se revoca como defensa en profundidad.
-- Idempotente: drop policy if exists + create; revoke es idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- perfiles
-- ------------------------------------------------------------
drop policy if exists "perfiles_select_propio" on public.perfiles;
drop policy if exists "perfiles_select_admin"  on public.perfiles;
drop policy if exists "perfiles_select"        on public.perfiles;
create policy "perfiles_select" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));

drop policy if exists "perfiles_update_propio" on public.perfiles;
drop policy if exists "perfiles_update_admin"  on public.perfiles;
drop policy if exists "perfiles_update"        on public.perfiles;
-- El trigger tr_proteger_campos_perfil sigue impidiendo que un asociado
-- cambie rol, grado o cédula.
create policy "perfiles_update" on public.perfiles
  for update to authenticated
  using      (id = (select auth.uid()) or (select public.es_admin()))
  with check (id = (select auth.uid()) or (select public.es_admin()));

drop policy if exists "perfiles_insert_admin" on public.perfiles;
create policy "perfiles_insert_admin" on public.perfiles
  for insert to authenticated
  with check ((select public.es_admin()));
-- Sin política de delete: nadie borra perfiles desde la API (se borra el usuario en Auth).

-- ------------------------------------------------------------
-- solicitudes_credito
-- ------------------------------------------------------------
drop policy if exists "solicitudes_select_propio" on public.solicitudes_credito;
drop policy if exists "solicitudes_insert_propio" on public.solicitudes_credito;
drop policy if exists "solicitudes_admin_todo"    on public.solicitudes_credito;
drop policy if exists "solicitudes_select"        on public.solicitudes_credito;
drop policy if exists "solicitudes_insert"        on public.solicitudes_credito;
drop policy if exists "solicitudes_update_admin"  on public.solicitudes_credito;
drop policy if exists "solicitudes_delete_admin"  on public.solicitudes_credito;

create policy "solicitudes_select" on public.solicitudes_credito
  for select to authenticated
  using (asociado_id = (select auth.uid()) or (select public.es_admin()));

create policy "solicitudes_insert" on public.solicitudes_credito
  for insert to authenticated
  with check (
    (select public.es_admin())
    or (
      asociado_id = (select auth.uid())
      and estado = 'pendiente'::public.estado_solicitud
      and revisado_por is null
      and fecha_respuesta is null
      and motivo_rechazo is null
    )
  );

-- Solo admin actualiza (aprobar / rechazar). El asociado no tiene política de update.
create policy "solicitudes_update_admin" on public.solicitudes_credito
  for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- Se conserva el comportamiento actual (admin puede borrar). Ver pregunta abierta P-05.
create policy "solicitudes_delete_admin" on public.solicitudes_credito
  for delete to authenticated
  using ((select public.es_admin()));

-- ------------------------------------------------------------
-- grados_credito
-- ------------------------------------------------------------
drop policy if exists "grados_select_autenticado" on public.grados_credito;
drop policy if exists "grados_admin_todo"         on public.grados_credito;
drop policy if exists "grados_insert_admin"       on public.grados_credito;
drop policy if exists "grados_update_admin"       on public.grados_credito;
drop policy if exists "grados_delete_admin"       on public.grados_credito;

create policy "grados_select_autenticado" on public.grados_credito
  for select to authenticated using (true);
create policy "grados_insert_admin" on public.grados_credito
  for insert to authenticated with check ((select public.es_admin()));
create policy "grados_update_admin" on public.grados_credito
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "grados_delete_admin" on public.grados_credito
  for delete to authenticated using ((select public.es_admin()));

-- ------------------------------------------------------------
-- convenios
-- ------------------------------------------------------------
drop policy if exists "convenios_select_activos" on public.convenios;
drop policy if exists "convenios_admin_todo"     on public.convenios;
drop policy if exists "convenios_insert_admin"   on public.convenios;
drop policy if exists "convenios_update_admin"   on public.convenios;
drop policy if exists "convenios_delete_admin"   on public.convenios;

create policy "convenios_select_activos" on public.convenios
  for select to authenticated using (activo = true or (select public.es_admin()));
create policy "convenios_insert_admin" on public.convenios
  for insert to authenticated with check ((select public.es_admin()));
create policy "convenios_update_admin" on public.convenios
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "convenios_delete_admin" on public.convenios
  for delete to authenticated using ((select public.es_admin()));

-- ------------------------------------------------------------
-- search_path vacío en funciones security definer
-- ------------------------------------------------------------
alter function public.es_admin()                  set search_path = '';
alter function public.handle_new_user()           set search_path = '';
alter function public.proteger_campos_perfil()    set search_path = '';
alter function public.validar_monto_solicitud()   set search_path = '';
alter function public.sellar_revision_solicitud() set search_path = '';

-- ------------------------------------------------------------
-- Privilegios de tabla (defensa en profundidad; RLS sigue siendo la barrera principal)
-- ------------------------------------------------------------
revoke truncate, references, trigger
  on public.perfiles, public.solicitudes_credito, public.grados_credito, public.convenios
  from anon, authenticated;

-- anon no escribe en ninguna tabla ni lee datos de asociados.
revoke insert, update, delete
  on public.perfiles, public.solicitudes_credito, public.grados_credito, public.convenios
  from anon;
revoke select on public.perfiles, public.solicitudes_credito from anon;
-- Se deja select de anon en grados_credito y convenios por si la landing
-- los muestra en el futuro (hoy RLS igual lo niega: no hay política para anon).

-- Para que tablas futuras no hereden TRUNCATE/REFERENCES/TRIGGER para anon/authenticated.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
