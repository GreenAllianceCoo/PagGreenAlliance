-- ============================================================
-- Green Alliance — esquema inicial (línea base)
-- ------------------------------------------------------------
-- Reconstruido por ga-auditor-supabase el 2026-09-23 a partir de
-- supabase_schema.sql y verificado contra el catálogo de producción
-- (proyecto sqpmxizxkqorccpvjwoz): tablas, enums, llaves foráneas y
-- datos de grados_credito coinciden.
--
-- En producción este esquema se ejecutó a mano en el SQL Editor, por eso
-- NO aparece en supabase_migrations.schema_migrations.
--
-- IMPORTANTE (antes de cualquier `supabase db push`):
--   supabase migration repair --status applied 20260922000000 --linked
-- Así la CLI lo marca como aplicado y no intenta ejecutarlo en producción.
-- En un entorno nuevo (local o rama) se aplica normal, antes de
-- 20260922210921_fix_rls_y_reglas_negocio.sql, que reemplaza las
-- políticas y la función de validación que se crean aquí.
-- ============================================================

-- Tipos enumerados
create type public.rol_usuario as enum ('asociado', 'admin');
create type public.grado_policial as enum ('PP', 'PT', 'SI', 'IT', 'OF');
create type public.porcentaje_devolucion as enum ('50', '100');
create type public.estado_solicitud as enum ('pendiente', 'aprobado', 'rechazado');

-- ============================================================
-- Tabla: perfiles (extiende auth.users)
-- ============================================================
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol public.rol_usuario not null default 'asociado',
  cedula text unique not null,
  nombre_completo text not null,
  grado public.grado_policial,
  telefono text,
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Políticas originales (se reemplazan en 20260922210921)
create policy "Un usuario ve y edita su propio perfil"
  on public.perfiles for select using (auth.uid() = id);

create policy "Un usuario actualiza su propio perfil"
  on public.perfiles for update using (auth.uid() = id);

create policy "Admin ve todos los perfiles"
  on public.perfiles for select using (
    exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- ============================================================
-- Tabla: grados_credito (referencia, editable por admin)
-- ============================================================
create table public.grados_credito (
  grado public.grado_policial not null,
  porcentaje public.porcentaje_devolucion not null,
  capacidad_maxima numeric not null,
  cuota_mensual numeric not null,
  total_credito numeric not null,
  plazo_meses int not null default 3,
  primary key (grado, porcentaje)
);

alter table public.grados_credito enable row level security;

create policy "Cualquier usuario autenticado puede leer los topes"
  on public.grados_credito for select using (auth.role() = 'authenticated');

create policy "Solo admin edita los topes"
  on public.grados_credito for all using (
    exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- Datos iniciales, tomados de la presentación del negocio
insert into public.grados_credito (grado, porcentaje, capacidad_maxima, cuota_mensual, total_credito, plazo_meses) values
  ('PP', '50',  1000000, 79000,  1239000, 3),
  ('PP', '100', 2100000, 126000, 2478000, 3),
  ('PT', '50',  1300000, 66000,  1500000, 3),
  ('PT', '100', 2700000, 101000, 3003000, 3),
  ('SI', '50',  1500000, 123000, 1869000, 3),
  ('SI', '100', 3000000, 246000, 3738000, 3),
  ('IT', '50',  2000000, 101000, 2304000, 3),
  ('IT', '100', 4000000, 202000, 4608000, 3),
  ('OF', '50',  2150000, 116000, 2499000, 3),
  ('OF', '100', 4200000, 266000, 4998000, 3)
on conflict (grado, porcentaje) do nothing;

-- ============================================================
-- Tabla: solicitudes_credito
-- ============================================================
create table public.solicitudes_credito (
  id uuid primary key default gen_random_uuid(),
  asociado_id uuid not null references public.perfiles(id),
  porcentaje_devolucion public.porcentaje_devolucion not null,
  monto_solicitado numeric not null,
  cuota_mensual numeric not null,
  plazo_meses int not null default 3,
  estado public.estado_solicitud not null default 'pendiente',
  motivo_rechazo text,
  revisado_por uuid references public.perfiles(id),
  fecha_solicitud timestamptz not null default now(),
  fecha_respuesta timestamptz
);

alter table public.solicitudes_credito enable row level security;

create policy "Un asociado ve sus propias solicitudes"
  on public.solicitudes_credito for select using (auth.uid() = asociado_id);

create policy "Un asociado crea sus propias solicitudes"
  on public.solicitudes_credito for insert with check (auth.uid() = asociado_id);

create policy "Admin ve y actualiza todas las solicitudes"
  on public.solicitudes_credito for all using (
    exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- Versión original del trigger de tope (se reemplaza en 20260922210921)
create or replace function public.validar_monto_solicitud()
returns trigger as $$
declare
  tope numeric;
begin
  select capacidad_maxima into tope
  from public.grados_credito gc
  join public.perfiles p on p.grado = gc.grado
  where p.id = new.asociado_id and gc.porcentaje = new.porcentaje_devolucion;

  if new.monto_solicitado > tope then
    raise exception 'El monto solicitado supera el tope permitido para este grado y porcentaje';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger chk_monto_solicitud
  before insert on public.solicitudes_credito
  for each row execute function public.validar_monto_solicitud();

-- ============================================================
-- Tabla: convenios
-- ============================================================
create table public.convenios (
  id uuid primary key default gen_random_uuid(),
  nombre_empresa text not null,
  nit text,
  sector text,
  telefono_contacto text,
  descripcion text,
  activo boolean not null default true
);

alter table public.convenios enable row level security;

create policy "Cualquier usuario autenticado lee convenios activos"
  on public.convenios for select using (auth.role() = 'authenticated');

create policy "Solo admin edita convenios"
  on public.convenios for all using (
    exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );
