-- El convenio edita los datos de su ficha desde /convenio/empresa.
--
-- 1) actualizar_datos_convenio(): SECURITY DEFINER. Solo toca los campos que
--    ve el asociado y que la empresa conoce mejor que nadie (especialidad,
--    descripción, WhatsApp, servicios, sedes y logo). Nombre, NIT, orden,
--    visibilidad, emoji y medios siguen siendo solo del admin. El convenio
--    sale de convenio_del_usuario() (rol convenio, cuenta activa, convenio
--    visible y no eliminado): nunca llega como parámetro.
-- 2) Storage: el convenio sube y borra archivos SOLO dentro de su carpeta
--    <convenio_id>/ del bucket público convenios-logos (las rutas que ya usa
--    el admin, ver app/admin/convenios/actions.ts → rutaLogo).
--
-- Los check de la tabla (largos, WhatsApp 3XXXXXXXXX, listas ≤ 20/10) siguen
-- aplicando: la función no los relaja.

create or replace function public.actualizar_datos_convenio(
  p_especialidad text,
  p_descripcion  text,
  p_telefono     text,
  p_servicios    text[],
  p_sedes        text[],
  p_cambiar_logo boolean,
  p_logo_path    text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.convenio_del_usuario();
  v_logo_anterior text;
begin
  if v_id is null then
    raise exception 'sin_convenio' using errcode = '42501';
  end if;

  if p_especialidad is null or char_length(btrim(p_especialidad)) = 0 then
    raise exception 'especialidad_vacia' using errcode = '22023';
  end if;

  if p_cambiar_logo and p_logo_path is not null
     and (p_logo_path not like v_id::text || '/%' or p_logo_path like '%..%') then
    raise exception 'logo_fuera_de_carpeta' using errcode = '42501';
  end if;

  select c.logo_path into v_logo_anterior from public.convenios c where c.id = v_id for update;

  update public.convenios c
     set especialidad      = btrim(p_especialidad),
         descripcion       = nullif(btrim(coalesce(p_descripcion, '')), ''),
         telefono_contacto = nullif(btrim(coalesce(p_telefono, '')), ''),
         servicios         = coalesce(p_servicios, '{}'),
         sedes             = coalesce(p_sedes, '{}'),
         logo_path         = case when p_cambiar_logo then p_logo_path else c.logo_path end,
         actualizado_en    = now()
   where c.id = v_id;

  -- Devuelve el logo anterior solo si se reemplazó: la Server Action lo borra.
  return case when p_cambiar_logo and v_logo_anterior is distinct from p_logo_path then v_logo_anterior end;
end;
$$;

revoke all on function public.actualizar_datos_convenio(text, text, text, text[], text[], boolean, text) from public, anon;
grant execute on function public.actualizar_datos_convenio(text, text, text, text[], text[], boolean, text) to authenticated;
comment on function public.actualizar_datos_convenio(text, text, text, text[], text[], boolean, text) is
  'El convenio con sesión edita especialidad, descripción, WhatsApp, servicios, sedes y logo de SU ficha. Devuelve el logo reemplazado (o null).';

-- Storage: carpeta propia del convenio en convenios-logos.
drop policy if exists convenios_logos_convenio_insert on storage.objects;
create policy convenios_logos_convenio_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'convenios-logos'
    and (storage.foldername(name))[1] = (select public.convenio_del_usuario())::text
  );

drop policy if exists convenios_logos_convenio_select on storage.objects;
create policy convenios_logos_convenio_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'convenios-logos'
    and (storage.foldername(name))[1] = (select public.convenio_del_usuario())::text
  );

drop policy if exists convenios_logos_convenio_delete on storage.objects;
create policy convenios_logos_convenio_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'convenios-logos'
    and (storage.foldername(name))[1] = (select public.convenio_del_usuario())::text
  );
