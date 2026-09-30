-- ============================================================
-- ga-auditor-supabase, 2026-09-29 — Requerimientos de Ricardo (spec §1).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Va después de 20260929100000_perfiles_atiende_asociados.sql.
--
-- DECISIÓN: catálogo public.grados (texto + FK), NO ampliar el enum.
--   * El enum public.grado_policial (PP, PT, SI, IT, OF) mezcla dos cosas:
--     el grado de la persona y el GRUPO de crédito. «OF» no es un grado de
--     los 17: es el grupo de los oficiales (ST, TE, CT, MY, TC → R-02).
--   * Un enum no guarda nombre, institución ni grupo; y `alter type ... add
--     value` no se puede usar en la misma transacción (habría que partir la
--     migración en dos y nunca se puede quitar un valor).
--   * Por eso:
--       - grado_policial SE QUEDA como el tipo del GRUPO de crédito:
--         grados_credito (sin cambios, spec §0), solicitudes_credito.grado
--         (el grupo con que se calculó el tope) y grados.grupo_credito.
--       - perfiles.grado y solicitudes_afiliacion.grado pasan a TEXT con FK a
--         grados(codigo). Los valores de hoy (PP, PT, SI, IT, OF) siguen
--         siendo válidos: están en el catálogo. «OF» queda como grado
--         heredado (seleccionable = false): no aparece en el formulario, pero
--         los perfiles/afiliaciones antiguos con OF no se rompen.
--       - solicitudes_credito.grado_asociado (nuevo, texto + FK): el grado
--         real de la persona cuando pidió (p. ej. TE), junto al grupo (OF).
--   * Regla de crédito: si el grado no tiene grupo_credito (IJ y militares
--     SLP–SP), el trigger chk_monto_solicitud rechaza la solicitud con el
--     texto de la spec. No se inventan montos.
--
-- Qué más se ajusta porque perfiles.grado deja de ser enum:
--   handle_new_user, sincronizar_perfil_desde_app_metadata (validan contra
--   el catálogo), validar_monto_solicitud, sellar_revision_solicitud y
--   resumen_clientes_asesor (su columna grado pasa a text; mismos nombres de
--   columna, así que la prueba 07 que las revisa sigue igual).
--
-- Filtro por institución (§1): columnas policia / ejercito del catálogo. Se
-- valida en el servidor (zod) al afiliarse; la base NO lo exige porque las
-- afiliaciones antiguas no lo cumplen (el formulario viejo ofrecía los 5
-- grupos a las dos instituciones) y no da poder: el admin revisa la cédula
-- en foto antes de aprobar. Ver pregunta abierta en el reporte.
--
-- CAMBIOS DE CÓDIGO en el mismo despliegue (si no, fallan):
--   * lib/grados.ts: leer `grados` (codigo, nombre, policia, ejercito,
--     seleccionable) en vez de grados_credito.
--   * app/cuenta/page.tsx y app/cuenta/solicitar/*: el tope se busca por el
--     GRUPO: perfiles.select('grado, grados(nombre, grupo_credito)') y luego
--     grados_credito.eq('grado', grupo_credito). Con grupo null: aviso
--     «Tu grado todavía no tiene cupo de crédito configurado; tu asesor te
--     contactará» y sin botón de solicitar.
--   * lib/validaciones/afiliacion.ts: GRADOS deja de ser la lista del enum.
-- Idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Catálogo
-- ------------------------------------------------------------
create table if not exists public.grados (
  codigo         text primary key check (codigo ~ '^[A-Z0-9]{2,3}$'),
  nombre         text not null check (char_length(btrim(nombre)) between 3 and 60),
  policia        boolean not null default false,
  ejercito       boolean not null default false,
  grupo_credito  public.grado_policial,          -- null = sin cupo de crédito configurado
  orden          smallint not null,
  seleccionable  boolean not null default true,  -- false = grado heredado, no se ofrece en /afiliacion
  constraint grados_alguna_institucion_chk check (policia or ejercito)
);

comment on table public.grados is
  'Catálogo de los 17 grados (spec §1) + OF heredado. grupo_credito dice qué fila de grados_credito aplica; null = no puede pedir crédito todavía.';
comment on column public.grados.grupo_credito is
  'Grupo de crédito (PP/PT/SI/IT/OF) cuyos topes aplican. null: IJ y militares SLP–SP (sin cifras en la presentación).';
comment on column public.grados.seleccionable is
  'false = solo existe para no romper datos antiguos (OF). No se ofrece en el formulario de afiliación.';

insert into public.grados (codigo, nombre, policia, ejercito, grupo_credito, orden, seleccionable) values
  ('PP',  'Patrullero de Policía', true,  false, 'PP', 1,  true),
  ('PT',  'Patrullero',            true,  false, 'PT', 2,  true),
  ('SI',  'Subintendente',         true,  false, 'SI', 3,  true),
  ('IT',  'Intendente',            true,  false, 'IT', 4,  true),
  ('IJ',  'Intendente Jefe',       true,  false, null, 5,  true),
  -- TODO(confirmar: R-01) SLP solo Ejército.
  ('SLP', 'Soldado Profesional',   false, true,  null, 6,  true),
  ('C3',  'Cabo Tercero',          false, true,  null, 7,  true),
  ('CS',  'Cabo Segundo',          false, true,  null, 8,  true),
  ('CP',  'Cabo Primero',          false, true,  null, 9,  true),
  ('SS',  'Sargento Segundo',      false, true,  null, 10, true),
  ('SV',  'Sargento Viceprimero',  false, true,  null, 11, true),
  ('SP',  'Sargento Primero',      false, true,  null, 12, true),
  -- TODO(confirmar: R-02) ST–TC usan las cifras de OF.
  ('ST',  'Subteniente',           true,  true,  'OF', 13, true),
  ('TE',  'Teniente',              true,  true,  'OF', 14, true),
  ('CT',  'Capitán',               true,  true,  'OF', 15, true),
  ('MY',  'Mayor',                 true,  true,  'OF', 16, true),
  ('TC',  'Teniente Coronel',      true,  true,  'OF', 17, true),
  -- Heredado: perfiles/afiliaciones creados con el enum viejo (grupo OF sin grado exacto).
  ('OF',  'Oficial (grado sin especificar)', true, true, 'OF', 99, false)
on conflict (codigo) do nothing;  -- no pisa lo que el admin haya cambiado

alter table public.grados enable row level security;
revoke all on public.grados from anon, authenticated;
-- Lectura pública: nombres de grados, sin datos personales ni montos.
grant select on public.grados to anon, authenticated;
-- El admin solo puede cambiar el grupo de crédito (p. ej. cuando la
-- cooperativa defina el cupo de IJ). Altas y bajas de grados: por migración.
grant update (grupo_credito) on public.grados to authenticated;

drop policy if exists "grados_catalogo_select" on public.grados;
create policy "grados_catalogo_select" on public.grados
  for select to anon, authenticated using (true);

drop policy if exists "grados_catalogo_update_admin" on public.grados;
create policy "grados_catalogo_update_admin" on public.grados
  for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- ------------------------------------------------------------
-- 2. perfiles.grado y solicitudes_afiliacion.grado: enum → text + FK
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'perfiles'
               and column_name = 'grado' and data_type = 'USER-DEFINED') then
    alter table public.perfiles alter column grado type text using grado::text;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'solicitudes_afiliacion'
               and column_name = 'grado' and data_type = 'USER-DEFINED') then
    alter table public.solicitudes_afiliacion alter column grado type text using grado::text;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'perfiles_grado_fkey') then
    alter table public.perfiles
      add constraint perfiles_grado_fkey foreign key (grado)
      references public.grados (codigo) on update cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'solicitudes_afiliacion_grado_fkey') then
    alter table public.solicitudes_afiliacion
      add constraint solicitudes_afiliacion_grado_fkey foreign key (grado)
      references public.grados (codigo) on update cascade;
  end if;
end $$;

create index if not exists ix_perfiles_grado on public.perfiles (grado);
create index if not exists ix_afiliacion_grado on public.solicitudes_afiliacion (grado);

comment on column public.perfiles.grado is
  'Código del grado (public.grados). El tope de crédito sale de grados.grupo_credito. Solo lo cambia el admin.';
comment on column public.solicitudes_afiliacion.grado is
  'Código del grado elegido en /afiliacion (public.grados, seleccionable).';

-- Grado de una afiliación: debe existir; al crearla, además, ser seleccionable.
-- (El errcode 22P02 es el mismo que daba el enum con un valor inválido.)
create or replace function public.validar_grado_afiliacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.grado is null then
    return new;  -- el not null de la columna da el error
  end if;
  if not exists (select 1 from public.grados g where g.codigo = new.grado) then
    raise exception 'El grado % no existe', new.grado using errcode = '22P02';
  end if;
  if tg_op = 'INSERT'
     and not exists (select 1 from public.grados g where g.codigo = new.grado and g.seleccionable) then
    raise exception 'El grado % ya no se puede elegir; escoge tu grado exacto', new.grado;
  end if;
  return new;
end;
$$;
revoke all on function public.validar_grado_afiliacion() from public, anon, authenticated;

drop trigger if exists tr_validar_grado_afiliacion on public.solicitudes_afiliacion;
create trigger tr_validar_grado_afiliacion
  before insert or update of grado on public.solicitudes_afiliacion
  for each row execute function public.validar_grado_afiliacion();

-- ------------------------------------------------------------
-- 3. solicitudes_credito.grado_asociado: el grado real al pedir
--    (solicitudes_credito.grado sigue siendo el GRUPO, enum).
-- ------------------------------------------------------------
alter table public.solicitudes_credito
  add column if not exists grado_asociado text references public.grados (codigo) on update cascade;

create index if not exists ix_solicitudes_grado_asociado on public.solicitudes_credito (grado_asociado);

-- Las solicitudes que ya existan: su grado era el mismo código del grupo.
alter table public.solicitudes_credito disable trigger user;
update public.solicitudes_credito
   set grado_asociado = grado::text
 where grado_asociado is null;
alter table public.solicitudes_credito enable trigger user;

alter table public.solicitudes_credito alter column grado_asociado set not null;

comment on column public.solicitudes_credito.grado is
  'GRUPO de crédito (PP/PT/SI/IT/OF) con que se calculó el tope al pedir.';
comment on column public.solicitudes_credito.grado_asociado is
  'Grado real del asociado al pedir (public.grados), p. ej. TE con grupo OF. Lo pone el servidor.';

-- ------------------------------------------------------------
-- 4. Validación del crédito: el tope sale del grupo del grado
-- ------------------------------------------------------------
create or replace function public.validar_monto_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_grupo  public.grado_policial;
  v_tope   public.grados_credito%rowtype;
begin
  if tg_op = 'UPDATE' then
    -- Resueltas: las congela sellar_revision_solicitud.
    if old.estado <> 'pendiente'::public.estado_solicitud then
      return new;
    end if;
    -- Pendiente: solo se resuelve. Para cambiar condiciones, se rechaza y se pide otra.
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.grado_asociado,
        new.tasa_interes_mensual, new.plazo_meses, new.cuota_mensual)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.grado_asociado,
        old.tasa_interes_mensual, old.plazo_meses, old.cuota_mensual) then
      raise exception 'Las condiciones de una solicitud no se pueden modificar; recházela y cree una nueva';
    end if;
    return new;
  end if;

  -- El grado sale siempre del perfil, nunca de lo que mande el cliente.
  select p.grado into v_codigo from public.perfiles p where p.id = new.asociado_id;
  if v_codigo is null then
    raise exception 'El asociado no tiene un grado asignado; no se puede calcular el tope de crédito';
  end if;

  select g.grupo_credito into v_grupo from public.grados g where g.codigo = v_codigo;
  if v_grupo is null then
    -- Spec §1: IJ y militares pueden afiliarse pero no pedir crédito.
    raise exception 'Tu grado todavía no tiene cupo de crédito configurado; tu asesor te contactará';
  end if;

  select * into v_tope
  from public.grados_credito gc
  where gc.grado = v_grupo and gc.porcentaje = new.porcentaje_devolucion;
  if not found then
    raise exception 'No hay un tope configurado para el grado % con devolución del %',
      v_grupo, new.porcentaje_devolucion::text || '%';
  end if;

  if new.monto_solicitado is null or new.monto_solicitado <= 0 then
    raise exception 'El monto solicitado debe ser mayor que cero';
  end if;

  if new.monto_solicitado = 'Infinity'::numeric or new.monto_solicitado <> trunc(new.monto_solicitado) then
    raise exception 'El monto solicitado debe ser un valor en pesos, sin decimales';
  end if;

  if new.monto_solicitado < 100000 then
    raise exception 'El monto mínimo de un crédito es 100000';
  end if;

  if new.monto_solicitado > v_tope.capacidad_maxima then
    raise exception 'El monto solicitado (%) supera el tope de % para el grado % con devolución del %',
      new.monto_solicitado, v_tope.capacidad_maxima, v_grupo, new.porcentaje_devolucion::text || '%';
  end if;

  -- Condiciones: SIEMPRE las pone el servidor (se ignora lo que mande el cliente).
  new.grado                := v_grupo;
  new.grado_asociado       := v_codigo;
  new.tasa_interes_mensual := v_tope.tasa_interes_mensual;
  new.plazo_meses          := v_tope.plazo_meses;
  new.cuota_mensual        := null;
  return new;
end;
$$;
revoke all on function public.validar_monto_solicitud() from public, anon, authenticated;

-- Resueltas congeladas: se suma grado_asociado a la lista.
create or replace function public.sellar_revision_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asociado_id is distinct from old.asociado_id then
    raise exception 'Una solicitud no puede cambiar de asociado';
  end if;

  if old.estado <> 'pendiente'::public.estado_solicitud then
    if new.estado is distinct from old.estado then
      raise exception 'Una solicitud ya resuelta no puede cambiar de estado';
    end if;
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.grado_asociado,
        new.tasa_interes_mensual, new.plazo_meses, new.cuota_mensual,
        new.motivo_rechazo, new.revisado_por, new.fecha_respuesta, new.fecha_solicitud)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.grado_asociado,
        old.tasa_interes_mensual, old.plazo_meses, old.cuota_mensual,
        old.motivo_rechazo, old.revisado_por, old.fecha_respuesta, old.fecha_solicitud) then
      raise exception 'Una solicitud ya resuelta no se puede modificar';
    end if;
  end if;

  if old.estado = 'pendiente'::public.estado_solicitud and new.estado is distinct from old.estado then
    if auth.uid() is not null and new.asociado_id = auth.uid() then
      raise exception 'No puede aprobar ni rechazar su propia solicitud; debe hacerlo otro administrador';
    end if;
    new.revisado_por    := auth.uid();
    new.fecha_respuesta := now();
  end if;

  new.fecha_solicitud := old.fecha_solicitud;
  return new;
end;
$$;
revoke all on function public.sellar_revision_solicitud() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Alta de usuarios: el grado se valida contra el catálogo
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := nullif(btrim(new.raw_app_meta_data ->> 'cedula'), '');
  v_grado  text := nullif(btrim(new.raw_app_meta_data ->> 'grado'), '');
begin
  -- Solo se acepta una cédula de 6 a 10 dígitos; si no, queda como PENDIENTE-xxxx.
  if v_cedula is null or v_cedula !~ '^[0-9]{6,10}$' then
    v_cedula := 'PENDIENTE-' || left(new.id::text, 8);
  end if;

  -- Solo un código que exista en el catálogo; si no, grado null (lo asigna el admin).
  if v_grado is not null
     and not exists (select 1 from public.grados g where g.codigo = v_grado) then
    v_grado := null;
  end if;

  insert into public.perfiles (id, cedula, nombre_completo, telefono, grado)
  values (
    new.id,
    v_cedula,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre_completo'), ''), 'Sin nombre'),
    nullif(btrim(new.raw_user_meta_data ->> 'telefono'), ''),
    v_grado
  )
  on conflict (id) do nothing;
  -- El rol nunca se toma de metadatos: siempre queda el default 'asociado'.
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.sincronizar_perfil_desde_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula       text := nullif(btrim(new.raw_app_meta_data ->> 'cedula'), '');
  v_cedula_antes text := nullif(btrim(old.raw_app_meta_data ->> 'cedula'), '');
  v_grado        text := nullif(btrim(new.raw_app_meta_data ->> 'grado'), '');
  v_grado_antes  text := nullif(btrim(old.raw_app_meta_data ->> 'grado'), '');
begin
  if v_cedula is not null
     and v_cedula ~ '^[0-9]{6,10}$'
     and v_cedula is distinct from v_cedula_antes then
    update public.perfiles
       set cedula = v_cedula
     where id = new.id
       and cedula like 'PENDIENTE-%';
  end if;

  if v_grado is not null
     and v_grado is distinct from v_grado_antes
     and exists (select 1 from public.grados g where g.codigo = v_grado) then
    update public.perfiles
       set grado = v_grado
     where id = new.id
       and grado is null;
  end if;

  return null; -- AFTER trigger: el valor de retorno se ignora
end;
$$;
revoke all on function public.sincronizar_perfil_desde_app_metadata() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6. resumen_clientes_asesor: la columna grado pasa a text.
--    Cambia el tipo de retorno → hay que borrarla y crearla de nuevo.
--    Mismas columnas y mismo blindaje F2-03 (rol ACTUAL de quien llama),
--    ahora con puede_atender() (asesor, o admin que atiende).
-- ------------------------------------------------------------
drop function if exists public.resumen_clientes_asesor();

create function public.resumen_clientes_asesor()
returns table (
  origen            text,
  perfil_id         uuid,
  solicitud_id      uuid,
  nombre            text,
  cedula            text,
  grado             text,
  estado_afiliacion public.estado_afiliacion,
  estado_credito    public.estado_solicitud
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'asociado'::text,
    p.id,
    null::uuid,
    p.nombre_completo,
    p.cedula,
    p.grado,
    null::public.estado_afiliacion,
    ultima.estado
  from public.perfiles p
  left join lateral (
    select s.estado
    from public.solicitudes_credito s
    where s.asociado_id = p.id
    order by s.fecha_solicitud desc
    limit 1
  ) ultima on true
  where p.asesor_id = (select auth.uid())
    and (select public.puede_atender((select auth.uid())))

  union all

  select
    'solicitud_afiliacion'::text,
    null::uuid,
    a.id,
    a.nombre,
    a.cedula,
    a.grado,
    a.estado,
    null::public.estado_solicitud
  from public.solicitudes_afiliacion a
  where a.asesor_id = (select auth.uid())
    and (select public.puede_atender((select auth.uid())));
$$;
revoke all on function public.resumen_clientes_asesor() from public, anon;
grant execute on function public.resumen_clientes_asesor() to authenticated;
comment on function public.resumen_clientes_asesor() is
  'Resumen de "mis clientes": nombre, cédula, código de grado, estado de afiliación y de crédito. Nunca celular, correo, nequi, nómina ni fotos. Solo devuelve filas si quien llama puede_atender() HOY.';
