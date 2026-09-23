-- ============================================================
-- YA APLICADA EN PRODUCCIÓN (sqpmxizxkqorccpvjwoz) el 2026-09-22.
-- Copia textual de supabase_migrations.schema_migrations (versión
-- 20260922211050, nombre fix_mensaje_porcentaje_validar_monto), recuperada
-- por ga-auditor-supabase el 2026-09-23 para versionarla en el repo.
-- Corrige el formato del mensaje de error del porcentaje ('%%%' -> '%').
-- No volver a aplicar en producción. No editar.
-- ============================================================

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
    raise exception 'No hay un tope configurado para el grado % con devolución del %', v_grado, new.porcentaje_devolucion::text || '%';
  end if;
  if new.monto_solicitado is null or new.monto_solicitado <= 0 then
    raise exception 'El monto solicitado debe ser mayor que cero';
  end if;
  if new.monto_solicitado > v_tope.capacidad_maxima then
    raise exception 'El monto solicitado (%) supera el tope de % para el grado % con devolución del %',
      new.monto_solicitado, v_tope.capacidad_maxima, v_grado, new.porcentaje_devolucion::text || '%';
  end if;
  -- REGLA PROVISIONAL: cuota prorrateada sobre el tope del grado. Confirmar con la cooperativa.
  new.plazo_meses   := v_tope.plazo_meses;
  new.cuota_mensual := round(v_tope.cuota_mensual * new.monto_solicitado / v_tope.capacidad_maxima);
  return new;
end;
$$;
revoke all on function public.validar_monto_solicitud() from public, anon, authenticated;
