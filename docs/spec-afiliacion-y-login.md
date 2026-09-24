# Especificación: login con cédula + código y formulario «Deseo afiliarme»

Diseño elegido: Propuesta C (cercana y transparente) + ingreso con código al correo. Las propuestas A y B se descartaron. Pantallas en el lienzo de diseño «Green Alliance · Plataforma web» (exportadas en `design/`).

## 0. Pantallas (cada una en versión escritorio 1280 px y celular 390 px)
1. Landing (`/`)
2. Ingreso paso 1 · cédula (`/ingresar`)
3. Ingreso paso 2 · código (`/ingresar/codigo`)
4. Inicio del asociado (`/cuenta`)
5. Afiliación · formulario (`/afiliacion`)
6. Afiliación · enviada (`/afiliacion/enviada`)

Patrón responsive: en escritorio el ingreso usa panel verde a la izquierda + formulario a la derecha; en celular el panel verde pasa arriba. El formulario de afiliación va en 2 columnas en escritorio y 1 en celular. Las tarjetas de convenios van en grilla de 5 en escritorio y en lista en celular.

## 1. Ingreso con cédula + código (sin contraseña)
- Paso 1: el asociado escribe su cédula → «Enviarme el código».
- El servidor busca la cédula en `perfiles` (debe ser única), obtiene el correo y llama `signInWithOtp({ email, options: { shouldCreateUser: false } })`.
- La plantilla de correo de Supabase debe incluir `{{ .Token }}` para enviar el código de 6 dígitos.
- Paso 2: el asociado escribe el código → `verifyOtp({ email, token, type: 'email' })` → pantalla de inicio (estado de la solicitud).
- Privacidad: el login **nunca** revela si una cédula existe. Mensaje fijo: «Si tu cédula está registrada, te enviamos un código». El correo se muestra enmascarado (ju•••@correo.com).
- En el paso 1 siempre se ve el botón **«Deseo afiliarme»** → `/afiliacion`.

## 2. Formulario «Deseo afiliarme» (`/afiliacion`)
**Para qué sirve:** captar a policías que aún no son asociados y quieren serlo. No crea usuario ni da acceso; genera una solicitud que el equipo revisa y avisa por correo.

**Campos:**
| Campo | Regla |
|---|---|
| Nombres y apellidos | Obligatorio, 3–120 caracteres |
| Cédula | Obligatoria, solo números, 6–10 dígitos, sin otra solicitud pendiente |
| Grado | Obligatorio, lista de `grados_credito` |
| Unidad o dependencia | Opcional, hasta 120 |
| Celular (WhatsApp) | Obligatorio, 10 dígitos, empieza por 3 |
| Correo | Obligatorio, formato válido, en minúsculas |
| Mensaje | Opcional, hasta 500 |
| Autorización de datos (Ley 1581 de 2012) | Obligatoria, se guarda la fecha |

**Al enviar:**
1. Server Action / Route Handler de Next.js valida con las mismas reglas.
2. Inserta en la tabla nueva `solicitudes_afiliacion` con estado `pendiente`.
3. Redirige a «Solicitud enviada». No se envían correos en este paso: el equipo revisa las solicitudes pendientes en la base y, si la aprueba, la persona recibe el correo «Ingreso aceptado» (ver `docs/resend-plantillas.md`).

**Cédula con otra solicitud `pendiente` (S-06, revisión de seguridad 2026-09-24):** la respuesta es **idéntica** a la de un envío exitoso (mismo redirect a «Solicitud enviada», mismo tiempo aproximado, sin ningún mensaje distinto bajo el campo Cédula). No se guarda una segunda fila: lo impide el índice único parcial de la base sobre `cedula` mientras `estado = 'pendiente'`. El equipo puede ver el intento en el registro del servidor (evento `afiliacion_duplicada`, sin cédula ni datos personales), pero la persona que llena el formulario no puede distinguir, ni por el mensaje ni por cuánto tarda la respuesta, si esa cédula ya está en trámite.

**Tabla `solicitudes_afiliacion`:** id uuid · nombre text · cedula text · grado_id → grados_credito · unidad text null · celular text · email text · mensaje text null · acepto_datos_at timestamptz · estado (pendiente | contactado | aprobada | rechazada) · created_at timestamptz.

**Seguridad:** insert solo desde el servidor (service role); RLS sin acceso público; el admin lee y cambia el estado. Límite de envíos por IP y cédula + campo trampa (honeypot).

## 3. Convenios (de la presentación de negocio)
Se muestran en la landing (sección «Empresas en convenio») y en el inicio del asociado. Solo nombre + emoji + especialidad:
| Emoji | Empresa | Especialidad |
|---|---|---|
| 📱 | AMB Móvil S.A.S. | Tecnología |
| ✈️ | Locos por los Viajes S.A.S. | Viajes y turismo |
| 🦷 | Dr. Ribero Dental Group | Odontología estética |
| 🏞️ | Racing Tours Villa de Leyva | Tours en Villa de Leyva |
| 🛂 | Dream & Go Visas | Trámite de visas |

Se pueden cargar desde la tabla `convenios` (agregar columnas `emoji` y `especialidad` si no existen).

## Por confirmar con la cooperativa
- Correo que recibe las solicitudes de afiliación.
- Tiempo de respuesta ([N] días hábiles).
- Si piden documentos (foto de cédula o carné).
- Texto de la política de tratamiento de datos.
- Si al aprobar una afiliación se crea el perfil automáticamente o lo hace el admin a mano.
- Especialidad exacta de AMB Móvil y Racing Tours (se dedujo del nombre y del sector que menciona la presentación).

## Logo
Archivos en la carpeta del proyecto `logos/` (vector, blanco, relieve). En las pantallas se usa una versión horizontal: isotipo + «COOPERATIVA / GREEN ALLIANCE» (Montserrat 800). La versión apilada completa se usa en el pie de página y en la confirmación.
