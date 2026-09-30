-- ============================================================
-- ga-auditor-supabase, 2026-09-25 — Brecha de backend del rediseño C+ (pieza 2b).
-- PROPUESTA: NO APLICADA. Sebas la revisa y la aplica.
--
-- El «carné de asociado» de la pieza 2b necesita nombre, cédula, grado
-- (ya existen en perfiles), institución (Policía Nacional / Ejército) y si
-- el asociado sigue activo. Estas dos últimas no existen en perfiles.
--
-- institucion: se reutiliza el enum public.institucion_afiliacion (mismo
-- valor que ya se captura en solicitudes_afiliacion, migración
-- 20260924000200). Queda NULL para los asociados que ya existen hoy: no
-- hay de dónde sacarlo sin tocar datos a mano. Cuando se conecte la acción
-- de «aprobar afiliación» (app/admin/afiliaciones/actions.ts) con la
-- creación del perfil, debería copiarlo desde
-- solicitudes_afiliacion.institucion — eso es un cambio de código aparte,
-- no de esta migración.
--
-- activo: por defecto true (todo asociado de hoy está activo). Esta
-- migración NO crea el flujo de «dar de baja» a alguien: eso es una
-- decisión de negocio (¿quién lo hace, con qué motivo, qué pasa con sus
-- solicitudes pendientes? — ver la pregunta abierta en el informe). Solo
-- deja el campo listo para que el carné pueda mostrar el estado y para que,
-- cuando la cooperativa decida el proceso, ya exista dónde guardarlo.
--
-- Ambas columnas quedan protegidas igual que rol/grado/cédula/nombre: el
-- propio asociado no las puede cambiar. proteger_campos_perfil se
-- reemplaza completo (mismo patrón que 20260924000100 al agregar
-- asesor_id: `create or replace` sustituye toda la función).
-- Idempotente.
-- ============================================================

alter table public.perfiles
  add column if not exists institucion public.institucion_afiliacion,
  add column if not exists activo boolean not null default true;

comment on column public.perfiles.institucion is
  'Policía Nacional o Ejército. Solo la escribe el admin (ver proteger_campos_perfil). NULL en asociados creados antes de esta columna, hasta que el admin la complete.';
comment on column public.perfiles.activo is
  'false = asociado dado de baja (el carné deja de mostrarlo como activo). Solo la escribe el admin; el proceso de baja lo define la cooperativa (pregunta abierta).';

create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id then raise exception 'No se puede cambiar el id de un perfil'; end if;
    if new.created_at is distinct from old.created_at then raise exception 'No se puede cambiar la fecha de creación del perfil'; end if;

    if not public.es_admin() then
      if new.rol is distinct from old.rol then raise exception 'No puede modificar su propio rol'; end if;
      if new.grado is distinct from old.grado then raise exception 'No puede modificar su propio grado; solicítelo a la administración'; end if;
      if new.cedula is distinct from old.cedula then raise exception 'No puede modificar su número de cédula'; end if;
      if new.nombre_completo is distinct from old.nombre_completo then raise exception 'No puede modificar su nombre; solicítelo a la administración'; end if;
      if new.asesor_id is distinct from old.asesor_id then raise exception 'No puede modificar su propio asesor; solicítelo a la administración'; end if;
      -- NUEVO (rediseño C+): institución y estado activo también son de solo lectura para el asociado.
      if new.institucion is distinct from old.institucion then raise exception 'No puede modificar su institución; solicítelo a la administración'; end if;
      if new.activo is distinct from old.activo then raise exception 'No puede modificar su estado de asociado; solicítelo a la administración'; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.proteger_campos_perfil() from public, anon, authenticated;
