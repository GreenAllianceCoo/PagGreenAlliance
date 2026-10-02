# ANEXO No. 3 · Trabajo adicional realizado

Contrato de prestación de servicios Nº 001-2026 entre COOPERATIVA GREEN ALLIANCE (NIT 902.103.335-7) y SEBASTIÁN SANDOVAL.

## Objeto del anexo

Durante la ejecución del contrato, LA COOPERATIVA pidió funcionalidades que van más allá del alcance de la cláusula tercera y del Anexo Técnico No. 1, y EL CONTRATISTA las desarrolló. Este anexo deja constancia de ese **trabajo adicional realizado**. Todas las funcionalidades están construidas, en funcionamiento y en el repositorio del proyecto.

Este anexo no cambia el valor del contrato (cláusula sexta), su forma de pago (cláusula séptima) ni su plazo (cláusula quinta). Desde la aceptación final, estas funcionalidades quedan cubiertas por la garantía de la cláusula décima séptima, igual que el resto de la plataforma. Cualquier cambio futuro sobre ellas se rige por la cláusula décima novena.

**Lo que no aparece en esta lista** porque hace parte del alcance contratado: página pública, registro (afiliación), inicio de sesión, recuperación de acceso, solicitud de crédito al 50 % o 100 % con topes por grado, registro de solicitudes, notificaciones por correo, actualización de estados, panel administrativo, aprobación o rechazo, sección de convenios, diseño adaptable, base de datos, pruebas, capacitación básica y puesta en producción.

## Trabajo adicional

### A. Asesores comerciales

| Nº | Funcionalidad | Descripción |
|---|---|---|
| A-1 | Rol de asesor y portal `/asesor` | Nuevo tipo de usuario con su propio panel; el asesor se elige en la afiliación y los asociados quedan asignados a él. Datos protegidos: cédula enmascarada, sin contacto, nómina ni fotos |
| A-2 | Comisiones con corte el día 15 | Registro de pagos por concepto (ingreso nuevo, embargo operativo, bonos, ajustes), periodos que cierran el 15, edición y anulación con motivo y bitácora inmutable |
| A-3 | Premios de asesores | Bono de $1.000.000 al primer asesor que llegue a 50 asociados y viaje a San Andrés al primero que llegue a 100; registro del ganador y de las consultas |
| A-4 | Tableros de métricas del asesor | Resumen de clientes, cifras y búsqueda de clientes |
| A-5 | Administrador que también atiende asociados | Un administrador puede tener clientes como un asesor |

### B. Gestión de asociados y crédito

| Nº | Funcionalidad | Descripción |
|---|---|---|
| B-1 | Proceso ejecutivo con 8 estados e historial | Reparto, Admitido, Notificación, Sentencia, Liquidación, Entrega de títulos, Operando y Terminado; fecha de inicio del embargo; el crédito solo se habilita en «Operando»; historial de cada cambio |
| B-2 | Alertas de retiro anticipado y renovación | El asociado las genera desde `/cuenta`; el administrador las ve y las marca como atendidas; aviso por correo a los administradores |
| B-3 | Habilitar crédito tras un rechazo | El administrador vuelve a habilitar la solicitud de un asociado rechazado, con motivo interno e historial, y aviso por correo al asociado |
| B-4 | Desembolso de créditos | Marcar el crédito como desembolsado con fecha y responsable, con correo al asociado |
| B-5 | Baja y reactivación de asociados | Con motivo obligatorio e historial; la cuenta inactiva no puede ingresar |
| B-6 | Tasa de interés oculta al asociado | La tasa se guarda y la ve solo el administrador |
| B-7 | Historial y notas internas | Historial de cada afiliación y crédito con notas internas del administrador |
| B-8 | Tablero del administrador con métricas | Indicadores de afiliaciones, asociados, créditos, desembolsos, sorteo y proceso ejecutivo; búsqueda de solicitudes por nombre o cédula |

### C. Afiliación

| Nº | Funcionalidad | Descripción |
|---|---|---|
| C-1 | Fotos del documento y selfie | Carga de cédula (frente y reverso) y selfie con revisión de calidad, compresión, almacenamiento privado y limpieza automática cada hora de las fotos huérfanas |
| C-2 | Catálogo de grados de Policía y Ejército | Institución y grado según catálogo, enlazado a los grupos de cupo; nuevos grupos de crédito |
| C-3 | Datos de nómina | Entidad, tipo y número de cuenta de nómina en la afiliación y el perfil |
| C-4 | Correo institucional con aviso | Correo institucional validado por dominio (Policía o Ejército) que solo recibe avisos sin datos personales |

### D. Beneficios para el asociado

| Nº | Funcionalidad | Descripción |
|---|---|---|
| D-1 | Sorteo mensual | Inscripción del asociado con boleta oculta y confirmación por correo, lista de inscritos y realización del sorteo con ganador registrado |
| D-2 | Carné virtual con QR | Carné «Afiliado Titular» en `/cuenta/carne` con QR que se puede regenerar |
| D-3 | Verificación pública del carné | Página `/verificar/<código>` que confirma el carné sin mostrar datos sensibles |
| D-4 | Carné en PDF | Descarga del carné en PDF con el QR |

### E. Convenios y contenido

| Nº | Funcionalidad | Descripción |
|---|---|---|
| E-1 | Convenios administrables | Crear, editar, ordenar y ocultar convenios desde `/admin/convenios`, con logo, servicios, sedes, video y PDF descargable (el alcance prevé una sección de convenios; la administración desde el panel es adicional) |
| E-2 | Página de política de datos | `/politica-de-datos` con la política de la cooperativa y registro de la versión que aceptó cada afiliado |
| E-3 | Modo demostración | `/admin/demo` y `/asesor/demo`: cuenta de ejemplo para mostrar la plataforma sin usar datos reales |


## Firmas

En constancia, se firma en ____________________, a los ____ días del mes de __________________ de 2026.

| LA COOPERATIVA | EL CONTRATISTA |
|---|---|
| COOPERATIVA GREEN ALLIANCE | SEBASTIÁN SANDOVAL |
| NIT. 902.103.335-7 | C.C. No. 1.052.380.429 |
| Representante Legal: RICARDO VARÓN PENAGOS | |
| C.C. 1.124.998.852 de Cumaribo, Vichada | |
| Firma: ______________________________ | Firma: ______________________________ |

---

## Texto sugerido para incorporar el anexo al contrato

Reemplazar la cláusula trigésima séptima por:

> **CLÁUSULA TRIGÉSIMA SÉPTIMA. DOCUMENTOS INTEGRANTES Y PREVALENCIA.** Integran el contrato: Anexo Técnico No. 1 – Alcance, cronograma y criterios de aceptación; Anexo No. 2 – Inventario de cuentas, servicios y accesos; Anexo No. 3 – Trabajo adicional realizado; y la propuesta de desarrollo de 31 de agosto de 2026. En caso de contradicción prevalecerá este contrato.

Y agregar, después de la cláusula décima novena:

> **PARÁGRAFO.** LAS PARTES dejan constancia de que, durante la ejecución, EL CONTRATISTA desarrolló a solicitud de LA COOPERATIVA las funcionalidades adicionales descritas en el Anexo No. 3 – Trabajo adicional realizado, las cuales hacen parte de la plataforma entregada.
