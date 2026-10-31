-- ============================================================
-- 2026-10-30 — El admin edita las condiciones de un crédito.
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica
-- ANTES de desplegar el código (la app ya pide estas columnas). Idempotente.
--
-- Hasta el desembolso (pendiente o aprobado sin desembolsar), solo por la RPC
-- admin_editar_condiciones_credito(), con motivo y historial:
--   * lo que recibe (monto_solicitado) y lo que devuelve (total_a_pagar);
--   * plazo_meses;
--   * porcentaje_credito: entero de 50 a 100. La tasa se interpola entre los
--     paquetes de 50 % y 100 % del grupo;
--   * tipo_credito: cooperativa o convenio (con convenio_id).
-- El admin PUEDE superar el cupo (decisión de Sebas, 30-oct): queda en el
-- historial con su motivo.
-- porcentaje_devolucion (enum) queda como lo que eligió el asociado: no cambia.
-- total_a_pagar revela la tasa: como ella, authenticated no lo lee; el admin
-- lo pide con admin_condiciones_solicitudes().
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'tipo_credito') then
    create type public.tipo_credito as enum ('cooperativa', 'convenio');
  end if;
end $$;

alter table public.solicitudes_credito
  add column if not exists porcentaje_credito smallint,
  add column if not exists total_a_pagar numeric,
  add column if not exists tipo_credito public.tipo_credito not null default 'cooperativa',
  add column if not exists convenio_id uuid references public.convenios (id) on delete restrict,
  add column if not exists condiciones_editadas_at timestamptz,
  add column if not exists condiciones_editadas_por uuid references public.perfiles (id) on delete set null;

update public.solicitudes_credito
   set porcentaje_credito = porcentaje_devolucion::text::smallint
 where porcentaje_credito is null;

alter table public.solicitudes_credito alter column porcentaje_credito set not null;

comment on column public.solicitudes_credito.porcentaje_credito is
  'Porcentaje vigente del crédito (entero, 50 a 100). Al crear, el que eligió el asociado; después solo lo cambia admin_editar_condiciones_credito.';
comment on column public.solicitudes_credito.total_a_pagar is
  'Total que devuelve el asociado (pesos). Null = sin definir. Revela la tasa: authenticated no lo lee; el admin usa admin_condiciones_solicitudes().';
comment on column public.solicitudes_credito.tipo_credito is
  'Préstamo de la cooperativa o crédito en un convenio (entonces convenio_id es obligatorio).';

create index if not exists ix_solicitudes_convenio on public.solicitudes_credito (convenio_id) where convenio_id is not null;
create index if not exists ix_solicitudes_condiciones_editadas_por
  on public.solicitudes_credito (condiciones_editadas_por) where condiciones_editadas_por is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_porcentaje_credito_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_porcentaje_credito_chk check (porcentaje_credito between 50 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_total_a_pagar_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_total_a_pagar_chk
      check (total_a_pagar is null or (total_a_pagar >= monto_solicitado and total_a_pagar = trunc(total_a_pagar)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_tipo_convenio_chk') then
    alter table public.solicitudes_credito
      add constraint solicitudes_tipo_convenio_chk
      check ((tipo_credito = 'convenio'::public.tipo_credito) = (convenio_id is not null));
  end if;
end $$;

-- Sin total_a_pagar (como la tasa). Sin grant de insert/update nuevos.
grant select (porcentaje_credito, tipo_credito, convenio_id, condiciones_editadas_at)
  on public.solicitudes_credito to authenticated;

-- ------------------------------------------------------------
-- validar_monto_solicitud: las condiciones las pone el servidor al crear y,
-- en una pendiente, solo cambian por la RPC.
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
    if coalesce(current_setting('ga.editar_condiciones_credito', true), '') = 'si' then
      return new;
    end if;
    -- Pendiente: las condiciones solo cambian con «Editar condiciones».
    if (new.monto_solicitado, new.porcentaje_devolucion, new.grado, new.grado_asociado,
        new.tasa_interes_mensual, new.plazo_meses, new.cuota_mensual,
        new.porcentaje_credito, new.total_a_pagar, new.tipo_credito, new.convenio_id,
        new.condiciones_editadas_at, new.condiciones_editadas_por)
       is distinct from
       (old.monto_solicitado, old.porcentaje_devolucion, old.grado, old.grado_asociado,
        old.tasa_interes_mensual, old.plazo_meses, old.cuota_mensual,
        old.porcentaje_credito, old.total_a_pagar, old.tipo_credito, old.convenio_id,
        old.condiciones_editadas_at, old.condiciones_editadas_por) then
      raise exception 'Las condiciones de una solicitud solo se cambian con «Editar condiciones»';
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
  new.grado                    := v_grupo;
  new.grado_asociado           := v_codigo;
  new.tasa_interes_mensual     := v_tope.tasa_interes_mensual;
  new.plazo_meses              := v_tope.plazo_meses;
  new.cuota_mensual            := null;
  new.porcentaje_credito       := new.porcentaje_devolucion::text::smallint;
  new.total_a_pagar            := null;
  new.tipo_credito             := 'cooperativa'::public.tipo_credito;
  new.convenio_id              := null;
  new.condiciones_editadas_at  := null;
  new.condiciones_editadas_por := null;
  return new;
end;
$$;
revoke all on function public.validar_monto_solicitud() from public, anon, authenticated;

-- ------------------------------------------------------------
-- sellar_revision_solicitud: una aprobada sin desembolsar admite la RPC.
-- ------------------------------------------------------------
create or replace function public.sellar_revision_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if new.asociado_id is distinct from old.asociado_id then
    raise exception 'Una solicitud no puede cambiar de asociado';
  end if;

  if old.estado <> 'pendiente'::public.estado_solicitud then
    if new.estado is distinct from old.estado then
      raise exception 'Una solicitud ya resuelta no puede cambiar de estado';
    end if;
    if (new.porcentaje_devolucion, new.grado, new.grado_asociado, new.cuota_mensual,
        new.motivo_rechazo, new.revisado_por, new.fecha_respuesta, new.fecha_solicitud)
       is distinct from
       (old.porcentaje_devolucion, old.grado, old.grado_asociado, old.cuota_mensual,
        old.motivo_rechazo, old.revisado_por, old.fecha_respuesta, old.fecha_solicitud) then
      raise exception 'Una solicitud ya resuelta no se puede modificar';
    end if;
    -- Condiciones editables: solo por la RPC, en una aprobada sin desembolsar.
    if (new.monto_solicitado, new.tasa_interes_mensual, new.plazo_meses,
        new.porcentaje_credito, new.total_a_pagar, new.tipo_credito, new.convenio_id,
        new.condiciones_editadas_at, new.condiciones_editadas_por)
       is distinct from
       (old.monto_solicitado, old.tasa_interes_mensual, old.plazo_meses,
        old.porcentaje_credito, old.total_a_pagar, old.tipo_credito, old.convenio_id,
        old.condiciones_editadas_at, old.condiciones_editadas_por)
       and not (coalesce(current_setting('ga.editar_condiciones_credito', true), '') = 'si'
                and old.estado = 'aprobado'::public.estado_solicitud
                and old.fecha_desembolso is null) then
      raise exception 'Una solicitud ya resuelta no se puede modificar';
    end if;

    -- §12.2: desembolso, una sola vez y solo en aprobadas.
    if (new.fecha_desembolso, new.desembolsado_por)
       is distinct from (old.fecha_desembolso, old.desembolsado_por) then
      if old.fecha_desembolso is not null then
        raise exception 'Este crédito ya fue marcado como desembolsado';
      end if;
      if old.estado <> 'aprobado'::public.estado_solicitud then
        raise exception 'Solo un crédito aprobado se puede marcar como desembolsado';
      end if;
      if new.fecha_desembolso is null then
        raise exception 'Falta la fecha de desembolso';
      end if;
      if new.fecha_desembolso > v_hoy then
        raise exception 'La fecha de desembolso no puede ser futura';
      end if;
      if new.fecha_desembolso < (old.fecha_respuesta at time zone 'America/Bogota')::date then
        raise exception 'La fecha de desembolso no puede ser anterior a la aprobación';
      end if;
      if auth.uid() is not null and old.asociado_id = auth.uid() then
        raise exception 'No puede marcar el desembolso de su propio crédito; debe hacerlo otro administrador';
      end if;
      new.desembolsado_por := auth.uid();
    end if;
  else
    -- Pendiente: no se desembolsa (primero se aprueba, en otra operación).
    if new.fecha_desembolso is not null or new.desembolsado_por is not null then
      raise exception 'Solo un crédito aprobado se puede marcar como desembolsado';
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
-- RPC de «Editar condiciones»
-- ------------------------------------------------------------
create or replace function public.admin_editar_condiciones_credito(
  p_solicitud_id  uuid,
  p_monto         numeric,
  p_total_a_pagar numeric,
  p_plazo_meses   integer,
  p_porcentaje    integer,
  p_tipo          public.tipo_credito,
  p_convenio_id   uuid,
  p_motivo        text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_sol      public.solicitudes_credito%rowtype;
  v_motivo   text := btrim(coalesce(p_motivo, ''));
  v_convenio uuid := case when p_tipo = 'convenio'::public.tipo_credito then p_convenio_id end;
  v_tasa     numeric;
  v_tasa_50  numeric;
  v_tasa_100 numeric;
  v_campos   text[] := '{}';
  v_detalle  text := '';
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede editar las condiciones de un crédito';
  end if;
  if char_length(v_motivo) not between 5 and 300 then
    raise exception 'El motivo debe tener entre 5 y 300 caracteres';
  end if;

  select * into v_sol from public.solicitudes_credito s where s.id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe';
  end if;
  if v_sol.asociado_id = v_uid then
    raise exception 'No puedes editar tu propio crédito; debe hacerlo otro administrador';
  end if;
  if v_sol.estado = 'rechazado'::public.estado_solicitud then
    raise exception 'Un crédito rechazado no se puede editar';
  end if;
  if v_sol.fecha_desembolso is not null then
    raise exception 'Un crédito desembolsado no se puede editar';
  end if;

  if p_monto is null or p_monto = 'Infinity'::numeric or p_monto <> trunc(p_monto) or p_monto < 100000 or p_monto > 1000000000 then
    raise exception 'El monto a recibir debe ser en pesos, sin decimales, entre 100000 y 1000000000';
  end if;
  if p_total_a_pagar is null or p_total_a_pagar = 'Infinity'::numeric or p_total_a_pagar <> trunc(p_total_a_pagar) or p_total_a_pagar > 2000000000 then
    raise exception 'El total a pagar debe ser en pesos, sin decimales';
  end if;
  if p_total_a_pagar < p_monto then
    raise exception 'El total a pagar no puede ser menor que el monto a recibir';
  end if;
  if p_plazo_meses is null or p_plazo_meses not between 1 and 60 then
    raise exception 'El plazo debe estar entre 1 y 60 meses';
  end if;
  if p_porcentaje is null or p_porcentaje not between 50 and 100 then
    raise exception 'El porcentaje debe ser un número entero entre 50 y 100';
  end if;
  if p_tipo is null then
    raise exception 'Elige el tipo de crédito';
  end if;
  if p_tipo = 'convenio'::public.tipo_credito then
    if v_convenio is null then
      raise exception 'Elige el convenio';
    end if;
    -- Uno oculto solo se conserva si ya era el de este crédito.
    if not exists (select 1 from public.convenios c
                   where c.id = v_convenio and (c.visible or c.id = v_sol.convenio_id)) then
      raise exception 'Ese convenio no está disponible';
    end if;
  end if;

  v_tasa := v_sol.tasa_interes_mensual;
  if p_porcentaje is distinct from v_sol.porcentaje_credito::integer then
    select gc.tasa_interes_mensual into v_tasa_50 from public.grados_credito gc
     where gc.grado = v_sol.grado and gc.porcentaje = '50'::public.porcentaje_devolucion;
    select gc.tasa_interes_mensual into v_tasa_100 from public.grados_credito gc
     where gc.grado = v_sol.grado and gc.porcentaje = '100'::public.porcentaje_devolucion;
    if v_tasa_50 is null or v_tasa_100 is null then
      raise exception 'No hay tasas configuradas para este grado';
    end if;
    v_tasa := round(v_tasa_50 + (v_tasa_100 - v_tasa_50) * (p_porcentaje - 50) / 50.0, 8);
    v_campos := array_append(v_campos, 'porcentaje');
    v_detalle := v_detalle || format('Porcentaje: %s → %s. ', v_sol.porcentaje_credito, p_porcentaje);
  end if;
  if p_monto is distinct from v_sol.monto_solicitado then
    v_campos := array_append(v_campos, 'monto');
    v_detalle := v_detalle || format('Recibe: %s → %s. ', v_sol.monto_solicitado, p_monto);
  end if;
  if p_total_a_pagar is distinct from v_sol.total_a_pagar then
    v_campos := array_append(v_campos, 'total');
    v_detalle := v_detalle || format('Devuelve: %s → %s. ', coalesce(v_sol.total_a_pagar::text, 'sin definir'), p_total_a_pagar);
  end if;
  if p_plazo_meses is distinct from v_sol.plazo_meses then
    v_campos := array_append(v_campos, 'plazo');
    v_detalle := v_detalle || format('Plazo: %s → %s meses. ', v_sol.plazo_meses, p_plazo_meses);
  end if;
  if (p_tipo, v_convenio) is distinct from (v_sol.tipo_credito, v_sol.convenio_id) then
    v_campos := array_append(v_campos, 'tipo');
    v_detalle := v_detalle || format('Tipo: %s → %s. ', v_sol.tipo_credito, p_tipo);
  end if;
  if cardinality(v_campos) = 0 then
    raise exception 'No hay cambios para guardar';
  end if;

  perform set_config('ga.editar_condiciones_credito', 'si', true);
  update public.solicitudes_credito s
     set monto_solicitado = p_monto,
         total_a_pagar = p_total_a_pagar,
         plazo_meses = p_plazo_meses,
         porcentaje_credito = p_porcentaje,
         tasa_interes_mensual = v_tasa,
         tipo_credito = p_tipo,
         convenio_id = v_convenio,
         condiciones_editadas_at = now(),
         condiciones_editadas_por = v_uid
   where s.id = p_solicitud_id;
  perform set_config('ga.editar_condiciones_credito', '', true);

  insert into public.historial_solicitudes (entidad, entidad_id, actor_id, accion, detalle)
  values ('solicitud_credito'::public.historial_entidad, p_solicitud_id, v_uid, 'condiciones_editadas',
          v_detalle || 'Motivo: ' || v_motivo);

  return v_campos;
end;
$$;
revoke all on function public.admin_editar_condiciones_credito(uuid, numeric, numeric, integer, integer, public.tipo_credito, uuid, text) from public, anon;
grant execute on function public.admin_editar_condiciones_credito(uuid, numeric, numeric, integer, integer, public.tipo_credito, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Lectura del total a pagar (solo admin)
-- ------------------------------------------------------------
create or replace function public.admin_condiciones_solicitudes(p_ids uuid[])
returns table (id uuid, total_a_pagar numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.total_a_pagar
  from public.solicitudes_credito s
  where (select public.es_admin())
    and s.id = any (p_ids);
$$;
revoke all on function public.admin_condiciones_solicitudes(uuid[]) from public, anon;
grant execute on function public.admin_condiciones_solicitudes(uuid[]) to authenticated;
