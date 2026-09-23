# Correos a los asociados · Green Alliance

La plataforma envía tres correos a los asociados:

| # | Correo | Quién lo envía | Estado |
|---|---|---|---|
| 1 | Ingreso aceptado | Resend (plantilla) | **Falta programarlo**: la plantilla se puede crear ya, pero la app todavía no lo envía |
| 2 | Código de 6 dígitos para ingresar | Supabase Auth (con Resend como SMTP) | **Funciona** en local; en producción falta configurar el panel |
| 3 | Resultado del crédito (se puede desembolsar o no) | Resend (dos plantillas: aprobado / rechazado) | **Código listo, falta conectarlo**: no existe todavía la pantalla del administrador para aprobar o rechazar |

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

**Pendiente en la app:** falta la acción del administrador que aprueba la afiliación, crea el usuario en Supabase Auth y el perfil (cédula, grado, correo) y envía este correo. `URL_INGRESO` es la página `/ingresar` del dominio de producción.

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
