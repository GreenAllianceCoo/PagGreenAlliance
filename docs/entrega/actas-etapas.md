# Actas de entrega y aceptación por etapa

Contrato Nº 001-2026 · Cláusulas séptima (forma de pago), octava (criterios de aceptación) y trigésima primera (actas de entrega).

Hay un acta por cada pago que depende de una aceptación. El anticipo de **$500.000** (cláusula séptima, numeral i) se paga al inicio y no requiere acta.

| Acta | Etapa | Pago | Fases del Anexo Técnico |
|---|---|---|---|
| E-1 | Login y flujo de solicitud de crédito | $800.000 | 2 y 3 |
| E-2 | Panel administrativo | $800.000 | 4 |
| E-3 | Entrega integral y aceptación final | $900.000 | 5 y 6 → se usa `acta-entrega-final.md` |

Si las actas E-1 y E-2 se firman tarde o el mismo día que la entrega final, se dejan igual: cada pago queda sujeto a su propia aceptación.

Criterio común (cláusula octava): la etapa se acepta si las funcionalidades están implementadas, operan, fueron probadas, cumplen lo especificado y se atendieron las observaciones razonables. Una falla crítica que impida usar la funcionalidad se corrige antes de aceptar.

---

## ACTA E-1 · Login y flujo de solicitud de crédito

| | |
|---|---|
| Contrato | Nº 001-2026 |
| Fecha | ______ de __________________ de 2026 |
| Lugar | ________________________________ |
| Etapa | Fases 2 (landing y autenticación) y 3 (flujo de solicitud de crédito) |
| Pago asociado | $800.000 COP (cláusula séptima, numeral ii) |
| Ambiente probado | ☐ Producción (https://www.greenallianceco.com) ☐ Otro: __________ |

**Funcionalidades revisadas**

| ✓ | Funcionalidad | Prueba realizada | Resultado |
|:-:|---|---|---|
| ☐ | Landing (misión, visión, servicios, contacto) | Abrir `/` en computador y celular | |
| ☐ | Registro / afiliación | Enviar una afiliación de prueba en `/afiliacion` | |
| ☐ | Inicio de sesión con cédula y código | Ingresar con un asociado de prueba | |
| ☐ | Recuperación de acceso (reenviar código, cambiar cédula) | Pedir un código nuevo en `/ingresar/codigo` | |
| ☐ | Recuperación de acceso sin el correo | Enviar una solicitud en `/ingresar/recuperar` y cambiar el correo desde `/admin/alertas` (requiere la migración `20261002500000` aplicada) | |
| ☐ | Solicitud de crédito al 50 % o 100 % | Solicitar en `/cuenta/solicitar` | |
| ☐ | Monto según los topes del grado | Intentar un monto mayor al cupo; debe rechazarse | |
| ☐ | Registro de la solicitud | La solicitud aparece en `/cuenta` y en `/admin/creditos` | |
| ☐ | Notificación por correo | Aprobar o rechazar y revisar el correo recibido | |
| ☐ | Consulta de estado | El asociado ve el estado actualizado en `/cuenta` | |

**Observaciones**

_____________________________________________________________________________

_____________________________________________________________________________

**Decisión:** ☐ Aceptada ☐ Aceptada con observaciones (plazo: ___/___/2026) ☐ No aceptada

| LA COOPERATIVA | EL CONTRATISTA |
|---|---|
| RICARDO VARÓN PENAGOS, Representante Legal | SEBASTIÁN SANDOVAL |
| C.C. 1.124.998.852 | C.C. ____________________ |
| Firma: ______________________ | Firma: ______________________ |

---

## ACTA E-2 · Panel administrativo

| | |
|---|---|
| Contrato | Nº 001-2026 |
| Fecha | ______ de __________________ de 2026 |
| Lugar | ________________________________ |
| Etapa | Fase 4 (panel de administración) |
| Pago asociado | $800.000 COP (cláusula séptima, numeral iii) |
| Usuario autorizado que probó | ________________________________ |

**Funcionalidades revisadas**

| ✓ | Funcionalidad | Prueba realizada | Resultado |
|:-:|---|---|---|
| ☐ | Acceso solo para administradores | Entrar a `/admin` con un asociado: debe redirigir | |
| ☐ | Tablero con indicadores | Abrir `/admin` | |
| ☐ | Listado y consulta de afiliaciones | `/admin/afiliaciones`: abrir el detalle con fotos | |
| ☐ | Aprobación o rechazo de afiliaciones | Aprobar una afiliación de prueba; se crea la cuenta y llega el correo | |
| ☐ | Listado y consulta de asociados | `/admin/asociados`: buscar y abrir un asociado | |
| ☐ | Listado y consulta de solicitudes de crédito | `/admin/creditos` | |
| ☐ | Aprobación o rechazo de créditos con notificación | Aprobar y rechazar una solicitud de prueba; revisar los correos | |
| ☐ | Historial de las decisiones | Ver quién y cuándo decidió en el detalle | |

**Observaciones**

_____________________________________________________________________________

_____________________________________________________________________________

**Decisión:** ☐ Aceptada ☐ Aceptada con observaciones (plazo: ___/___/2026) ☐ No aceptada

| LA COOPERATIVA | EL CONTRATISTA |
|---|---|
| RICARDO VARÓN PENAGOS, Representante Legal | SEBASTIÁN SANDOVAL |
| C.C. 1.124.998.852 | C.C. ____________________ |
| Firma: ______________________ | Firma: ______________________ |

---

## ACTA E-3 · Entrega integral

Se usa `docs/entrega/acta-entrega-final.md`, que incluye las fases 5 y 6, los entregables de la cláusula novena, la constancia de capacitación y el inicio de la garantía de 90 días. Pago asociado: $900.000 COP (cláusula séptima, numeral iv).

---

## Control de pagos

| Pago | Valor | Acta | Fecha de aceptación | Fecha de pago |
|---|---|---|---|---|
| Anticipo | $500.000 | No aplica | No aplica | ___/___/2026 |
| Pago 2 | $800.000 | E-1 | ___/___/2026 | ___/___/2026 |
| Pago 3 | $800.000 | E-2 | ___/___/2026 | ___/___/2026 |
| Pago final | $900.000 | E-3 (acta final) | ___/___/2026 | ___/___/2026 |
| **Total** | **$3.000.000** | | | |
