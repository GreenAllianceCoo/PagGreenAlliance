# Correos a los asociados · Green Alliance

La plataforma envía cuatro correos a los asociados:

| # | Correo | Quién lo envía | Estado |
|---|---|---|---|
| 1 | Ingreso aceptado | Resend (plantilla) | **Programado** (2026-09-24, `ga-funcionalidad-botones`): se envía al aprobar una afiliación desde `/admin` |
| 2 | Código de 6 dígitos para ingresar | Supabase Auth (con Resend como SMTP) | **Funciona** en local; en producción falta configurar el panel |
| 3 | Resultado del crédito (se puede desembolsar o no) | Resend (dos plantillas: aprobado / rechazado) | **Código listo, falta conectarlo**: no existe todavía la pantalla del administrador para aprobar o rechazar |
| 4 | Número de boleta del sorteo mensual | Resend (plantilla) | **Funciona** (`lib/correo/sorteo.ts`, `app/cuenta/actions-sorteo.ts`); falta crear y publicar la plantilla en Resend |

Reglas comunes para las plantillas de Resend:

- En **Resend → Templates** crea la plantilla con el nombre indicado, configura las variables con esos nombres exactos y **publícala**.
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

Contenido sugerido:

> Hola, {{{NOMBRE}}}: tu afiliación a la Cooperativa Green Alliance fue aceptada y tu cuenta ya está activa.  
> Para entrar, abre {{{URL_INGRESO}}} y escribe tu cédula ({{{CEDULA}}}). Te enviaremos a este correo un código de 6 dígitos para ingresar; no necesitas contraseña.  
> Desde tu cuenta podrás solicitar un crédito y ver el estado de tus solicitudes.  
> Si no solicitaste la afiliación, comunícate con el equipo de Green Alliance.

**Programado** (2026-09-24, `ga-funcionalidad-botones`): al pulsar «Aprobar» en `/admin/afiliaciones/[id]` (`app/admin/afiliaciones/actions.ts#aprobarAfiliacion`), que crea el usuario en Supabase Auth (correo institucional, cédula y grado en `app_metadata`), completa el perfil (asesor y teléfono) y envía este correo. `URL_INGRESO` se arma con el host de la petición (`x-forwarded-host`/`host`), así que apunta siempre al dominio real (local o producción) sin necesitar una variable de entorno nueva. Si Resend falla, la cuenta queda creada igual y el error se registra (no bloquea la aprobación).

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

Avisa al asociado si su crédito se puede desembolsar o no. Son dos plantillas; la app elige una según la decisión (`enviarResultadoCredito` en `lib/correo/credito.ts`).

### 3a. Crédito aprobado

**Nombre:** `ga-credito-aprobado`  
**Entorno:** `RESEND_TEMPLATE_CREDITO_APROBADO`  
**Asunto:** Tu crédito fue aprobado · Cooperativa Green Alliance  
**Variables:** `NOMBRE`, `MONTO`, `MOTIVO` (con valor por defecto vacío; no se usa en este correo).

Contenido sugerido:

> Hola, {{{NOMBRE}}}: tu solicitud de crédito por ${{{MONTO}}} fue aprobada y se puede desembolsar.  
> El equipo de Green Alliance se pondrá en contacto contigo para coordinar el desembolso.

### 3b. Crédito no aprobado

**Nombre:** `ga-credito-rechazado`  
**Entorno:** `RESEND_TEMPLATE_CREDITO_RECHAZADO`  
**Asunto:** Actualización de tu solicitud de crédito · Cooperativa Green Alliance  
**Variables:** `NOMBRE`, `MONTO`, `MOTIVO`.

Contenido sugerido:

> Hola, {{{NOMBRE}}}: en esta ocasión no es posible desembolsar tu solicitud de crédito por ${{{MONTO}}}.  
> Motivo: {{{MOTIVO}}}.  
> Si tienes preguntas, comunícate con el equipo de Green Alliance.

**Pendiente en la app:** el código que envía estos correos ya existe, pero nadie lo llama, porque todavía no hay pantalla del administrador para aprobar o rechazar. La base exige un motivo al rechazar (migración `blindar_solicitudes_y_revisiones`, aún no aplicada en producción), y ese motivo es el que va en `MOTIVO`.

---

## 4. Número de boleta del sorteo

Se envía cuando un asociado pulsa «Quiero participar» en el sorteo mensual de `/cuenta` (docs/spec-fase-2.md §4, `participar_sorteo()`). Es el único momento en el que el número de boleta existe fuera de la base: la Server Action lo manda por este correo y nunca lo devuelve al navegador (`app/cuenta/actions-sorteo.ts`, `lib/correo/sorteo.ts`). El asociado lo escribe de vuelta en el paso 2 del modal para confirmar su participación.

**Nombre:** `ga-sorteo-boleta`
**Entorno:** `RESEND_TEMPLATE_SORTEO_BOLETA`
**Asunto:** ¡Ya tienes tu boleta para el sorteo de {{{MES}}}! · Cooperativa Green Alliance
**Variables:** `NOMBRE`, `NUMERO_BOLETA`, `MES`.

Contenido sugerido (tono alegre, coherente con la celebración de la pantalla):

> ¡Hola, {{{NOMBRE}}}! 🎉 Ya estás a un paso de participar en el sorteo de {{{MES}}} de la Cooperativa Green Alliance.
>
> Tu número de boleta es **{{{NUMERO_BOLETA}}}**.
>
> Vuelve a la pestaña de «Sorteo del mes» en tu cuenta y escribe este número para confirmar tu participación. El ganador se anunciará por los canales oficiales de Green Alliance.
>
> Si tú no pediste participar en el sorteo, ignora este correo.

**Nota (local / desarrollo):** si `RESEND_TEMPLATE_SORTEO_BOLETA` no está configurada (o el envío falla), la app NO se cae: registra el número en el log estructurado del servidor (`registrar("info"/"error", { evento: "sorteo_boleta_..." })`) para poder probar el flujo de confirmación sin depender de Resend. Ese número nunca llega a la interfaz ni a la respuesta HTTP.
