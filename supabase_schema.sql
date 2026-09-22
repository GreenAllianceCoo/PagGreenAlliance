-- ============================================================
-- Green Alliance — esquema inicial de base de datos
-- Pegar y ejecutar completo en Supabase: SQL Editor > New query
-- ============================================================

-- Tipos enumerados
create type rol_usuario as enum ('asociado', 'admin');
create type grado_policial as enum ('PP', 'PT', 'SI', 'IT', 'OF');
create type porcentaje_devolucion as enum ('50', '100');
create type estado_solicitud as enum ('pendiente', 'aprobado', 'rechazado');

-- ============================================================
-- Tabla: perfiles (extiende auth.users)
-- ============================================================
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol rol_usuario not null default 'asociado',
  cedula text unique not null,
  nombre_completo text not null,
  grado grado_policial,
  telefono text,
  created_at timestamptz not null default now()
);

alter table perfiles enable row level security;

create policy "Un usuario ve y edita su propio perfil"
  on perfiles for select using (auth.uid() = id);

create policy "Un usuario actualiza su propio perfil"
  on perfiles for update using (auth.uid() = id);

create policy "Admin ve todos los perfiles"
  on perfiles for select using (
    exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- ============================================================
-- Tabla: grados_credito (tabla de referencia, editable por admin)
-- ============================================================
create table grados_credito (
  grado grado_policial not null,
  porcentaje porcentaje_devolucion not null,
  capacidad_maxima numeric not null,
  cuota_mensual numeric not null,
  total_credito numeric not null,
  plazo_meses int not null default 3,
  primary key (grado, porcentaje)
);

alter table grados_credito enable row level security;

create policy "Cualquier usuario autenticado puede leer los topes"
  on grados_credito for select using (auth.role() = 'authenticated');

create policy "Solo admin edita los topes"
  on grados_credito for all using (
    exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- Datos iniciales, tomados de la presentacion del negocio
insert into grados_credito (grado, porcentaje, capacidad_maxima, cuota_mensual, total_credito, plazo_meses) values
  ('PP', '50',  1000000, 79000,  1239000, 3),
  ('PP', '100', 2100000, 126000, 2478000, 3),
  ('PT', '50',  1300000, 66000,  1500000, 3),
  ('PT', '100', 2700000, 101000, 3003000, 3),
  ('SI', '50',  1500000, 123000, 1869000, 3),
  ('SI', '100', 3000000, 246000, 3738000, 3),
  ('IT', '50',  2000000, 101000, 2304000, 3),
  ('IT', '100', 4000000, 202000, 4608000, 3),
  ('OF', '50',  2150000, 116000, 2499000, 3),
  ('OF', '100', 4200000, 266000, 4998000, 3);

-- ============================================================
-- Tabla: solicitudes_credito
-- ============================================================
create table solicitudes_credito (
  id uuid primary key default gen_random_uuid(),
  asociado_id uuid not null references perfiles(id),
  porcentaje_devolucion porcentaje_devolucion not null,
  monto_solicitado numeric not null,
  cuota_mensual numeric not null,
  plazo_meses int not null default 3,
  estado estado_solicitud not null default 'pendiente',
  motivo_rechazo text,
  revisado_por uuid references perfiles(id),
  fecha_solicitud timestamptz not null default now(),
  fecha_respuesta timestamptz
);

alter table solicitudes_credito enable row level security;

create policy "Un asociado ve sus propias solicitudes"
  on solicitudes_credito for select using (auth.uid() = asociado_id);

create policy "Un asociado crea sus propias solicitudes"
  on solicitudes_credito for insert with check (auth.uid() = asociado_id);

create policy "Admin ve y actualiza todas las solicitudes"
  on solicitudes_credito for all using (
    exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );

-- Trigger de seguridad: nadie puede pedir mas del tope de su grado,
-- incluso si alguien manipula la peticion desde el navegador.
create or replace function validar_monto_solicitud()
returns trigger as $$
declare
  tope numeric;
begin
  select capacidad_maxima into tope
  from grados_credito gc
  join perfiles p on p.grado = gc.grado
  where p.id = new.asociado_id and gc.porcentaje = new.porcentaje_devolucion;

  if new.monto_solicitado > tope then
    raise exception 'El monto solicitado supera el tope permitido para este grado y porcentaje';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger chk_monto_solicitud
  before insert on solicitudes_credito
  for each row execute function validar_monto_solicitud();

-- ============================================================
-- Tabla: convenios
-- ============================================================
create table convenios (
  id uuid primary key default gen_random_uuid(),
  nombre_empresa text not null,
  nit text,
  sector text,
  telefono_contacto text,
  descripcion text,
  activo boolean not null default true
);

alter table convenios enable row level security;

create policy "Cualquier usuario autenticado lee convenios activos"
  on convenios for select using (auth.role() = 'authenticated');

create policy "Solo admin edita convenios"
  on convenios for all using (
    exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin')
  );
