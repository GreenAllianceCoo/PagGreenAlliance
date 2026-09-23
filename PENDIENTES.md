# Green Alliance — pendientes

Actualizado: 23-sep-2026 (tarde)

## Dónde quedamos

La parte visual está terminada: las 6 pantallas están maquetadas, se ven bien en celular, tableta y escritorio, y compilan.

| Ruta | Pantalla | Capturas (`capturas/`) |
|---|---|---|
| `/` | Landing | `1-landing-*` |
| `/ingresar` | Ingreso con cédula | `2-ingresar-*` |
| `/ingresar/codigo` | Código de 6 dígitos | `3-ingresar-codigo-*` (*) |
| `/afiliacion` | Formulario de afiliación | `4-afiliacion-*` |
| `/afiliacion/enviada` | Solicitud enviada | `5-afiliacion-enviada-*` |
| `/cuenta` | Inicio del asociado | `6-cuenta-*` |

(*) La captura de `/ingresar/codigo` es anterior al último ajuste: todavía se ve el espacio en blanco arriba en celular, que ya se quitó.

Las pantallas todavía **no hacen nada**: los botones no envían, no hay sesión y los datos son de ejemplo (`lib/mock.ts`).

- `/login` y `/dashboard` (las rutas viejas) siguen existiendo. `/ingresar` y `/cuenta` las reemplazan; se pueden borrar cuando lo nuevo funcione.
- **Git:** la base de datos, las pruebas, los agentes y los documentos ya están en commits (`03a963f` y `9ae9607`, rama `develop`, sin subir). Las pantallas nuevas **todavía no**: `app/afiliacion`, `app/cuenta`, `app/ingresar`, `components/`, `design/`, `public/`, `lib/config.ts`, `lib/mock.ts` y los cambios de estilos.

### Base de datos y reglas del crédito (hecho el 23-sep)

- Auditoría de Supabase: sin hallazgos críticos ni altos; repo y base remota sincronizados. Informe en `docs/auditorias/2026-09-23-auditoria-supabase.md`.
- Ya hay un admin en producción y el registro de usuarios nuevos está desactivado.
- Migración `supabase/migrations/20260923173355_blindar_solicitudes_y_revisiones.sql`, con las respuestas de la cooperativa:
  - Cada grado y porcentaje (50/100) tiene su **tasa de interés mensual** (`grados_credito.tasa_interes_mensual`). Se muestra en un cuadro aparte al pedir el crédito y en el dashboard. **No se calcula la cuota.**
  - Monto mínimo de un crédito: **100.000**.
  - Primero en llegar, primero en salir: la solicitud guarda el grado y la tasa con que se pidió. No se puede bajar ni borrar un tope con solicitudes pendientes.
  - Las solicitudes no se borran, el motivo es obligatorio al rechazar y nadie resuelve su propia solicitud.
- Se borró `supabase_schema.sql`: el esquema vive solo en `supabase/migrations/`.
- Pruebas: 131 de la base (pgTAP) y 47 unitarias (Vitest), todas pasan.

| Grado | 50 % | 100 % |
|---|---|---|
| PP | 7,90 % | 6,00 % |
| PT | 5,08 % | 3,74 % |
| SI | 8,20 % | 8,20 % |
| IT | 5,05 % | 5,05 % |
| OF | 5,40 % | 6,33 % |

---

## 1. Decisiones que tengo que tomar yo

- [x] **Color de error `#B3261E`**: se deja.
- [ ] **Convenios**: no hay página propia por ahora (se quedan como sección en `/cuenta`, `#convenios`). **Recordatorio: preguntar a la cooperativa si quieren página propia.**
- [x] **Estado vacío en `/cuenta`**: hecho dentro de la tarjeta «Tu solicitud»: mensaje «Todavía no tienes solicitudes de crédito», botón «Nueva solicitud» y aviso sobre el tope. Para verlo: `/cuenta?vacio=1`.
- [x] **Logo en celular**: se deja como enlace a la landing (`/`).
- [x] **Escudo**: se deja `public/logos/vector/green-alliance-logo.svg`.
- [x] **Formulario de ingreso entre 640 y 767 px**: desde 640 px ahora es una columna centrada de 440 px. Solo afecta `/ingresar` y `/ingresar/codigo`; las demás pantallas no cambian.
- [x] **Panel verde en tableta (640–1023 px)**: el logo y el título quedan centrados en la misma columna de 440 px que el formulario. Celular y PC sin cambios.
- [x] **P-10**: el asociado **no** puede cambiar su nombre (lo bloquea la base) pero **sí** su teléfono. En `/cuenta` hay un apartado «Mis datos» (nombre, cédula y grado de solo lectura; celular editable con «Guardar»).
- [x] **Migración `20260923173355` aplicada en producción** el 23-sep. Repo y base siguen sincronizados.

## 2. Datos que tengo que conseguir

Van en `lib/config.ts` (o en una variable de entorno) y en `lib/mock.ts` → datos reales.

- [ ] Número de **WhatsApp** (`NEXT_PUBLIC_WHATSAPP`), para los enlaces `wa.me/57<NÚMERO>`.
- [ ] **[N] días hábiles** de respuesta (`DIAS_RESPUESTA`).
- [ ] **Correo de contacto** (`CORREO_CONTACTO`).
- [ ] **Texto de vigilancia de Supersolidaria** (`TEXTO_VIGILANCIA`).
- [ ] **Política de datos**: el texto y la ruta (se sugiere `/politica-de-datos`); hoy el enlace es `href="#"`.
- [ ] **Destino de «Nueva solicitud»** (nav y acceso rápido de `/cuenta`): hoy es `href="#"`.
- [ ] **Fotos reales** de asociados y apoyos, **cifras** y **testimonios** para la landing.
- [ ] **Tiempo de respuesta** real para la landing (hoy dice `[TIEMPO]`, y `[T]` en celular).
- [ ] **Correos reales de los asociados**: el ingreso con código los necesita. Hoy las cuentas usan un correo inventado (`cedula@asociados…`). Deben venir en el Excel de importación.

## 3. Funcionalidad (siguiente agente: `ga-funcionalidad-botones`)

Busca `TODO(funcionalidad)` en el código para ver cada punto exacto.

### Ingreso con código (antes de programar `/ingresar`)
Se decidió código por correo en vez de contraseña. Configurar en el panel de Supabase:
- [ ] **SMTP propio con Resend** (Authentication → Emails → SMTP Settings). El correo por defecto de Supabase envía muy pocos por hora.
- [ ] **Plantilla del correo** con `{{ .Token }}` (el código), no el enlace.
- [ ] Revisar el **límite de Resend** (plan gratis: unos 100 correos al día).

### `/ingresar`
- [ ] Server Action del formulario: buscar el correo con `correo_por_cedula()` (solo servidor), enviar el código con `signInWithOtp({ email, options: { shouldCreateUser: false } })`, guardar una cookie firmada y pasar a `/ingresar/codigo`.
- [ ] Estado «Enviando…» (prop `cargando`) y errores (prop `error`).

### `/ingresar/codigo`
- [ ] Leer la cookie del paso 1; si no existe, redirigir a `/ingresar`.
- [ ] Verificar con `verifyOtp({ email, token, type: 'email' })` y entrar a `/cuenta`.
- [ ] Casillas del OTP: avance automático, Backspace y pegar el código.
- [ ] «Entrar» deshabilitado hasta tener 6 dígitos.
- [ ] «Reenviar código»: su propia acción y el contador de 45 s.
- [ ] «Cambiar cédula» y la flecha volver deben limpiar la cookie.

### `/afiliacion`
- [ ] Server Action: validar con zod, poner límites por IP y por cédula, guardar en la base, enviar el correo con Resend y pasar a `/afiliacion/enviada`.
- [ ] Cargar los grados desde la tabla `grados_credito`.
- [ ] Campo trampa (honeypot): si viene lleno, responder «éxito» sin guardar.
- [ ] Mostrar errores (prop `errores`) y el estado de carga.
- Al aprobar una afiliación **no** se crea el perfil automáticamente: la solicitud queda registrada. Las cuentas se crearán por importación de Excel.

### `/afiliacion/enviada`
- [ ] Mostrar el correo real (desde la cookie o un mensaje flash); si se entra directo, redirigir a `/afiliacion`.

### `/cuenta`
- [ ] Protegerla: agregar `/cuenta` al matcher de `proxy.ts` y redirigir a `/ingresar` si no hay sesión.
- [ ] Cargar perfil, última solicitud (con su tasa de interés), tope y convenios.
- [ ] «Salir» con `signOut` y volver a `/ingresar`.
- [ ] «Mis datos»: Server Action que actualiza solo `perfiles.telefono` (props `errorTelefono` y `guardandoTelefono` ya existen). Si hay error, alinear el botón «Guardar» con el campo desde 640 px.

### `/` (landing)
- [ ] «Mi cuenta», «Ingresar», «Solicitar crédito» y «Ver beneficios» deben ir a `/cuenta` si hay sesión.
- [ ] Convenios: por ahora se quedan fijos en la landing (no desde la tabla `convenios`).

### Otros
- [ ] Formulario de solicitud de crédito conectado a la nueva `/cuenta` (hoy vive en `/dashboard/solicitar`; ya muestra la tasa y exige mínimo 100.000).
- [ ] Panel de administración `/admin`: listado de solicitudes, aprobar y rechazar (rechazar pide motivo; un admin no puede resolver su propia solicitud).
- [ ] Correos con Resend cuando se crea o se resuelve una solicitud.
- [ ] Importación de asociados desde Excel (cuando llegue).

## 4. Verificación y cierre

- [ ] Correr `ga-verificador-qa` y `ga-verificador-responsive` cuando haya funcionalidad.
- [ ] Borrar `/login` y `/dashboard` cuando `/ingresar` y `/cuenta` funcionen.
- [ ] Hacer commit de las pantallas nuevas, subir a GitHub y desplegar en Vercel.

---

## Notas para retomar

- **Abrir Claude Code dentro de `green-alliance-app`**, no en `Green Alliance`. Si no, no se cargan los agentes del proyecto (`ga-*`).
- **Node en Windows:** está instalado en `C:\Program Files\nodejs`, pero la terminal de Claude Code no lo tiene en el PATH. En Bash, antes de cada comando: `export PATH="/c/Program Files/nodejs:$PATH"`. Con eso funcionan `npx tsc`, `npx eslint`, `npx vitest` y `npx supabase`.
- **Compilar en Windows:** con el PATH de arriba, `npm run build` funciona (probado el 23-sep).
- **Patrones responsive del proyecto** (aprendidos al arreglar el ingreso):
  - Breakpoints de Tailwind por defecto: `sm` 640, `md` 768, `lg` 1024 (`lg` = versión PC). El diseño solo trae 390 y 1280 px: revisar que 767 y 768 px no salten.
  - Una columna se centra con `mx-auto` + un `max-w-*` de token (`max-w-form-ingreso` = 440 px), activado desde el primer breakpoint donde sobra espacio.
  - Mobile-first: la base es la maqueta Móvil y `lg:` aplica la PC.
  - Antes de tocar clases compartidas (`CLASES_FORM_INGRESO`, `PanelIngreso`), buscar con grep qué pantallas las usan.
  - En Next 16, `searchParams` es una promesa: se tipa con `PageProps<"/ruta">` y se lee con `await`.
- **Compilar en WSL** (lo que se usó antes):
  ```bash
  wsl -d Ubuntu -- bash -lc "cd '/mnt/c/Users/Sebastian/Documents/Guishe/Green Alliance/green-alliance-app' && source ~/.nvm/nvm.sh && nvm use 22 && npm run build"
  ```
- **Pruebas:**
  - Unitarias: `npm run test:unit`.
  - Base de datos: `npm run test:db`. Necesita Docker Desktop abierto y Supabase local corriendo (`npx supabase start`). `npx supabase db reset` vuelve a crear la base local con todas las migraciones.
- **Dónde está cada cosa:**
  - Componentes UI: `components/ui/`
  - Pantallas: `components/pantallas/`
  - Datos de ejemplo: `lib/mock.ts`
  - Configuración: `lib/config.ts`
  - Reglas del crédito en la app: `lib/credito.ts`
  - Migraciones y pruebas de la base: `supabase/`
  - Tokens: `tailwind.config.ts` y `app/globals.css`
- **Para seguir**, un buen primer paso es: «ga-funcionalidad-botones /ingresar» (después de configurar el SMTP).
