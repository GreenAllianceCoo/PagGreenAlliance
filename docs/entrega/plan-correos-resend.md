# Plan de correos (Resend) · Green Alliance

Documento para la cooperativa. Explica cuántos correos manda la plataforma, qué límite tiene el plan gratuito y cuándo conviene pagar un plan.

## 1. Qué es Resend y qué límite tiene hoy

Resend es el servicio que envía los correos de la plataforma (el código de ingreso, los avisos de crédito, la boleta del sorteo, etc.).

| Plan | Cupo | Costo |
|---|---|---|
| Gratuito (el actual) | **100 correos por día** y **3.000 por mes** | 0 |
| Pro | Unos 50.000 correos al mes y sin tope diario | Cerca de USD 20 al mes **(verificar en resend.com/pricing; no pude consultarlo)** |

El límite que se llega primero es el **diario (100)**, no el mensual. Si en un día se pasan de 100, Resend rechaza los correos que sobran. La plataforma no se cae: el crédito, la afiliación o la boleta se guardan igual, pero el asociado no recibe el aviso (queda registrado el fallo).

**Importante:** el código de 6 dígitos para ingresar también sale por Resend (Supabase lo envía con la cuenta de Resend). Cada vez que alguien entra a la plataforma, gasta 1 correo del cupo.

## 2. Cuántos correos genera cada evento

Cuando la persona tiene correo institucional distinto al personal, se manda además un **aviso sin datos** a ese correo (por eso muchos eventos cuentan 2).

| Evento | Correos | A quién |
|---|---|---|
| Ingresar a la plataforma (código) | 1 por cada ingreso (más 1 por cada reenvío del código) | Correo personal |
| Afiliación aprobada | 2 | Personal (ingreso aceptado) + institucional (aviso) |
| Crédito aprobado o rechazado | 2 | Personal + institucional |
| Crédito desembolsado | 2 | Personal + institucional |
| Crédito habilitado para una nueva solicitud | 2 | Personal + institucional |
| Inscripción al sorteo (boleta) | 2 | Personal (boleta) + institucional (aviso) |
| Reenvío de la boleta (máximo 3 al día por persona) | 1 cada uno | Personal |
| Ganador del sorteo | 1 | Personal |
| Alerta de un asociado (p. ej. retiro anticipado) | 1 por cada administrador | Administradores |
| Solicitud de recuperación de acceso | 1 por cada administrador | Administradores |
| Cambio de correo de ingreso | 1 o 2 | Correo anterior y nuevo |

La solicitud de afiliación de una persona nueva, por sí sola, no manda correo al asociado: el correo sale cuando la cooperativa la aprueba.

## 3. Estimación

El volumen real depende del número de asociados, que Sebas debe confirmar. Como ejemplo, con **200 asociados activos**:

| Concepto | Cálculo | Correos al mes |
|---|---|---|
| Ingresos (cada asociado entra unas 4 veces al mes) | 200 × 4 | 800 |
| Sorteo (participan 100 de los 200): boleta + aviso | 100 × 2 | 200 |
| Reenvíos de boleta (unos 20) | 20 | 20 |
| Créditos (30 al mes: resultado, desembolso, etc., unos 4 correos cada uno) | 30 × 4 | 120 |
| Afiliaciones nuevas (20) | 20 × 2 | 40 |
| Alertas y recuperaciones a administradores (3 admins, unas 20 al mes) | 20 × 3 | 60 |
| **Total aproximado** | | **~1.250 al mes** |

El mes cabe en el plan gratuito, pero **el día es el problema**: del 1 al 5 de cada mes se abre la inscripción al sorteo, y ese día se juntan boletas, avisos y códigos de ingreso. Con 200 asociados, un primer día fuerte puede pasar de 100 correos.

## 4. Cuándo conviene subir de plan

Sube al plan Pro cuando ocurra **cualquiera** de estas cosas:

- Más de unos **60 a 80 correos en un solo día** de forma frecuente (el día 1 del sorteo, por ejemplo). Se ve en el panel de Resend, en Emails.
- Más de unos **2.000 correos al mes** (queda margen sobre el tope de 3.000).
- Más de **unos 150 asociados activos**, o una campaña de afiliación grande.
- Resend devuelve el error de límite diario (aparece como fallo de correo en los registros).

Mientras se vea que se está por debajo, el gratuito alcanza. Recomendación: **pasar a Pro antes de la primera apertura del sorteo con todos los asociados**, para no perder boletas por el tope diario.

## 5. Qué debe hacer Sebas

1. Confirmar en el panel de Resend (resend.com → Settings → Billing) el plan actual y su cupo.
2. Confirmar el precio actual del plan Pro en resend.com/pricing y actualizar este documento.
3. Si se sube de plan, no hay que cambiar nada en la plataforma: la llave y la configuración siguen igual.
4. Revisar cada mes el uso en el panel y anotar el día de mayor volumen.
