-- ============================================================
-- ga-auditor-supabase, 2026-09-24 — Fase 2 · PARTE 1. NO APLICADA en producción.
-- Bucket PRIVADO para las 3 fotos de la afiliación (cédula frente, cédula
-- reverso, selfie). public = false. Límite 5 MB. Solo jpeg/png/webp.
--
-- Acceso:
--  * Storage ya tiene RLS habilitado por defecto en storage.objects. Este
--    archivo NO agrega ninguna política para anon ni authenticated: sin
--    política, RLS niega todo. Ni el propio solicitante puede leer sus
--    fotos por la API; nadie las sube salvo el servidor.
--  * Subida: solo desde el servidor, con el cliente de service role
--    (bypassa RLS igual que en las demás tablas de este proyecto).
--  * Lectura: solo el panel /admin, y con URL firmada
--    (`createSignedUrl`) generada TAMBIÉN con el cliente de service role,
--    después de que el servidor comprobó con la sesión normal del usuario
--    que es admin (select public.es_admin() con el cliente autenticado del
--    usuario, ANTES de usar el cliente de service role). Así no hace falta
--    ninguna política de storage.objects para "authenticated + admin": el
--    control de quién pide la URL firmada vive en la Server Action /
--    Route Handler, no en RLS de storage.
-- Idempotente: insert ... on conflict do nothing / do update.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'afiliacion-documentos',
  'afiliacion-documentos',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Nada para anon/authenticated: ni política de storage.objects ni de
-- storage.buckets. Solo service_role (que siempre bypasa RLS) puede
-- subir, listar y firmar URLs de este bucket.
