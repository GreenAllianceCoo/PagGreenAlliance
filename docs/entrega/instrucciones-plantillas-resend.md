# Instrucciones: publicar las 10 plantillas de correo en Resend

Para Sebas. Sin las plantillas la plataforma igual envía los correos, pero en texto plano (el respaldo). Con ellas salen con el logo y el diseño de Green Alliance.

Los HTML ya están hechos en `docs/resend/`. Solo hay que pegarlos.

## Tabla de las 10 plantillas

| # | Correo | Archivo (`docs/resend/`) | Alias en Resend | Variable de entorno (Vercel) | Asunto | Variables de la plantilla (valor por defecto) |
|---|---|---|---|---|---|---|
| 1 | Ingreso aceptado | `ingreso-aceptado.html` | `ga-ingreso-aceptado` | `RESEND_TEMPLATE_INGRESO_ACEPTADO` | Tu afiliación a Green Alliance fue aceptada | NOMBRE, CEDULA, URL_INGRESO |
| 2 | Crédito aprobado | `credito-aprobado.html` | `ga-credito-aprobado` | `RESEND_TEMPLATE_CREDITO_APROBADO` | Tu crédito de Green Alliance fue aprobado | NOMBRE, MONTO, MOTIVO (vacío) |
| 3 | Crédito rechazado | `credito-rechazado.html` | `ga-credito-rechazado` | `RESEND_TEMPLATE_CREDITO_RECHAZADO` | Respuesta a tu solicitud de crédito de Green Alliance | NOMBRE, MONTO, MOTIVO |
| 4 | Boleta del sorteo | `sorteo-boleta.html` | `ga-sorteo-boleta` | `RESEND_TEMPLATE_SORTEO_BOLETA` | Tu boleta para el sorteo de {{{MES}}} · Green Alliance | NOMBRE, NUMERO_BOLETA, MES |
| 5 | Aviso institucional (sin datos) | `aviso-institucional.html` | `ga-aviso-institucional` | `RESEND_TEMPLATE_AVISO_INSTITUCIONAL` | Novedad en tu cuenta de Green Alliance | URL_INGRESO (por defecto https://www.greenallianceco.com/ingresar) |
| 6 | Crédito desembolsado | `credito-desembolsado.html` | `ga-credito-desembolsado` | `RESEND_TEMPLATE_CREDITO_DESEMBOLSADO` | Tu crédito de Green Alliance fue desembolsado | NOMBRE, MONTO, FECHA, COMPROBANTE (vacío) |
| 7 | Nuevo crédito habilitado | `credito-habilitado.html` | `ga-credito-habilitado` | `RESEND_TEMPLATE_CREDITO_HABILITADO` | Ya puedes solicitar un nuevo crédito en Green Alliance | NOMBRE |
| 8 | Ganador del sorteo | `sorteo-ganador.html` | `ga-sorteo-ganador` | `RESEND_TEMPLATE_SORTEO_GANADOR` | ¡Ganaste el sorteo de Green Alliance! | NOMBRE, MES |
| 9 | Correo de ingreso cambiado | `correo-cambiado.html` | `ga-correo-cambiado` | `RESEND_TEMPLATE_CORREO_CAMBIADO` | Tu correo de ingreso cambió | NOMBRE, URL_INGRESO |
| 10 | Código para eliminar un asociado | `codigo-eliminacion.html` | `ga-codigo-eliminacion` | `RESEND_TEMPLATE_CODIGO_ELIMINACION` | Código para confirmar la eliminación de un asociado | NOMBRE, CODIGO, MINUTOS (tipo número, 10) |

Los nombres de variables van en MAYÚSCULAS, exactamente así. Si una letra no coincide, el correo sale con el hueco vacío.

Las plantillas 1 a 5 ya existían; si ya las publicaste, no las repitas. Las nuevas son de la 6 a la 10.

## Paso 1. Publicar cada plantilla en Resend

Repite para cada una de las 5 nuevas (6 a 10):

1. Entra a Resend → **Templates** → **Create template**.
2. Ponle como nombre el alias de la tabla (por ejemplo `ga-credito-desembolsado`).
3. Cambia a la vista de código (HTML) y pega TODO el contenido del archivo de `docs/resend/`.
4. En **Subject** escribe el asunto de la tabla.
5. Declara las variables, una por una (**Add variable**): nombre en mayúsculas, tipo texto (`string`).
   - `MINUTOS` en la plantilla 10 es de tipo **número** (`number`), con valor por defecto `10`.
   - `COMPROBANTE` en la plantilla 6: déjala con valor por defecto vacío. La plataforma la manda siempre (vacía cuando no hay comprobante), así que no se rompe. Si Resend no te deja guardarla sin valor, ponle un solo espacio como valor por defecto.
   - El resto no necesitan valor por defecto (la plataforma siempre las manda).
6. Pulsa **Publish**.
7. Confirma que el alias de la plantilla (o su ID) quedó igual al de la tabla. Ese es el valor que va en Vercel.

## Paso 2. Conectarlas en Vercel

Para cada plantilla nueva:

1. Vercel → proyecto de Green Alliance → **Settings** → **Environment Variables**.
2. **Add**: nombre = la variable de la tabla (por ejemplo `RESEND_TEMPLATE_CREDITO_DESEMBOLSADO`), valor = el alias (por ejemplo `ga-credito-desembolsado`), sin comillas ni espacios.
3. Marca el entorno **Production** (y Preview si quieres probar ahí).
4. Guarda.

Cuando termines las 5, haz **Redeploy**: Deployments → el último → los tres puntos → **Redeploy**. Las variables nuevas no aplican a despliegues anteriores.

No pegues la llave de Resend (`RESEND_API_KEY`) en ningún archivo del código; solo vive en Vercel.

## Paso 3. Probar cada correo desde la plataforma

Usa un asociado de prueba con un correo tuyo. Si algo no llega, revisa spam y el panel de Resend → Emails. Si llegó como texto sencillo, la plantilla no está conectada (falta la variable en Vercel o el redeploy).

| Correo | Cómo dispararlo |
|---|---|
| Crédito desembolsado | Admin → Créditos → marcar un crédito aprobado como desembolsado. Probar dos veces: con comprobante (debe salir la frase del comprobante) y sin comprobante (el espacio queda vacío, sin texto raro). |
| Nuevo crédito habilitado | Admin → Asociados → ficha del asociado → habilitar nuevo crédito. |
| Ganador del sorteo | Admin → Sorteo → elegir ganador del mes. |
| Correo de ingreso cambiado | Admin → Asociados → ficha → cambiar correo de ingreso. Llega al correo anterior y al nuevo. |
| Código de eliminación | Admin → Asociados → ficha → Eliminar definitivamente → pedir código (llega al correo del admin que lo pide). No lo confirmes con un asociado real. |
| Las 5 existentes | Ingreso aceptado: aceptar una afiliación. Aprobado / rechazado: decidir una solicitud en Admin → Créditos. Boleta: pedir boleta en «Sorteo del mes» de la cuenta del asociado. Aviso institucional: sale junto con cualquiera de los eventos anteriores, al correo institucional. |

## Qué debe cumplir cada correo

- El correo institucional recibe SOLO el aviso genérico (plantilla 5), sin cédula, nombre, montos ni número de sorteo.
- Ningún correo muestra la tasa de interés.
- El ganador del sorteo no lleva el número de boleta ni la cédula; el código de eliminación no lleva datos del asociado.
