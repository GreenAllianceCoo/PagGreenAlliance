-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.3 (R-04).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- Dominio del correo institucional según la institución, SOLO en filas
-- nuevas de solicitudes_afiliacion (trigger BEFORE INSERT; un CHECK
-- validaría también las filas viejas).
--   Policía: policia.gov.co, correo.policia.gov.co
--   Ejército: buzonejercito.mil.co, ejercito.mil.co
-- Comparación exacta del dominio (sin comodines de subdominio), sin
-- mayúsculas. Si viene null no se valida aquí: la obligatoriedad la exige
-- zod en el servidor (las pruebas viejas insertan sin correo institucional).
-- TODO(confirmar): si se quiere exigir not null en base para filas nuevas,
-- se agrega aquí mismo cuando se actualicen las pruebas 04/08.
-- Idempotente.
-- ============================================================

create or replace function public.dominios_correo_institucional(p_institucion public.institucion_afiliacion)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_institucion
           when 'policia'::public.institucion_afiliacion  then array['policia.gov.co', 'correo.policia.gov.co']
           when 'ejercito'::public.institucion_afiliacion then array['buzonejercito.mil.co', 'ejercito.mil.co']
         end;
$$;
comment on function public.dominios_correo_institucional(public.institucion_afiliacion) is
  'Dominios permitidos del correo institucional por institución (spec §12.3).';
revoke all on function public.dominios_correo_institucional(public.institucion_afiliacion) from public, anon;
grant execute on function public.dominios_correo_institucional(public.institucion_afiliacion) to authenticated, service_role;

create or replace function public.validar_dominio_correo_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.correo_institucional is null then
    return new;
  end if;
  if not (lower(split_part(new.correo_institucional, '@', 2))
          = any (coalesce(public.dominios_correo_institucional(new.institucion), array[]::text[]))) then
    if new.institucion = 'ejercito'::public.institucion_afiliacion then
      raise exception 'Usa tu correo institucional del Ejército (@buzonejercito.mil.co o @ejercito.mil.co)';
    else
      raise exception 'Usa tu correo institucional de la Policía (@policia.gov.co)';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validar_dominio_correo_afiliacion() from public, anon, authenticated;

drop trigger if exists tr_validar_dominio_correo_afiliacion on public.solicitudes_afiliacion;
create trigger tr_validar_dominio_correo_afiliacion
  before insert on public.solicitudes_afiliacion
  for each row execute function public.validar_dominio_correo_afiliacion();
