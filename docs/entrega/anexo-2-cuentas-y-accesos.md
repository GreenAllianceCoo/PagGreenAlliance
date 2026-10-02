# ANEXO No. 2 · Datos y control de cuentas, servicios y accesos

Contrato de prestación de servicios Nº 001-2026 entre COOPERATIVA GREEN ALLIANCE (NIT 902.103.335-7) y SEBASTIÁN SANDOVAL.

Borrador prellenado el 2026-10-01 con lo que consta en el repositorio. Lo marcado **PENDIENTE (Sebas)** debe completarse antes de firmar. **Este documento no lleva contraseñas ni llaves**: las credenciales se entregan por separado (sección 4).

---

## 1. Inventario (formato del contrato)

| Campo | Dato |
|---|---|
| Dominio | `greenallianceco.com` (sitio en `https://www.greenallianceco.com`) |
| Registrador del dominio | Gestionado por Sebastián Sandoval (contratista) a nombre de Ricardo Varón Penagos; proveedor registrador: **por confirmar** |
| Correo titular del dominio | soporte@greenallianceco.com (titular: Ricardo Varón Penagos) |
| Hosting | Vercel, plan Pro (despliega la rama `main`; nombre del proyecto en Vercel: **PENDIENTE (Sebas)**) |
| Cuenta titular del hosting | soporte@greenallianceco.com (titular: Ricardo Varón Penagos; configurada por Sebastián Sandoval) |
| Base de datos / Supabase | Supabase, proyecto ref `sqpmxizxkqorccpvjwoz` (Postgres, Auth y Storage). Plan: **PENDIENTE (Sebas)** |
| Cuenta titular de base de datos | soporte@greenallianceco.com (titular: Ricardo Varón Penagos; configurada por Sebastián Sandoval) |
| Servicio de correo / Resend | Resend (correos a asociados y SMTP del código de ingreso). Cuenta: soporte@greenallianceco.com (titular: Ricardo Varón Penagos). Dominio verificado del remitente: greenallianceco.com |
| Repositorio del código | https://github.com/GreenAllianceCoo/PagGreenAlliance (organización/cuenta `GreenAllianceCoo`) |
| Administrador principal de la cooperativa | RICARDO VARÓN PENAGOS, C.C. 1.124.998.852, soporte@greenallianceco.com |
| Fecha de entrega de credenciales | **PENDIENTE (Sebas)** |

## 2. Servicios complementarios

| Servicio | Uso | Titular |
|---|---|---|
| Número de WhatsApp de contacto (`NEXT_PUBLIC_WHATSAPP`) | Botones de contacto y ayuda en el ingreso | 311 724 1942 |
| DNS del dominio | Apunta el dominio a Vercel y verifica el remitente de Resend (registros SPF/DKIM) | Mismo registrador o proveedor DNS: **PENDIENTE (Sebas)** |
| Gestor de contraseñas de la cooperativa | Guardar las credenciales y secretos de la sección 4 | **PENDIENTE (cooperativa)** |
| Nube y disco para respaldos | Ver `respaldo-y-restauracion.md`, sección 4 | **PENDIENTE (cooperativa)** |

## 3. Usuarios con acceso hoy

**PENDIENTE (Sebas):** completar quién tiene acceso a cada servicio y con qué rol. Al cierre, solo deben quedar la cooperativa como dueña y el contratista con el acceso mínimo que necesite durante la garantía.

| Servicio | Usuario / correo | Rol | ¿Se mantiene al cierre? |
|---|---|---|---|
| Registrador del dominio | | | |
| Vercel | | | |
| Supabase | | | |
| Resend | | | |
| GitHub `GreenAllianceCoo/PagGreenAlliance` | | | |
| Plataforma `/admin` (rol `admin` en la base) | | | |

> Nota técnica: la copia local del repositorio todavía tiene configurado un remoto `carlos` → `https://github.com/DeadPando/green-alliance-app.git`, del trabajo anterior de Carlos Pardo (acuerdo cerrado el 30-sep). Hay que confirmar que Carlos no tenga acceso a ninguno de los servicios de la tabla y quitar ese remoto (`git remote remove carlos`).

## 4. Credenciales y secretos que se entregan

Se entregan **en persona o por el gestor de contraseñas de la cooperativa**, nunca por WhatsApp ni por correo sin cifrar, y nunca escritas en este documento.

| Elemento | Dónde se consulta o se cambia |
|---|---|
| Acceso de dueño a Vercel, Supabase, Resend, GitHub y registrador | Cada servicio (sección 5) |
| Contraseña de la base de datos de Supabase | Supabase, **Project Settings → Database** (se puede restablecer) |
| Variables de entorno de producción (`SUPABASE_SERVICE_ROLE_KEY`, `INGRESO_COOKIE_SECRET`, `LIMITE_HMAC_SECRET`, `CRON_SECRET`, `RESEND_API_KEY` y demás) | Vercel, **Settings → Environment Variables**. Lista completa en `documentacion-tecnica.md`, sección 5 |
| Usuario `admin` de la plataforma | Cédula del administrador principal; ingresa con código a su correo, no hay contraseña |
| Contraseña de los archivos de respaldo | Gestor de contraseñas de la cooperativa |

## 5. Lista de verificación de transferencia (cláusula décima)

La cláusula décima pide que el dominio y las cuentas esenciales queden a nombre de LA COOPERATIVA, con correos institucionales bajo su control, y que EL CONTRATISTA solo tenga los accesos necesarios.

**Antes de empezar**

- [x] Las cuentas técnicas (dominio, Vercel, Supabase y Resend) están a nombre de la cooperativa con el correo institucional `soporte@greenallianceco.com`. Falta confirmar que la contraseña y la verificación en dos pasos de ese correo queden en poder de Ricardo Varón Penagos.
- [ ] La cooperativa designa al **administrador principal** (sección 1).
- [ ] Se hace un respaldo completo con `scripts/respaldo.sh --con-storage` y se entrega a la cooperativa.

**Dominio `greenallianceco.com`**

- [ ] Cambiar el titular (registrante) a COOPERATIVA GREEN ALLIANCE y el correo de la cuenta al correo institucional. Si está en una cuenta personal, usar la opción de *transferencia de cuenta* o *push* del registrador.
- [ ] Activar la verificación en dos pasos y el bloqueo de transferencia del dominio.
- [ ] Revisar la fecha de vencimiento y la renovación automática con un medio de pago de la cooperativa.

**Vercel (plan Pro)**

- [ ] Crear un *team* a nombre de la cooperativa con el correo institucional (o cambiar el correo del dueño del team actual).
- [ ] Transferir el proyecto al team de la cooperativa (**Project Settings → General → Transfer Project**). El dominio y las variables de entorno se mueven con el proyecto; comprobarlo después.
- [ ] Medio de pago del plan Pro a nombre de la cooperativa.
- [ ] Invitar al administrador principal como **Owner**; el contratista queda como **Member** durante la garantía.

**Supabase (`sqpmxizxkqorccpvjwoz`)**

- [ ] Crear una organización a nombre de la cooperativa con el correo institucional, o cambiar el correo del dueño de la organización actual.
- [ ] Transferir el proyecto a esa organización (**Project Settings → General → Transfer project**).
- [ ] Medio de pago del plan a nombre de la cooperativa.
- [ ] Administrador principal como **Owner**; el contratista como **Developer** durante la garantía.
- [ ] Restablecer la contraseña de la base de datos y guardarla en el gestor de la cooperativa.

**Resend**

- [ ] Cuenta (o *team*) con el correo institucional como dueño; transferir o recrear el dominio verificado.
- [ ] Si se crea una cuenta nueva: generar una API key nueva, actualizar `RESEND_API_KEY` en Vercel, actualizar el SMTP de Supabase Auth, volver a publicar las plantillas (`docs/resend-plantillas.md`) y revisar los `RESEND_TEMPLATE_*`.
- [ ] Administrador principal como **Admin**; contratista con acceso mínimo o ninguno.

**GitHub `GreenAllianceCoo/PagGreenAlliance`**

- [ ] Confirmar que la organización `GreenAllianceCoo` tiene como dueño el correo institucional de la cooperativa (si es una cuenta personal, convertirla en organización o transferir el repositorio).
- [ ] Administrador principal como **Owner**; contratista como colaborador con permiso de escritura durante la garantía.
- [ ] Revisar que la integración de Vercel con GitHub siga desplegando `main` después de las transferencias.

**Plataforma**

- [ ] El administrador principal tiene rol `admin` y ha ingresado al menos una vez a `/admin`.
- [ ] Quitar el rol `admin` a cuentas de prueba o del contratista que no deban quedar.

**Cierre de accesos**

- [ ] Quitar accesos que no sean necesarios (incluido cualquier acceso de Carlos Pardo).
- [ ] Rotar los secretos que el contratista conocía y que no deban seguir igual: `SUPABASE_SERVICE_ROLE_KEY` (rotación de llaves en Supabase), `RESEND_API_KEY`, `CRON_SECRET`. Rotar `INGRESO_COOKIE_SECRET` y `LIMITE_HMAC_SECRET` solo reinicia sesiones a medio ingresar y contadores; no borra datos.
- [ ] Al terminar la garantía de 90 días, retirar los accesos restantes del contratista, salvo que se contrate mantenimiento (cláusula décima octava).

---

## CONSTANCIA DE ENTREGA

EL CONTRATISTA declara que, al momento de la entrega final, proporcionará a LA COOPERATIVA los accesos, credenciales y elementos necesarios para ejercer el control de sus activos tecnológicos, de conformidad con el contrato.

## FIRMA DE LAS PARTES

En constancia, se firma en ____________________, a los ____ días del mes de __________________ de 2026.

| LA COOPERATIVA | EL CONTRATISTA |
|---|---|
| COOPERATIVA GREEN ALLIANCE | SEBASTIÁN SANDOVAL |
| NIT. 902.103.335-7 | C.C. No. 1.052.380.429 |
| Representante Legal: RICARDO VARÓN PENAGOS | Domicilio: Carrera 24 # 10-30, Bucaramanga |
| C.C. 1.124.998.852 de Cumaribo, Vichada | Correo: sebas.sandovalh@gmail.com / Tel.: 321 207 2537 |
| Firma: ______________________________ | Firma: ______________________________ |
