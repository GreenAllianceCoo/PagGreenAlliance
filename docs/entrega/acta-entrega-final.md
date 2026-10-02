# ACTA DE ENTREGA Y ACEPTACIÓN FINAL

**Contrato de prestación de servicios de desarrollo, implementación, puesta en funcionamiento y mantenimiento de plataforma tecnológica Nº 001-2026**

Cláusulas novena (entrega final), trigésima primera (actas de entrega), séptima numeral (iv) (pago final) y Anexo Técnico Nº 1, fase 6 y §3.

| | |
|---|---|
| Fecha | ______ de __________________ de 2026 |
| Lugar | ________________________________ |
| LA COOPERATIVA | COOPERATIVA GREEN ALLIANCE, NIT 902.103.335-7, representada por RICARDO VARÓN PENAGOS, C.C. 1.124.998.852 de Cumaribo, Vichada |
| EL CONTRATISTA | SEBASTIÁN SANDOVAL, C.C. ____________________ |
| Supervisor designado por la cooperativa (cláusula trigésima) | ________________________________ |
| Etapa | Entrega integral: pruebas, documentación, accesos, código y aceptación final (fase 6) |
| Plataforma | https://www.greenallianceco.com |
| Versión entregada | Rama `main` del repositorio, commit `__________` del ___/___/2026 |

---

## 1. Entregables obligatorios (cláusula novena y Anexo Técnico §3)

Marcar cada casilla al verificarlo en la reunión de entrega.

| ✓ | Entregable | Dónde está / cómo se verifica |
|:-:|---|---|
| ☐ | Plataforma operativa | https://www.greenallianceco.com, desplegada en Vercel desde `main` |
| ☐ | Código fuente del desarrollo contratado | Repositorio, carpetas `app/`, `components/`, `lib/`, `proxy.ts` |
| ☐ | Repositorio | https://github.com/GreenAllianceCoo/PagGreenAlliance, con historial completo, bajo control de la cooperativa |
| ☐ | Estructura de la base de datos | `supabase/migrations/` (56 migraciones en orden) y `documentacion-tecnica.md` §3 |
| ☐ | Datos de la base de datos | Respaldo completo cifrado (`scripts/respaldo.sh --con-storage`), entregado en las ubicaciones de la cooperativa. Fecha del respaldo: ___/___/2026 |
| ☐ | Documentación técnica básica | `docs/entrega/documentacion-tecnica.md` y `README.md` |
| ☐ | Manual o instrucciones de administración | `docs/entrega/manual-administracion.md` |
| ☐ | Credenciales y accesos administrativos | Entregados según `docs/entrega/anexo-2-cuentas-y-accesos.md` §4, por el gestor de contraseñas o en persona |
| ☐ | Información de dominio, hosting y servicios de terceros | `docs/entrega/anexo-2-cuentas-y-accesos.md` §1 y §2 |
| ☐ | Dominio y cuentas de infraestructura bajo control de la cooperativa | Lista de transferencia del Anexo 2, §5, completa |
| ☐ | Configuraciones necesarias | Variables de entorno en Vercel (nombres en `documentacion-tecnica.md` §5 y `.env.example`), `vercel.json`, `supabase/config.toml`, plantillas de correo de Supabase Auth (`supabase/templates/`), plantillas de Resend (`docs/resend-plantillas.md`) |
| ☐ | Mecanismo de respaldo y restauración | `docs/entrega/respaldo-y-restauracion.md` y `scripts/respaldo.sh` |
| ☐ | Pruebas | Unitarias (`tests/unit/`, Vitest), base de datos (`supabase/tests/`, 28 archivos pgTAP) y punta a punta (`tests/e2e/`, Playwright en escritorio y celular). Informes en `docs/verificaciones/` |
| ☐ | Capacitación básica al personal designado | `docs/entrega/constancia-capacitacion.md` firmada, y resumen en la sección 4 de esta acta |
| ☐ | Acta de entrega | Este documento |

---

## 2. Funcionalidades entregadas por fase (Anexo Técnico §1)

Las funcionalidades fuera del alcance de la cláusula tercera están en `anexo-3-trabajo-adicional.md` y no se repiten aquí.

### Fase 1 · Diseño y arquitectura

| ✓ | Funcionalidad | Dónde se verifica |
|:-:|---|---|
| ☐ | Diseños de las pantallas (computador y celular) | `design/`, `docs/Green Alliance C+.dc.html` |
| ☐ | Arquitectura y definición tecnológica | `documentacion-tecnica.md` §1 |
| ☐ | Modelo de datos | `documentacion-tecnica.md` §3, `supabase/migrations/` |

### Fase 2 · Landing y autenticación

| ✓ | Funcionalidad | Dónde se verifica |
|:-:|---|---|
| ☐ | Landing con misión, visión, servicios y contacto | `/` |
| ☐ | Registro (afiliación) | `/afiliacion`; la cuenta se crea cuando el admin aprueba la afiliación |
| ☐ | Inicio de sesión con cédula y código de un solo uso al correo | `/ingresar` → `/ingresar/codigo` |
| ☐ | Recuperación de acceso: no hay contraseñas; se pide un código nuevo («Reenviar código» a los 45 s, «Cambiar cédula») | `/ingresar/codigo` |
| ☐ | Recuperación de acceso sin el correo: solicitud «¿Ya no tienes acceso a tu correo?», verificación por la cooperativa y «Cambiar correo de ingreso» por un administrador; cambio del correo por el propio asociado con código al correo nuevo | `/ingresar/recuperar`, `/admin/alertas`, ficha del asociado y `/cuenta/perfil`. Ver observación O-1 |
| ☐ | Autenticación funcional con roles (asociado, asesor, administrador) | `/cuenta`, `/asesor`, `/admin` |

### Fase 3 · Flujo de solicitud de crédito

| ✓ | Funcionalidad | Dónde se verifica |
|:-:|---|---|
| ☐ | Selección de devolución del 50 % o 100 % | `/cuenta/solicitar` |
| ☐ | Monto según los topes del grado definidos por la cooperativa | Tabla `grados_credito`; trigger `validar_monto_solicitud` |
| ☐ | Validaciones y registro de la solicitud | `/cuenta/solicitar`; tabla `solicitudes_credito` |
| ☐ | Notificación por correo (aprobado, rechazado) | Resend; `docs/resend-plantillas.md` |
| ☐ | Consulta de estado por el asociado | `/cuenta` |

### Fase 4 · Panel de administración

| ✓ | Funcionalidad | Dónde se verifica |
|:-:|---|---|
| ☐ | Panel con indicadores | `/admin` |
| ☐ | Listado y consulta de solicitudes de crédito | `/admin/creditos` |
| ☐ | Listado y consulta de asociados y afiliaciones | `/admin/asociados`, `/admin/afiliaciones` |
| ☐ | Aprobación o rechazo con notificación al asociado | `/admin/creditos`, `/admin/afiliaciones` |
| ☐ | Acceso solo para usuarios autorizados | Rol `admin`; Row Level Security |

### Fase 5 · Convenios y pulido

| ✓ | Funcionalidad | Dónde se verifica |
|:-:|---|---|
| ☐ | Sección de convenios | `/` (sección convenios) y `/cuenta` |
| ☐ | Funcionamiento en computador, tablet y celular | Pruebas Playwright en 1280 px y 390 px; revisión en equipos reales |

### Fase 6 · Pruebas y lanzamiento

| ✓ | Funcionalidad | Dónde se verifica |
|:-:|---|---|
| ☐ | Plataforma en producción | https://www.greenallianceco.com |
| ☐ | Pruebas sin errores críticos | `docs/verificaciones/` (última: `2026-10-01-qa-e2e.md`) |
| ☐ | Capacitación, documentación, accesos y código | Secciones 1 y 4 de esta acta |

---

## 3. Observaciones

Observaciones conocidas al redactar el acta (borrar o marcar las que se resuelvan antes de firmar):

| Nº | Observación | Responsable | Estado |
|---|---|---|---|
| O-1 | **Recuperación de acceso sin el correo personal:** construida en el repositorio (`documentacion-tecnica.md` §4.1, manual §6). Para que funcione en producción falta aplicar la migración `20261002500000_recuperacion_acceso`, publicar el código, dejar activo *Secure email change* en Supabase y probarla de punta a punta. LA COOPERATIVA define cómo verifica la identidad antes de cambiar un correo. | Contratista / cooperativa | ☐ |
| O-2 | Revisar con la cooperativa el manual de administración (`docs/entrega/manual-administracion.md`) después de la capacitación. | Ambas partes | ☐ |
| O-3 | Cambiar datos de ejemplo por reales (cifras, fotos, textos de `lib/config.ts`). Depende de la información que entregue la cooperativa. | Cooperativa / contratista | ☐ |
| O-4 | Pruebas con usuarios reales y en celulares Android e iPhone (cámara para las fotos, ingreso con código, sorteo, crédito). | Ambas partes | ☐ |
| O-5 | Aplicar en producción las migraciones `20261002*` (convenios administrables, premios, carné QR, sorteo, ajustes y recuperación de acceso) con respaldo previo, y confirmar que no queda ninguna pendiente (`npx supabase migration list --linked`). | Contratista | ☐ |
| O-6 | Transferencia de cuentas a nombre de la cooperativa (Anexo 2, §5). | Ambas partes | ☐ |
| O-7 | Plan de Supabase y respaldos automáticos verificados (`respaldo-y-restauracion.md` §2). | Cooperativa | ☐ |
| | | | |
| | | | |

Observaciones adicionales de LA COOPERATIVA:

_____________________________________________________________________________

_____________________________________________________________________________

_____________________________________________________________________________

---

## 4. Constancia de capacitación

| Fecha | Tema | Asistentes | Duración |
|---|---|---|---|
| | Panel de administración: afiliaciones, asociados, créditos, desembolsos | | |
| | Asesores, comisiones, premios, sorteo, alertas y convenios | | |
| | Respaldo y restauración; cuentas y accesos | | |
| | | | |

---

## 5. Decisión

☐ **ACEPTADA.** LA COOPERATIVA recibe la plataforma y los entregables a satisfacción.

☐ **ACEPTADA CON OBSERVACIONES.** Se acepta; las observaciones de la sección 3 marcadas como pendientes se atenderán a más tardar el ___/___/2026, sin costo cuando correspondan al alcance contratado.

☐ **NO ACEPTADA.** Motivo (falla crítica u observación del alcance sin atender, cláusula octava):

_____________________________________________________________________________

Conforme a la cláusula séptima, la aceptación habilita el pago final de **$900.000 COP**. Ningún pago se entiende como aceptación automática.

---

## 6. Inicio de la garantía

Con la firma de esta acta en la opción «Aceptada» o «Aceptada con observaciones» comienza la **garantía de noventa (90) días calendario** de la cláusula décima séptima:

- Inicio: ___/___/2026
- Fin: ___/___/2026

Durante ese período EL CONTRATISTA corrige sin costo los errores, defectos o fallas atribuibles al desarrollo original y las vulnerabilidades atribuibles al desarrollo (cláusula décima quinta). Las nuevas funcionalidades o cambios sustanciales se cotizan aparte (cláusulas décima séptima y décima novena). Al terminar la garantía, el mantenimiento es opcional, por $500.000 COP mensuales (cláusula décima octava).

Los reportes de errores en garantía se envían por escrito al correo designado por EL CONTRATISTA (cláusula trigésima segunda): ________________________________

---

## 7. Firmas

| LA COOPERATIVA | EL CONTRATISTA |
|---|---|
| COOPERATIVA GREEN ALLIANCE | SEBASTIÁN SANDOVAL |
| NIT. 902.103.335-7 | C.C. No. ____________________ |
| Representante Legal: RICARDO VARÓN PENAGOS | |
| C.C. 1.124.998.852 de Cumaribo, Vichada | |
| Firma: ______________________________ | Firma: ______________________________ |
