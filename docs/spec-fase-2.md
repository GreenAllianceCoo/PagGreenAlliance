# Especificación Fase 2 · Green Alliance

Hecho por `ga-auditor-supabase` (PARTE 1: solo base de datos). Guía para los agentes de
la siguiente tanda: formulario de afiliación (`/afiliacion`), panel `/admin`, pantalla
del asesor y sorteo mensual. **Las migraciones de esta fase están en el repo pero NO se
han aplicado a producción** (proyecto `sqpmxizxkqorccpvjwoz` / PagGreenAlliance):
las aplica Sebas después de la auditoría de seguridad.

Migraciones de esta fase (en orden, todas en `supabase/migrations/`):

1. `20260924000000_rol_asesor_enum.sql` — agrega `'asesor'` al enum `rol_usuario`.
2. `20260924000100_perfiles_asesor_id.sql` — `perfiles.asesor_id`, validaciones.
3. `20260924000200_solicitudes_afiliacion_v2.sql` — nombres/apellidos, institución,
   Nequi, asesor_id, fotos.
4. `20260924000300_funciones_asesor.sql` — `obtener_asesores_publico()` y
   `resumen_clientes_asesor()`.
5. `20260924000400_storage_afiliacion_documentos.sql` — bucket privado de fotos.
6. `20260924000500_sorteo_mensual.sql` — `boletas_sorteo` y sus funciones.

Importante para quien escriba migraciones nuevas sobre este trabajo: **`alter type ...
add value` necesita su propia transacción** (no se puede usar el valor nuevo del enum
en el mismo archivo/transacción en que se agrega). Por eso el valor `'asesor'` está en
su propio archivo (1), separado de todo lo que lo usa (2 a 6).

---

## 1. Rol asesor

`perfiles.rol` ahora acepta `'asociado' | 'admin' | 'asesor'`. Un asesor **ingresa
igual que un asociado**: cédula en `/ingresar` → código de 6 dígitos al correo. No hay
pantalla ni flujo de ingreso distinto que programar; sí hace falta una pantalla propia
(otro agente) que, en vez de mostrar "tu solicitud de crédito", muestre el resumen de
sus clientes.

**Quién crea un asesor:** el admin, desde el panel `/admin` (pendiente de construir).
Es exactamente el mismo mecanismo que ya existe para asociados: `auth.admin.createUser`
con `app_metadata: { cedula, grado }` (grado normalmente null para un asesor) desde el
servidor con `SUPABASE_SERVICE_ROLE_KEY`, y luego un `update` a `perfiles.rol = 'asesor'`
(el `handle_new_user` siempre crea el perfil con rol `asociado`; el cambio de rol lo
hace el admin autenticado, que sí puede tocar esa columna por RLS).

### `perfiles.asesor_id`

- `uuid null references perfiles(id)`.
- Solo el admin lo asigna o lo cambia (`proteger_campos_perfil` bloquea que un usuario
  toque su propio `asesor_id`; RLS de update ya exige `es_admin()` para tocar filas
  ajenas).
- Un trigger (`validar_perfil_asesor_id`) obliga a que, si no es null, apunte a un
  perfil con `rol = 'asesor'`, y que no sea el mismo perfil.
- Server Action sugerida para el panel admin: `UPDATE perfiles SET asesor_id = $1
  WHERE id = $2` con el cliente autenticado del admin (RLS + trigger validan el resto).

### `public.obtener_asesores_publico()`

```sql
select id, nombre from public.obtener_asesores_publico();
-- id uuid, nombre text
```

- **Solo `service_role`.** Se usa desde el servidor para armar el `<select>` de
  "¿Quién te refirió?" del formulario público `/afiliacion` (que no tiene sesión, así
  que no puede ir por RLS normal). No se expone por RPC a `anon`/`authenticated`.
- Ejemplo de uso en una Route Handler / Server Action:
  ```ts
  const supabaseAdmin = crearClienteServiceRole(); // import 'server-only'
  const { data } = await supabaseAdmin.rpc('obtener_asesores_publico');
  ```

### `public.resumen_clientes_asesor()`

```sql
select * from public.resumen_clientes_asesor();
-- origen text ('asociado' | 'solicitud_afiliacion')
-- perfil_id uuid          (solo si origen = 'asociado')
-- solicitud_id uuid       (solo si origen = 'solicitud_afiliacion')
-- nombre text
-- cedula text
-- grado grado_policial
-- estado_afiliacion estado_afiliacion   (null si origen = 'asociado')
-- estado_credito estado_solicitud       (null si no ha pedido crédito / no es asociado)
```

- Se llama con el cliente normal del usuario (con su sesión, cookies), **no** con
  service role: `grant execute ... to authenticated`. Se autofiltra por `auth.uid()`:
  un asesor solo ve las filas donde `asesor_id` sea su propio id; cualquier otro rol
  que la llame recibe 0 filas (no hace falta comprobar el rol antes de llamarla, pero
  sí conviene ocultar la pantalla del asesor a quien no tenga `rol = 'asesor'`, igual
  que ya se hace con `/cuenta` y la sesión).
- **Nunca** devuelve `celular`, `email`, `nequi` ni las rutas de las fotos. Es
  `SECURITY DEFINER` porque Postgres no tiene RLS por columna: la única forma de
  esconder columnas es que la función no las seleccione. Si en el futuro se necesita
  más información del cliente, hay que decidir explícitamente si se agrega a esta
  función (columna por columna) — no dar acceso directo a `perfiles` ni a
  `solicitudes_afiliacion` a los asesores.
- Combina dos orígenes con `union all`: asociados ya existentes con este asesor
  (`perfiles.asesor_id`) y solicitudes de afiliación que este asesor refirió
  (`solicitudes_afiliacion.asesor_id`), con la última solicitud de crédito de cada
  asociado (si tiene).

### Reglas de "nadie se autoasigna"

- `proteger_campos_perfil()` (trigger de `perfiles`) sigue bloqueando que alguien
  cambie su propio `rol`, y ahora también su propio `asesor_id`. Solo pasa si
  `es_admin()` (o si es `service_role`, que no tiene `auth.uid()`).
- Esto también evita que un asesor se "recomiende" a sí mismo como asesor de otro
  perfil sin pasar por el admin: solo el admin autenticado puede escribir
  `asesor_id` en la fila de otro usuario (RLS `perfiles_update` ya exige
  `es_admin()` para filas ajenas).

---

## 2. Afiliación nueva (`solicitudes_afiliacion`)

Columnas nuevas (las columnas de la tabla original de
`docs/spec-afiliacion-y-login.md` §2 se conservan; ver más abajo qué cambió):

| Columna | Regla |
|---|---|
| `nombres` | Obligatorio. Solo letras (con tildes y ñ) y espacios, 2 a 60 caracteres. |
| `apellidos` | Igual regla que `nombres`. |
| `nombre` | **Ya no se llena a mano.** Se calcula sola (`nombres \|\| ' ' \|\| apellidos`) con un trigger. Se conserva por compatibilidad; no la escriban desde la app. |
| `cedula` | Igual que antes: solo dígitos, 6 a 10. |
| `grado` | Igual que antes: enum `grado_policial`, lista de `grados_credito`. |
| `institucion` | Obligatorio. Enum `institucion_afiliacion`: `'policia' \| 'ejercito'`. |
| `unidad` | **En desuso.** Sigue existiendo (nullable), no se pide en el formulario nuevo. No la borren de la base; simplemente no la manden. |
| `celular` | Igual que antes: 10 dígitos, empieza por 3. |
| `nequi` | Obligatorio. 10 dígitos, empieza por 3 (mismo formato que celular; puede ser el mismo número o distinto, la app no debe asumir que son iguales). |
| `email` | Obligatorio, minúsculas, **y además** tiene que ser del dominio de la institución elegida (ver abajo). |
| `asesor_id` | Opcional. `uuid` → `perfiles(id)` con `rol = 'asesor'`. Viene del desplegable que arma `obtener_asesores_publico()`. |
| `foto_cedula_frente`, `foto_cedula_reverso`, `foto_selfie` | Obligatorias. **Rutas** dentro del bucket `afiliacion-documentos` (ver §3), no URLs. Máx. 300 caracteres. |
| `mensaje` | Igual que antes: opcional, hasta 500. |
| `acepto_datos_at` | Igual que antes: obligatorio, se guarda `now()`. |
| `estado` | Igual que antes: `pendiente \| contactado \| aprobada \| rechazada`. |

### Correo institucional según la institución

```sql
check (
  (institucion = 'policia'  and email ~ '@policia\.gov\.co$')
  or
  (institucion = 'ejercito' and email ~ '@(buzonejercito\.mil\.co|ejercito\.mil\.co)$')
)
```

Si el formulario permite elegir la institución y escribir el correo libremente, hay
que validar esto también en el cliente (zod) para no hacer esperar al servidor: mismo
patrón que ya usa el proyecto (un solo esquema zod en `lib/validaciones/`, usado en
cliente y servidor).

### Quién puede insertar y qué pasa después

Sin cambios respecto a la spec original: **insert solo desde el servidor con
`service_role`**; no hay política de insert para `anon` ni `authenticated`. El admin
lee y solo puede cambiar `estado` (`proteger_solicitud_afiliacion` bloquea cualquier
otro cambio, columnas nuevas incluidas). Sigue existiendo el índice único parcial que
impide dos solicitudes `pendiente` con la misma cédula.

### Honeypot y límite por IP/cédula

Sin cambios: siguen siendo responsabilidad de la Server Action (honeypot) y de
`public.registrar_intento(clave, maximo, ventana_segundos)` (límite; ver
`20260923210000_limite_de_intentos.sql`, documentado en esa misma migración). Nada
nuevo que hacer en la base para esto.

---

## 3. Fotos: bucket privado `afiliacion-documentos`

- **Privado** (`public = false`), límite **5 MB**, solo `image/jpeg`, `image/png`,
  `image/webp` (los tres controlados por el propio bucket de Storage, no hace falta
  revalidarlo en SQL).
- **RLS de `storage.objects` sin ninguna política** para `anon` ni `authenticated`:
  sin política, Postgres niega todo. Ni siquiera el admin autenticado puede leer,
  listar o subir directo por la API de Storage.
- **Subida:** solo desde el servidor, con el cliente de `service_role`
  (`import 'server-only'`). Sugerencia de ruta: `afiliacion-documentos/<cedula>/<uuid>-frente.jpg`
  (evitar rutas predecibles tipo `1234567890/frente.jpg` sin el `uuid`, por si algún
  día se relaja una política; hoy no hace falta porque no hay ninguna política, pero
  es una buena costumbre).
- **Lectura (panel admin):** el patrón de este proyecto para todo lo sensible es
  "el servidor decide, no RLS": en la Route Handler / Server Action que sirve la URL
  firmada,
  1. Se usa el cliente **normal** (con la sesión del admin, vía cookies) para
     confirmar `select public.es_admin()` (o simplemente reusar el patrón ya
     existente: leer `perfiles.rol` del usuario de la sesión).
  2. Solo si es admin, se usa el cliente de **`service_role`** para llamar
     `createSignedUrl('afiliacion-documentos/<ruta>', <segundos>)`.
  3. La URL firmada (con expiración corta, p. ej. 60–300 s) es lo único que llega al
     navegador del admin.
- No hay forma de "confiar en RLS" aquí porque las políticas de Storage son por fila
  de `storage.objects`, no distinguen "solo el admin lee esta fila" de forma simple
  sin exponer también una vía para `authenticated` en general; por eso se optó por
  cero políticas + control 100% en el servidor, igual que `correo_por_cedula()` y
  `registrar_intento()`.

---

## 4. Sorteo mensual

Una sola tabla, `public.boletas_sorteo`: cada fila ya identifica "el sorteo" al que
pertenece con `anio` + `mes` (no hay una tabla aparte de "sorteos", porque el sorteo
del mes no tiene ningún dato propio que no viva ya en sus boletas — el ganador **no
se elige en la app**).

```
boletas_sorteo
  id                 uuid pk
  asociado_id        uuid → perfiles(id)
  anio               smallint
  mes                smallint (1–12)
  numero             text (6 dígitos, '^[0-9]{6}$')
  estado             estado_boleta_sorteo ('enviada' | 'confirmada')
  fecha_envio        timestamptz (default now())
  fecha_confirmacion timestamptz (null hasta que se confirma)
  intentos           int (default 0; tope de 5, ver confirmar_boleta_sorteo)
  created_at         timestamptz

  unique (asociado_id, anio, mes)   -- una sola boleta por asociado y mes
  unique (anio, mes, numero)        -- un número no se repite en el mismo mes
```

### Ventana de inscripción/confirmación: 1 al 5, hora de Colombia

Ambas operaciones (`participar_sorteo` y `confirmar_boleta_sorteo`) revisan
`extract(day from (now() at time zone 'America/Bogota'))` y fallan fuera del rango
1–5. También hay una función de solo lectura para que la pantalla decida si mostrar
el botón "Participar" sin adivinar la fecha en el cliente:

```sql
select public.sorteo_ventana_abierta(); -- boolean, granted a authenticated y service_role
```

### Flujo (ambas funciones son `SECURITY DEFINER`, solo `service_role`)

1. **Participar:** el asociado pulsa "Participar" en su pantalla → la Server Action
   llama, con el cliente de `service_role`:
   ```sql
   select * from public.participar_sorteo('<uuid del asociado, de la sesión>');
   -- devuelve: id uuid, numero text, anio smallint, mes smallint, fecha_envio timestamptz
   ```
   La función ya valida la ventana, que no exista otra boleta ese mes, y genera un
   número de 6 dígitos único para ese mes. **El número que devuelve la función solo lo
   ve el servidor**: el siguiente paso de la Server Action es mandarlo por correo
   (Resend) y responder al navegador solo "se envió un código a tu correo", sin
   incluir el número en la respuesta HTTP.
   - ⚠️ **Pendiente de definir con la cooperativa / `ga-funcionalidad-botones`:**
     este correo ("tu número de boleta es XXXXXX") no está en la lista de los 3
     correos de `docs/resend-plantillas.md`. Hay que sumarlo ahí (nombre de
     plantilla, variable de entorno, asunto, variables) antes de implementarlo.
2. **Confirmar:** el asociado escribe el número en la pantalla → la Server Action
   llama, también con `service_role`:
   ```sql
   select public.confirmar_boleta_sorteo('<uuid del asociado>', '<número escrito>');
   -- boolean: true si coincidió (o ya estaba confirmada), false si no coincidió
   ```
   Si devuelve `false`, mostrar el error y dejar reintentar (hasta 5 intentos fallidos
   por boleta; al sexto, la función lanza una excepción y hay que tratarla como error
   genérico, sin decir "intentos agotados" de forma que invite a fuerza bruta — aunque
   con 6 dígitos y 5 intentos el margen ya es mínimo).

### Lectura

- El asociado ve su propia boleta con una consulta normal (RLS: `asociado_id =
  auth.uid() or es_admin()`), por ejemplo:
  ```sql
  select numero, estado, fecha_envio, fecha_confirmacion
  from boletas_sorteo
  where anio = $1 and mes = $2;
  -- RLS ya limita a "la mía"; no hace falta filtrar por asociado_id en el WHERE
  ```
- El admin lista las confirmadas de un mes:
  ```sql
  select b.*, p.nombre_completo, p.cedula
  from boletas_sorteo b join perfiles p on p.id = b.asociado_id
  where b.anio = $1 and b.mes = $2 and b.estado = 'confirmada'
  order by b.fecha_confirmacion;
  ```
  (con el cliente normal del admin; RLS ya permite `es_admin()` ver todas las filas).

---

## 5. Cuenta de demostración del asesor

Decisión de la cooperativa: la cuenta de demostración que use el equipo comercial
para mostrar la pantalla del asesor **es solo de la aplicación** (credenciales fijas
o un modo "demo" en el front, por decidir con `ga-funcionalidad-botones`), **no
guarda nada en la base**. No hace falta ninguna tabla, fila ni usuario real de Auth
para esto: si se implementa, que sea con datos de ejemplo (`mock.ts` o similar) y
nunca contra `resumen_clientes_asesor()` con un usuario real.

---

## Datos de prueba (`supabase/seed.sql`, SOLO Supabase local)

- **Asesor de prueba:** cédula `1234567892`, correo
  `asesor.prueba@greenalliance.test`, `rol = 'asesor'`. Asignado como asesor del
  Asociado 1 (cédula `1234567890`). Ingresa igual que un asociado (cédula + código,
  llega a Mailpit). Contraseña `Prueba123!` por si se necesita para algo con la API.
- **Solicitud de afiliación de ejemplo:** cédula `1234567899`, institución `policia`,
  Nequi y celular `3009998877`, referida por el asesor de prueba. Las tres rutas de
  foto son de ejemplo (`afiliacion-documentos/1234567899/...`); no hay archivos reales
  en el bucket local, así que no intenten abrirlas, solo sirven para probar que la
  columna guarda una ruta.

## Pruebas pgTAP nuevas (`supabase/tests/`)

| Archivo | Qué prueba |
|---|---|
| `07_asesor_rls.sql` | `asesor_id` válido/self-reference, nadie se autoasigna asesor/rol, `resumen_clientes_asesor()` ve solo lo suyo y nunca expone celular/correo/nequi/fotos, `obtener_asesores_publico()` solo `service_role`. |
| `08_afiliacion_v2.sql` | nombres/apellidos (regex y longitud), correo institucional cruzado, Nequi, fotos obligatorias, `asesor_id` debe ser un asesor real, el admin sigue sin poder tocar los datos nuevos. |
| `09_storage_afiliacion.sql` | bucket privado, 5 MB, mimetypes; ni `anon` ni `authenticated` (ni admin) leen/suben por la API; `service_role` sí. |
| `10_sorteo_mensual.sql` | fuera del 1 al 5 falla (participar y confirmar), una boleta por asociado y mes, un número por mes, RLS (cada quien ve solo la suya, admin ve todas). |

También se ajustaron `00_rls_y_privilegios.sql` (nueva excepción documentada:
`resumen_clientes_asesor` sí es ejecutable por `authenticated`, a propósito) y
`04_solicitudes_afiliacion.sql` (adaptado a las columnas nuevas obligatorias; el
detalle fino de esas columnas se probó en `08`, no se duplicó).

Correr todo: `npm run test:db` (`supabase test db`, contra Supabase local).
203/203 pruebas pasan en este momento (antes de esta fase: 143).

---

## Preguntas abiertas para la cooperativa / siguiente tanda

1. **Correo del número de boleta del sorteo:** falta sumarlo a
   `docs/resend-plantillas.md` (nombre de plantilla, variable de entorno, asunto,
   texto, variables `{{{NOMBRE}}}`, `{{{NUMERO}}}`, etc.) antes de que
   `ga-funcionalidad-botones` lo conecte.
2. **Tope de intentos del sorteo:** se fijó en 5 (constante dentro de
   `confirmar_boleta_sorteo`). Confirmar si la cooperativa quiere otro número.
3. **Cuenta de demostración del asesor:** falta decidir cómo se activa en la app
   (¿credenciales fijas? ¿un query param? ¿un botón visible solo para el equipo
   comercial?). No requiere nada en la base.
4. **Nombre del asesor en la solicitud de afiliación pública:** el desplegable
   muestra `nombre_completo` tal cual está en `perfiles`; si se quiere mostrar algo
   distinto (p. ej. "Asesor: Juan Pérez (regional Bogotá)") hay que agregar una
   columna o usar otro criterio — hoy `obtener_asesores_publico()` solo expone
   `id` y `nombre`.
5. **Import de asesores:** el admin los crea uno por uno igual que a los asociados
   (no hay Excel de asesores mencionado). Si la cooperativa quiere importarlos en
   lote, es el mismo mecanismo que la importación de asociados pendiente (P-38 /
   tarea 4.4 en `docs/avances/plan.json`).
