# Correos a los asociados · Green Alliance

La plataforma envía cinco correos: cuatro a los asociados (al correo personal) y un aviso sin datos al correo institucional:

| # | Correo | Quién lo envía | Estado |
|---|---|---|---|
| 1 | Ingreso aceptado | Resend (plantilla) | **Programado** (2026-09-24, `ga-funcionalidad-botones`): se envía al aprobar una afiliación desde `/admin` |
| 2 | Código de 6 dígitos para ingresar | Supabase Auth (con Resend como SMTP) | **Funciona** en local; en producción falta configurar el panel |
| 3 | Resultado del crédito (se puede desembolsar o no) | Resend (dos plantillas: aprobado / rechazado) | **Conectado** a `/admin/creditos`; falta crear y publicar las plantillas en Resend |
| 4 | Número de boleta del sorteo mensual | Resend (plantilla) | **Funciona** (`lib/correo/sorteo.ts`, `app/cuenta/actions-sorteo.ts`); falta crear y publicar la plantilla en Resend |
| 5 | Aviso sin datos al correo institucional (RS-02) | Resend (plantilla, con respaldo en texto plano) | **Programado** (`lib/correo/institucional.ts`); falta crear y publicar la plantilla en Resend |

Reglas comunes para las plantillas de Resend:

- En **Resend → Templates** crea la plantilla con el nombre indicado, pega el HTML de `docs/resend/<plantilla>.html` (ver cada sección), configura las variables con esos nombres exactos y **publícala**.
- Las plantillas y el correo del código comparten el mismo diseño: encabezado verde con el logo blanco (cargado de `https://www.greenallianceco.com/logos/blanco/green-alliance-logo-blanco-600.png`) y pie con sitio, correo de soporte y WhatsApp. El logo solo carga cuando `public/logos` está desplegado en producción.
- En el asunto y el contenido, las variables se escriben `{{{NOMBRE}}}`.
- El alias o ID publicado va en la variable de entorno indicada, tanto en desarrollo como en producción (Vercel). Nunca en variables `NEXT_PUBLIC_`.
- Remitente: el dominio verificado en Resend, en `EMAIL_FROM`. Llave: `RESEND_API_KEY`.

---

## 1. Ingreso aceptado

Se envía cuando la cooperativa aprueba la afiliación de una persona y su cuenta queda activa.

**Nombre:** `ga-ingreso-aceptado`  
**Entorno:** `RESEND_TEMPLATE_INGRESO_ACEPTADO`  
**Asunto:** Ya eres asociado de la Cooperativa Green Alliance  
**Variables:** `NOMBRE`, `CEDULA`, `URL_INGRESO`.  
**HTML:** `docs/resend/ingreso-aceptado.html`

Contenido sugerido:

> Hola, {{{NOMBRE}}}: tu afiliación a la Cooperativa Green Alliance fue aceptada y tu cuenta ya está activa.  
> Para entrar, abre {{{URL_INGRESO}}} y escribe tu cédula ({{{CEDULA}}}). Te enviaremos a este correo un código de 6 dígitos para ingresar; no necesitas contraseña.  
> Desde tu cuenta podrás solicitar un crédito y ver el estado de tus solicitudes.  
> Si no solicitaste la afiliación, comunícate con el equipo de Green Alliance.

**Programado** (2026-09-24, `ga-funcionalidad-botones`): al pulsar «Aprobar» en `/admin/afiliaciones/[id]` (`app/admin/afiliaciones/actions.ts#aprobarAfiliacion`), que crea el usuario en Supabase Auth (correo institucional, cédula y grado en `app_metadata`), completa el perfil (asesor y teléfono) y envía este correo. `URL_INGRESO` se arma con `SITIO_URL` (en producción `https://www.greenallianceco.com`); solo en desarrollo, si falta, se usa el host de la petición. Si Resend falla, la cuenta queda creada igual y el error se registra (no bloquea la aprobación).

---

## 2. Código de 6 dígitos para ingresar

Este correo **no es una plantilla de Resend**: lo envía Supabase Auth cuando la persona escribe su cédula en `/ingresar` (`signInWithOtp` en `lib/ingreso/servidor.ts`). El código vence en 10 minutos.

**Local (ya funciona):** la plantilla está en `supabase/templates/codigo-ingreso.html` y se configura en `supabase/config.toml` (`[auth.email.template.magic_link]`, `otp_length = 6`, `otp_expiry = 600`). Los correos llegan a Mailpit: http://127.0.0.1:54324.

**Producción (configurar en el panel de Supabase del proyecto PagGreenAlliance):**

1. **Authentication → Emails → SMTP Settings:** activa SMTP propio con Resend.
   - Host `smtp.resend.com` · Puerto `465` · Usuario `resend` · Contraseña: una API key de Resend.
   - Remitente: la misma dirección de `EMAIL_FROM` · Nombre: `Cooperativa Green Alliance`.
2. **Authentication → Emails → Templates → Magic Link:**
   - Asunto: `Tu código para entrar a Green Alliance`
   - Cuerpo: copia el de `supabase/templates/codigo-ingreso.html`. Debe incluir `{{ .Token }}`, que es el código de 6 dígitos. No uses `{{ .ConfirmationURL }}`: el ingreso es con código, no con enlace.
3. **Authentication → Providers → Email:** largo del código (OTP length) `6` y vencimiento (OTP expiry) `600` segundos.

Sin el paso 1, Supabase usa su servidor de correo de prueba, que solo envía unos pocos correos por hora y no sirve para producción.

---

## 3. Resultado del crédito

Avisa al asociado si su crédito se puede desembolsar o no. Son dos plantillas; la app elige una según la decisión (`enviarResultadoCredito` en `lib/correo/credito.ts`). `MONTO` llega con puntos de miles (`1.500.000`) y la plantilla le antepone el `$`.

### 3a. Crédito aprobado

**Nombre:** `ga-credito-aprobado`  
**Entorno:** `RESEND_TEMPLATE_CREDITO_APROBADO`  
**Asunto:** Tu crédito fue aprobado · Cooperativa Green Alliance  
**Variables:** `NOMBRE`, `MONTO`, `MOTIVO` (con valor por defecto vacío; no se usa en este correo).  
**HTML:** `docs/resend/credito-aprobado.html`

Contenido sugerido:

> Hola, {{{NOMBRE}}}: tu solicitud de crédito por ${{{MONTO}}} fue aprobada y se puede desembolsar.  
> El equipo de Green Alliance se pondrá en contacto contigo para coordinar el desembolso.

### 3b. Crédito no aprobado

**Nombre:** `ga-credito-rechazado`  
**Entorno:** `RESEND_TEMPLATE_CREDITO_RECHAZADO`  
**Asunto:** Actualización de tu solicitud de crédito · Cooperativa Green Alliance  
**Variables:** `NOMBRE`, `MONTO`, `MOTIVO`.  
**HTML:** `docs/resend/credito-rechazado.html`

Contenido sugerido:

> Hola, {{{NOMBRE}}}: en esta ocasión no es posible desembolsar tu solicitud de crédito por ${{{MONTO}}}.  
> Motivo: {{{MOTIVO}}}.  
> Si tienes preguntas, comunícate con el equipo de Green Alliance.

**Conectado:** se envía al aprobar o rechazar un crédito desde `/admin/creditos` (`app/admin/creditos/actions.ts`). La base exige un motivo al rechazar (migración `blindar_solicitudes_y_revisiones`, aún no aplicada en producción), y ese motivo es el que va en `MOTIVO`.

---

## 4. Número de boleta del sorteo

Se envía cuando un asociado pulsa «Quiero participar» en el sorteo mensual de `/cuenta` (docs/spec-fase-2.md §4, `participar_sorteo()`). Es el único momento en el que el número de boleta existe fuera de la base: la Server Action lo manda por este correo y nunca lo devuelve al navegador (`app/cuenta/actions-sorteo.ts`, `lib/correo/sorteo.ts`). El asociado lo escribe de vuelta en el paso 2 del modal para confirmar su participación.

**Nombre:** `ga-sorteo-boleta`
**Entorno:** `RESEND_TEMPLATE_SORTEO_BOLETA`
**Asunto:** ¡Ya tienes tu boleta para el sorteo de {{{MES}}}! · Cooperativa Green Alliance
**Variables:** `NOMBRE`, `NUMERO_BOLETA`, `MES`.  
**HTML:** `docs/resend/sorteo-boleta.html`

Contenido sugerido (tono alegre, coherente con la celebración de la pantalla):

> ¡Hola, {{{NOMBRE}}}! 🎉 Ya estás a un paso de participar en el sorteo de {{{MES}}} de la Cooperativa Green Alliance.
>
> Tu número de boleta es **{{{NUMERO_BOLETA}}}**.
>
> Vuelve a la pestaña de «Sorteo del mes» en tu cuenta y escribe este número para confirmar tu participación. El ganador se anunciará por los canales oficiales de Green Alliance.
>
> Si tú no pediste participar en el sorteo, ignora este correo.

**Nota (local / desarrollo):** si `RESEND_TEMPLATE_SORTEO_BOLETA` no está configurada (o el envío falla), la app NO se cae: registra el número en el log estructurado del servidor (`registrar("info"/"error", { evento: "sorteo_boleta_..." })`) para poder probar el flujo de confirmación sin depender de Resend. Ese número nunca llega a la interfaz ni a la respuesta HTTP.

---

## 5. Aviso sin datos al correo institucional (RS-02)

Al correo institucional (que nunca se verifica y puede controlarlo el empleador) **solo** llega este aviso. Se manda junto a los correos de aprobar la afiliación, resultado del crédito y boleta del sorteo (`avisarCorreoInstitucional` en `lib/correo/institucional.ts`). El texto es único: «Tienes una novedad en tu cuenta de Green Alliance; ingresa para verla», con un botón al sitio. **No lleva** cédula, nombre, montos, motivos ni número de boleta, y la plantilla no debe tener ninguna variable con datos personales.

**Nombre / alias:** `ga-aviso-institucional`  
**Entorno:** `RESEND_TEMPLATE_AVISO_INSTITUCIONAL`  
**Asunto:** Novedad en tu cuenta de Green Alliance  
**Texto de vista previa (preview):** Tienes una novedad en tu cuenta de Green Alliance; ingresa para verla  
**Variable (única):** `URL_INGRESO` (enlace a `/ingresar`; no es un dato personal; valor por defecto `https://www.greenallianceco.com/ingresar`).  
**HTML:** `docs/resend/aviso-institucional.html` · **Texto:** `docs/resend/aviso-institucional.txt`

**Pasos para publicarla (Sebas):**

1. Resend → **Templates → Create template**, nombre `ga-aviso-institucional`.
2. Pega todo `docs/resend/aviso-institucional.html`.
3. Declara la variable `URL_INGRESO` (texto, valor por defecto `https://www.greenallianceco.com/ingresar`). No agregues otras.
4. Asunto: `Novedad en tu cuenta de Green Alliance`. Vista previa: la frase de arriba. Versión texto: `docs/resend/aviso-institucional.txt`.
5. **Publish**. Copia el alias (`ga-aviso-institucional`) o el ID a `RESEND_TEMPLATE_AVISO_INSTITUCIONAL` en `.env.local` y en Vercel (Production y Preview) y vuelve a desplegar.

**Respaldo:** si `RESEND_TEMPLATE_AVISO_INSTITUCIONAL` no está configurada, o la plantilla falla, se manda el mismo texto en texto plano (asunto, frase y enlace) y se registra `aviso_institucional_sin_plantilla` o `aviso_institucional_plantilla_fallo` sin datos personales. Si también falla el respaldo, se registra `aviso_institucional_fallo` y la acción principal sigue.

---

## Diagnóstico: «llega el correo sin el diseño de la plantilla»

Si el correo llega como texto plano (sin logo ni colores), la app usó el **respaldo**. Pasa en uno de estos casos; el log del servidor dice cuál (`correo_plantilla_faltante`):

| Registro | Causa | Qué revisar |
|---|---|---|
| `motivo: variable_vacia` | `RESEND_TEMPLATE_SORTEO_BOLETA` no existe o está vacía en el servidor | Vercel → Settings → Environment Variables: que exista en **Production** (y Preview), sin comillas ni espacios. Después, **redeploy** (las variables nuevas no aplican a despliegues anteriores). |
| `motivo: plantilla_fallo`, 404 | ID o alias equivocado | Debe ser el alias `ga-sorteo-boleta` o el ID de la plantilla, tal cual aparece en Resend → Templates. |
| `motivo: plantilla_fallo`, 404/422 «not published» | La plantilla está en borrador | Pulsar **Publish** en Resend. Cada cambio posterior también debe publicarse. |
| `motivo: plantilla_fallo`, 422 de variables | La plantilla declara variables con otro nombre o sin valor por defecto | Deben ser exactamente `NOMBRE`, `NUMERO_BOLETA` y `MES` (mayúsculas, sin espacios). |
| `motivo: plantilla_fallo`, 401/403 | Llave de otro entorno o sin permiso de envío | `RESEND_API_KEY` con permiso «Sending access» y dominio de `EMAIL_FROM` verificado. |

El mismo diagnóstico aplica a las demás plantillas (cambia el nombre de la variable de entorno).
