-- ============================================================
-- 2026-10-14 — Afiliación sin repetidos (pedido de Sebas).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
-- Todas las migraciones hasta 20261009000000 ya están aplicadas: esta es nueva.
--
-- Hasta ahora solo se impedía una segunda solicitud PENDIENTE con la misma
-- cédula (ux_afiliacion_pendiente_por_cedula). Se colaban:
--   · un asociado (o asesor/admin) ya registrado que vuelve a llenar el formulario;
--   · una cédula cuya solicitud ya está en «contactado»;
--   · el mismo correo personal con otra cédula (al aprobar, Auth no deja crear
--     la cuenta porque el correo ya existe);
--   · el mismo correo institucional de otra persona.
--
-- Regla: una solicitud NUEVA (estado «pendiente») se rechaza si su cédula,
-- su correo personal o su correo institucional ya pertenecen a una cuenta o
-- a otra solicitud abierta (pendiente o contactado). Las rechazadas no cuentan
-- (la persona puede volver a intentarlo) y los eliminados tampoco (su cédula y
-- su correo se anonimizaron).
--
-- S-06: el error usa el MISMO código que el índice único (23505) y un mensaje
-- genérico; la app ya responde a ese código exactamente igual que a un envío
-- exitoso, así que el formulario no revela si alguien está registrado.
-- Idempotente.
-- ============================================================

create or replace function public.rechazar_afiliacion_repetida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo las solicitudes nuevas del formulario (las pruebas y cargas manuales
  -- con otro estado no pasan por aquí).
  if new.estado is distinct from 'pendiente'::public.estado_afiliacion then
    return new;
  end if;

  -- Dos envíos simultáneos con el mismo correo no deben pasar los dos
  -- (la cédula ya la serializa el índice único parcial).
  perform pg_advisory_xact_lock(hashtextextended('afiliacion:' || new.email, 0));

  if exists (select 1 from public.perfiles p where p.cedula = new.cedula)
     or exists (
       select 1 from public.solicitudes_afiliacion s
       where s.cedula = new.cedula
         and s.estado in ('pendiente', 'contactado')
         and s.id <> new.id
     )
     or exists (select 1 from auth.users u where u.email = new.email)
     or exists (
       select 1 from public.solicitudes_afiliacion s
       where s.email = new.email
         and s.estado in ('pendiente', 'contactado')
         and s.id <> new.id
     )
     or (
       new.correo_institucional is not null
       and (
         exists (select 1 from public.perfiles p where p.correo_institucional = new.correo_institucional)
         or exists (
           select 1 from public.solicitudes_afiliacion s
           where s.correo_institucional = new.correo_institucional
             and s.estado in ('pendiente', 'contactado')
             and s.id <> new.id
         )
       )
     )
  then
    raise exception 'Solicitud de afiliación repetida' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;
revoke all on function public.rechazar_afiliacion_repetida() from public, anon, authenticated;

comment on function public.rechazar_afiliacion_repetida() is
  'Rechaza (23505) una afiliación nueva cuya cédula, correo personal o institucional ya tiene cuenta o solicitud abierta. Mensaje genérico (S-06).';

drop trigger if exists tr_rechazar_afiliacion_repetida on public.solicitudes_afiliacion;
create trigger tr_rechazar_afiliacion_repetida
  before insert on public.solicitudes_afiliacion
  for each row execute function public.rechazar_afiliacion_repetida();

-- Búsquedas del trigger: solo solicitudes abiertas (pocas filas) y correos de perfiles.
create index if not exists ix_afiliacion_abierta_email
  on public.solicitudes_afiliacion (email)
  where estado in ('pendiente', 'contactado');
create index if not exists ix_afiliacion_abierta_cedula
  on public.solicitudes_afiliacion (cedula)
  where estado in ('pendiente', 'contactado');
create index if not exists ix_afiliacion_abierta_correo_institucional
  on public.solicitudes_afiliacion (correo_institucional)
  where estado in ('pendiente', 'contactado') and correo_institucional is not null;
create index if not exists ix_perfiles_correo_institucional
  on public.perfiles (correo_institucional)
  where correo_institucional is not null;
