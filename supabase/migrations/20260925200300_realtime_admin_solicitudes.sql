-- ============================================================
-- ga-auditor-supabase, 2026-09-25 — Brecha de backend del rediseño C+ (pieza 2d).
-- PROPUESTA: NO APLICADA. Sebas la revisa y la aplica.
--
-- El panel de admin (2d) quiere que una solicitud nueva aparezca sola en la
-- lista («Simular solicitud nueva», fila que entra resaltada). Eso es
-- Supabase Realtime (postgres_changes) sobre las tablas de solicitudes.
--
-- Protección: Realtime con postgres_changes evalúa las políticas RLS de
-- SELECT de la tabla usando la sesión (JWT) de quien se suscribe — no es un
-- canal aparte sin control de acceso. Con las políticas que ya existen:
--   * solicitudes_credito: "solicitudes_select" (asociado_id = auth.uid()
--     o es_admin()) → el admin recibe todas las filas; un asociado solo
--     recibiría eventos de SU PROPIA solicitud (útil también para que 2b
--     se actualice sola, aunque no se pidió); un asesor no recibe nada (no
--     tiene política propia sobre esta tabla; su acceso es por la función
--     resumen_clientes_asesor(), que Realtime no usa).
--   * solicitudes_afiliacion: "afiliacion_select_admin" (solo es_admin()) →
--     únicamente el admin recibe eventos; nadie más, ni siquiera el propio
--     solicitante (no tiene sesión al momento de enviar el formulario).
-- No hace falta ninguna política nueva: las que ya audita este proyecto
-- alcanzan para "solo el admin ve todo, cada quien ve como mucho lo suyo".
--
-- No se agrega historial_solicitudes a la publicación: no se pidió tiempo
-- real para el historial y así se evita filtrar por error las notas
-- internas si alguna vez se relaja esa tabla.
--
-- Falta de código (fuera de esta migración): suscribirse desde
-- app/admin/creditos y app/admin/afiliaciones con
-- supabase.channel(...).on('postgres_changes', { event: 'INSERT', schema:
-- 'public', table: 'solicitudes_credito' }, ...) usando el cliente de
-- sesión del admin (no el de service role, para que aplique RLS).
-- Idempotente: solo agrega la tabla a la publicación si no está ya.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_credito'
  ) then
    alter publication supabase_realtime add table public.solicitudes_credito;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_afiliacion'
  ) then
    alter publication supabase_realtime add table public.solicitudes_afiliacion;
  end if;
end $$;
