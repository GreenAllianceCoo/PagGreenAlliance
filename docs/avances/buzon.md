# Buzón del supervisor de avances

Cada agente `ga-*` agrega aquí un reporte al terminar una tarea importante. `ga-supervisor-avances` los pasa a `plan.json`, regenera `Avances_Green_Alliance.xlsx` y vacía este buzón (lo procesado queda en la hoja Bitácora).

Formato (copiar debajo de la línea, uno por tarea):

```
## AAAA-MM-DD · nombre-del-agente
- Actividades: 2.5, 2.6            (IDs de la hoja Plan; P-xx si es un pendiente suelto)
- Estado: Hecho | En curso | Bloqueado
- Qué se hizo: una o dos frases.
- Bloqueos o trabajo nuevo: qué falta, de quién, o «ninguno».
```

---


## 2026-10-01 · ga-revisor-seguridad
- Actividades: P-xx (revisión de seguridad de premios de asesores, QR del carné, inscritos al sorteo y pagos de comisión)
- Estado: Hecho
- Qué se hizo: Revisé las migraciones 20261002100000/200000/300000, /cuenta/carne, /verificar/[token], app/asesor, app/admin/asesores y app/admin/sorteo. No hay hallazgos críticos ni altos; quedan 2 medios/bajos (QR de dados de baja sigue mostrando el nombre; regenerar sin límite) y una nota funcional sobre el tope de clics.
- Bloqueos o trabajo nuevo: ga-auditor-supabase: decidir si verificar_carne oculta a los inactivos y si el tope de clics pasa a ser por meta. La cooperativa debe confirmar si el nombre completo puede verse públicamente. Sebas: SITIO_URL en Vercel y db push de las 4 migraciones.

## 2026-10-01 · ga-verificador-qa
- Actividades: P-xx (e2e final: premios de asesores, carné con QR, inscritos al sorteo)
- Estado: Hecho
- Qué se hizo: Corrida e2e completa en local con db reset antes de cada proyecto. Escritorio: 188 pasan, 0 fallan, 3 omitidas. Celular: 148 pasan, 0 fallan, 43 omitidas. Nuevo tests/e2e/m-premios-qr-sorteo.spec.ts con premios y clic registrado, /cuenta/carne con QR, /verificar válido, inválido y regenerado, e inscritos al sorteo en el admin. Sin bugs reales.
- Bloqueos o trabajo nuevo: dos detalles menores para ga-funcionalidad-botones: en /admin/sorteo el grado sale como código y no como nombre, y la cédula usa un enmascarado distinto al del resto de la app. Sebas debe aplicar las migraciones 20261002000000 a 20261002300000 con db push --linked y configurar SITIO_URL en producción para que el QR apunte al dominio real.

## 2026-10-01 · ga-funcionalidad-botones
- Actividades: P-xx (ajustes de entrega: seguridad S-01/S-02, tope de toques en Premios, limpieza de pendientes)
- Estado: Hecho
- Qué se hizo: migración 20261002400000_ajustes_entrega.sql (sin aplicar) con tope de toques por meta, aperturas y toques separados en admin, verificar_carne solo para activos, regenerar con tope de 1/min y grado con nombre en inscritos; pgTAP 26; tarjeta de inscritos enlaza a /admin/sorteo; limpieza de datos de ejemplo y TODOs viejos.
- Bloqueos o trabajo nuevo: Sebas debe aplicar la migración nueva (db push --linked) junto con las 4 anteriores.

## 2026-10-01 · ga-funcionalidad-botones
- Actividades: P-xx (carné: botón «Descargar PDF»; sin ID en plan.json)
- Estado: Hecho
- Qué se hizo: «Descargar PDF» en /cuenta/carne; route handler /cuenta/carne/pdf (sesión, solo el propio asociado, inactivo 403, attachment, no-store) con pdf-lib + qrcode (mismo token); vitest (4) y e2e M2 en escritorio y celular. tsc, lint, vitest (599) y build OK.
- Bloqueos o trabajo nuevo: ninguno. Dependencia nueva: pdf-lib. Diseño del PDF sin revisión visual de ga-diseno-a-codigo.

## 2026-10-01 · agente de documentos de entrega
- Actividades: P-xx (documentos de entrega final, cláusulas 9, 10, 16, 19 y 31 del contrato 001-2026); P-xx (recuperación de acceso, fase 2 del Anexo Técnico)
- Estado: En curso
- Qué se hizo: docs/entrega/ con documentacion-tecnica.md (arquitectura, roles, modelo de datos, seguridad, recuperación de acceso, variables, cron, despliegue, reversibilidad), respaldo-y-restauracion.md, anexo-2-cuentas-y-accesos.md (prellenado + lista de transferencia), acta-entrega-final.md, actas-etapas.md y anexo-3-trabajo-adicional.md; script scripts/respaldo.sh (dump con fecha, opción --con-storage, se niega a guardar dentro del repo).
- Bloqueos o trabajo nuevo: Sebas: datos personales del contrato, registrador y titulares de dominio/Vercel/Supabase/Resend, plan de Supabase, administrador principal, ubicaciones de respaldo, cifrar y entregar el respaldo del 30-sep. Falta redactar el manual de administración. La recuperación de acceso cuando el asociado pierde su correo no tiene pantalla (observación O-1 del acta): decidir si se construye un cambio de correo asistido en /admin.

## 2026-10-02 · ga-funcionalidad-botones
- Actividades: P-xx (recuperación de acceso, fase 2 del Anexo Técnico; observación O-1 del acta de entrega)
- Estado: En curso
- Qué se hizo: /ingresar/recuperar (público, respuesta única anti-enumeración, honeypot, límites por IP y cédula con HMAC), tabla de solicitudes con RLS e historial de cambios de correo (migración 20261002500000, sin aplicar), sección «Recuperación de acceso» en /admin/alertas y «Correo de ingreso» en la ficha del asociado con «Cambiar correo de ingreso» y «Rechazar» (motivo obligatorio, auth.admin.updateUserById, avisos al correo anterior y al nuevo), y «Cambiar correo de ingreso» en /cuenta/perfil con código al correo nuevo (updateUser + verifyOtp email_change). pgTAP 27 (23 pruebas; todas las pruebas de base OK), vitest 631 OK, tsc, lint y build OK. e2e n-recuperacion.spec.ts escrita pero NO corrida: Docker Desktop quedó en pausa manual.
- Bloqueos o trabajo nuevo: Sebas debe reanudar Docker Desktop para correr la e2e (escritorio y celular) y verificar el flujo de updateUser/verifyOtp contra GoTrue local. Antes de aplicar en producción: desactivar «Secure email change» y pegar la plantilla supabase/templates/cambio-correo.html en «Change Email Address». Pedido de diseño D-27.

## 2026-10-01 · ga-revisor-seguridad
- Actividades: P-xx (revisión de seguridad de la recuperación de acceso, migración 20261002500000)
- Estado: Hecho
- Qué se hizo: Revisión de /ingresar/recuperar, la acción admin «Cambiar correo de ingreso», el cambio de correo propio y la migración. La anti-enumeración, los límites, RLS y server-only están bien. Hay 2 hallazgos altos de toma de cuenta: el botón de WhatsApp apunta al celular que escribió el solicitante, y con «Secure email change» apagado se puede cambiar el correo por la API de GoTrue sin historial ni aviso.
- Bloqueos o trabajo nuevo: ga-funcionalidad-botones corrige SEC-REC-01, 03, 04 y 05. Sebas decide sobre SEC-REC-02 (no apagar «Secure email change» o compensarlo) antes de aplicar en producción.

## 2026-10-01 · ga-funcionalidad-botones
- Actividades: P-xx (correcciones de seguridad SEC-REC-01 a 05 de la recuperación de acceso)
- Estado: En curso
- Qué se hizo: WhatsApp al celular del perfil con confirmación aparte si no coincide; validación (solicitud pendiente, asesor 24 h) antes de tocar Auth; cierre de sesiones tras el cambio; cambio propio solo para asociados con ingreso reciente; trigger en auth.users y aviso nativo como compensación de SEC-REC-02. Todo en la migración 20261002500000 (sin aplicar). tsc, lint, vitest (636) y build en verde.
- Bloqueos o trabajo nuevo: Docker Desktop está en pausa manual: faltan db reset, test db y las e2e n-recuperacion y b-ingreso. Sebas decide sobre «Secure email change» antes de producción.

## 2026-10-01 · ga-escritor-tests
- Actividades: P-xx (ajuste de pruebas por reglas aprobadas por Sebas: admin sin restricción sobre sus clientes y PP no seleccionable)
- Estado: Hecho
- Qué se hizo: pgTAP 01–27 y seed pasan de PP a PT; 03 usa cupos de PT (1,3 M/2,7 M); 12 queda en 16 seleccionables sin PP y con pruebas de PP no seleccionable y afiliación con PP rechazada; 17 y 18 ahora comprueban que el admin SÍ registra/corrige/anula sus pagos, mueve el proceso de sus clientes y se asigna clientes (siguen prohibidos su propio proceso y el asesor). vitest y e2e actualizados (PT, cupos 2,7 M). Resultados: supabase test db PASS, vitest 628/628, tsc limpio, e2e afectadas 151 pasan (1 omitida) en escritorio y celular.
- Bloqueos o trabajo nuevo: ninguno

## 2026-10-02 · ga-correos
- Actividades: trabajo nuevo sin ID (correo de la boleta sin diseño; plan de correos Resend; mensajes de WhatsApp Business)
- Estado: Hecho
- Qué se hizo: Diagnóstico del correo del sorteo (la app cae al texto plano si falta RESEND_TEMPLATE_SORTEO_BOLETA, si la plantilla no está publicada o si el alias/variables no coinciden), respaldo de texto mejorado y asunto con el mes, diagnóstico en docs/resend-plantillas.md; nuevos docs/entrega/plan-correos-resend.md y docs/entrega/whatsapp-business-mensajes.md.
- Bloqueos o trabajo nuevo: Sebas debe revisar Vercel y el panel de Resend (alias ga-sorteo-boleta publicado; variables NOMBRE, NUMERO_BOLETA, MES) y verificar el precio del plan Pro.

## 2026-10-02 · ga-diseno-a-codigo
- Actividades: P-xx (pedido de Sebas: /cuenta igual a la demo del admin/asesor)
- Estado: Hecho
- Qué se hizo: se extrajeron `components/cuenta/CamposSolicitud.tsx` y `TarjetaTope.tsx`, ahora usados por /cuenta, /cuenta/solicitar y `CuentaDemo` (misma tarjeta de tope, mismos campos de solicitud, carné, radios 28 y tipografía display); `Cuenta` recibe el slot `accionDesembolso` para «Ver comprobante». tsc, lint, build y e2e (c, e, h, l, m) en verde.
- Bloqueos o trabajo nuevo: ninguno; falta que el otro agente pase `<ComprobanteDesembolso/>` en `accionDesembolso`.

## 2026-10-02 · ga-funcionalidad-botones
- Actividades: P-xx (pedidos de Sebas, reunión 1-oct: comprobante de desembolso y «Eliminar definitivamente» = anonimizar a un asociado)
- Estado: Hecho
- Qué se hizo: bucket privado `comprobantes-desembolso` con subida directa por URL firmada (al marcar desembolsado y después, subir/reemplazar con historial), componente `components/cuenta/ComprobanteDesembolso.tsx` para el asociado (aún sin conectar a /cuenta) y «Eliminar definitivamente» en la ficha del asociado (anonimiza, código de 6 dígitos al correo del admin, 10 min y 3 intentos, log inmutable, borra Storage y Auth). Migración 20261003000000 (SIN aplicar en producción), pgTAP 28 (68 pruebas), vitest +70, e2e o-desembolso-eliminacion (escritorio y celular).
- Bloqueos o trabajo nuevo: la sesión principal debe pasar `<ComprobanteDesembolso/>` al slot `accionDesembolso` de /cuenta (con `id` y `comprobante_subido_at` en el select); Sebas debe aplicar la migración (quita la FK perfiles.id → auth.users, conserva la cascada con un trigger) y decidir si los comprobantes se borran al eliminar; pedido de diseño D-28.

## 2026-10-02 · ga-funcionalidad-botones
- Actividades: P-xx (pedidos de Sebas, reunión 1-oct: rol «secretario» y búsqueda general para asesores)
- Estado: Hecho
- Qué se hizo: rol `secretario` (ve el Resumen y ve/edita afiliaciones: contactado, aprobar, rechazar, asignar asesor por la función `secretario_asignar_asesor`; nada más, sin es_admin; menú reducido y rutas/acciones solo-admin lo devuelven a /admin; historial de cambios de estado de afiliación y de cambios de rol; el admin lo crea desde «Registrar secretario» en /admin/asesores; entra por /admin al ingresar). Búsqueda general en /asesor (`buscar_asociados_general`: nombre, cédula enmascarada y asesor; mínimo 4 caracteres, máx. 10, solo quien atiende; 20 búsquedas por minuto). Migración 20261003100000 (SIN aplicar en producción), pgTAP 29 (44 pruebas) y listas blancas 00 y 15, vitest +15, e2e p-secretario-busqueda (escritorio y celular), seed con secretario 1234567896, manual con sección 14 «Rol de secretario» y la búsqueda en «Qué hace el asesor». Además se corrigió que el formulario «Registrar asesor» no enviaba los campos (faltaba `name`).
- Bloqueos o trabajo nuevo: Sebas debe aplicar la migración; decidir si el secretario debe ver Asociados/Créditos en solo lectura (hoy no, por mezclar acciones y datos sensibles); falta regenerar el PDF del manual.

## 2026-10-02 · ga-funcionalidad-botones
- Actividades: P-xx (pedido de Sebas: foto del asociado en el carné virtual)
- Estado: Hecho
- Qué se hizo: el carné usa por defecto la selfie de la afiliación y el asociado puede cambiarla en /cuenta/carne («Cambiar foto» con recorte cuadrado y subida por URL firmada, «Usar mi selfie de afiliación»); bucket privado `fotos-carne` (una por asociado, la anterior se borra, log de cambios, tope de 5 por hora). Se ve en /cuenta, /cuenta/carne, el PDF, /verificar/[token] (solo carné válido y asociado activo) y la ficha del admin; el asesor no la ve; eliminar definitivamente borra también la foto. Migración 20261003200000 (SIN aplicar en producción), pgTAP 30 (33 pruebas), vitest +17, e2e q-foto-carne (escritorio y celular).
- Bloqueos o trabajo nuevo: Sebas debe aplicar la migración; pedido de diseño D-29 (pieza de la foto y de la tarjeta de cambio); decidir si sin foto el carné lleva una silueta.
