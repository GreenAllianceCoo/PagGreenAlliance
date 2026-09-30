-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §4).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- 1. convenios.servicios text[] y convenios.sedes text[] (viñetas y sedes).
--    El WhatsApp va en telefono_contacto (10 dígitos, sin +57).
-- 2. MIGRACIÓN DE DATOS: los 5 convenios de la spec §4. Textos literales de
--    «REQUERIMIENTO DE PAGINA WEB 2.pdf» (páginas 3 y 4), con tildes y con
--    las mayúsculas de Racing Tours corregidas («Tour en cuatrimoto», …).
--    NIT de la presentación. Nombre, emoji y especialidad iguales a
--    lib/convenios.ts (lo que ya muestra la app).
--    Idempotente por NIT: si ya existe un convenio con ese NIT se actualiza;
--    si no, se crea. No borra ni toca otros convenios.
-- Lectura: sin cambios (convenios_select_activos: autenticados; anon no).
-- ============================================================

alter table public.convenios
  add column if not exists servicios text[] not null default '{}',
  add column if not exists sedes     text[] not null default '{}';

comment on column public.convenios.servicios is 'Servicios del convenio, uno por viñeta, en el orden en que se muestran.';
comment on column public.convenios.sedes is 'Direcciones de las sedes (vacío si no aplica).';
comment on column public.convenios.telefono_contacto is 'WhatsApp del convenio: 10 dígitos que empiezan por 3 (la app arma wa.me/57…).';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'convenios_listas_chk') then
    alter table public.convenios
      add constraint convenios_listas_chk
      check (cardinality(servicios) <= 20 and cardinality(sedes) <= 10
             and array_position(servicios, null) is null
             and array_position(sedes, null) is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'convenios_telefono_chk') then
    alter table public.convenios
      add constraint convenios_telefono_chk
      check (telefono_contacto is null or telefono_contacto ~ '^3[0-9]{9}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'convenios_descripcion_chk') then
    alter table public.convenios
      add constraint convenios_descripcion_chk
      check (descripcion is null or char_length(descripcion) <= 1000);
  end if;
end $$;

-- ------------------------------------------------------------
-- Datos (upsert por NIT)
-- ------------------------------------------------------------
with datos (nombre_empresa, nit, telefono_contacto, emoji, especialidad, descripcion, servicios, sedes) as (
  values
  (
    'AMB Móvil S.A.S.', '902.038.118-7', '3214612714', '📱', 'Tecnología',
    'Como aliado estratégico, pondrá al alcance de nuestros asociados una amplia oferta de tecnología de punta, que incluye:',
    array['Teléfonos celulares nuevos y usados', 'Retoma del equipo actual como parte de pago',
          'Servicio técnico especializado', 'Cámaras de video', 'Accesorios'],
    array[]::text[]
  ),
  (
    'Locos por los Viajes S.A.S.', '901.865.816-3', '3103397949', '✈️', 'Viajes y turismo',
    'Con el respaldo de nuestra agencia de viajes de confianza, los asociados contarán con asesoría experta para planificar sus próximas vacaciones en familia, a través de:',
    array['Planes diseñados a la medida', 'Vuelos nacionales e internacionales', 'Hoteles y resorts',
          'Paquetes de vacaciones', 'Circuitos turísticos', 'Cruceros de ensueño'],
    array[]::text[]
  ),
  (
    'Dr. Ribero Dental Group', '1.090.464.475-4', '3144612829', '🦷', 'Odontología estética',
    'Red de servicios de salud odontológica que da prioridad a la atención de nuestros asociados: un equipo humano altamente capacitado y materiales de primera calidad garantizan a cada paciente una experiencia cómoda y agradable.',
    array['Odontología general', 'Estética dental', 'Rehabilitación dental', 'Endodoncia',
          'Periodoncia', 'Implantología'],
    array['Calle 140 # 11-45, Torre HHC, consultorio 313, Bogotá',
          'Carrera 29 # 45-45, Metropolitan Business Park, consultorio 1609, Bucaramanga']
  ),
  (
    'Racing Tours Villa de Leyva', '1.054.095.149-3', '3138008830', '🏞️', 'Tours en Villa de Leyva',
    'Empresa en convenio ubicada en el municipio de Villa de Leyva (Boyacá), donde los asociados encontrarán una amplia oferta de aventuras, atendida directamente por su propietario, con excelentes recorridos y vehículos de última generación.',
    array['Tour en cuatrimoto', 'Tour en cabalgata (caballos)', 'Pit bike', 'Buggy', 'Termales', 'Chiva rumbera'],
    array['Villa de Leyva, Boyacá']
  ),
  (
    'Dream & Go Visas', '52.953.735-3', '3192544799', '🛂', 'Trámite de visas',
    'Mediante este convenio estratégico, ofreceremos acompañamiento integral durante la solicitud de visa, desde el inicio hasta su finalización. Profesionales especializados orientarán el diligenciamiento de formularios y evaluarán cada perfil para reducir el riesgo de rechazo en trámites individuales o grupales.',
    array['Visa Americana', 'Visa Canadiense'],
    array[]::text[]
  )
),
actualizados as (
  update public.convenios c
     set nombre_empresa    = d.nombre_empresa,
         telefono_contacto = d.telefono_contacto,
         emoji             = d.emoji,
         especialidad      = d.especialidad,
         descripcion       = d.descripcion,
         servicios         = d.servicios,
         sedes             = d.sedes
    from datos d
   where c.nit = d.nit
  returning c.nit
)
insert into public.convenios (nombre_empresa, nit, telefono_contacto, emoji, especialidad, descripcion, servicios, sedes, activo)
select d.nombre_empresa, d.nit, d.telefono_contacto, d.emoji, d.especialidad, d.descripcion, d.servicios, d.sedes, true
from datos d
where not exists (select 1 from public.convenios c where c.nit = d.nit)
  and d.nit not in (select nit from actualizados);
