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
