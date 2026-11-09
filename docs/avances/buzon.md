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


## 2026-10-30 · sesion-principal
- Actividades: P-nuevo (editar condiciones del crédito)
- Estado: En curso
- Qué se hizo: «Editar condiciones» en /admin/creditos hasta el desembolso: lo que recibe y devuelve, plazo, porcentaje entero de 50 a 100 y tipo cooperativa/convenio, con motivo e historial. Migración 20261030000000 y pgTAP 37 escritos.
- Bloqueos o trabajo nuevo: migración 20261030000000 aplicada en producción el 2026-10-31 (verificado: columnas y RPC existen; anon sin permiso). Falta pgTAP 37 (sin Docker en el equipo), commit y despliegue del código.

## 2026-11-02 · ga-auditor-supabase + ga-funcionalidad-botones
- Actividades: P-xx (crédito creado por el admin, corregir cédula, porcentajes 50–100 de 10 en 10)
- Estado: En curso
- Qué se hizo: migración 20261102000000 (admin_crear_credito aprobado, admin_cambiar_cedula con barrera, porcentajes 50/60/70/80/90/100 interpolados) y pgTAP 38; «Nuevo crédito» por cédula y «Corregir cédula» en /admin; selector de 6 porcentajes en /cuenta/solicitar y la demo.
- Bloqueos o trabajo nuevo: migración 20261102000000 aplicada en producción el 2026-11-02 desde el SQL Editor (verificado: 3 RPC nuevas, columna motivo, trigger con cedula, permisos solo authenticated; interpolación PP 50→100 = 1,0 M→2,1 M y 7,9 %→6,0 %). Falta correr supabase test db con Docker y fusionar el PR.

## 2026-11-02 · ga-funcionalidad-botones
- Actividades: P-xx (tabla interactiva de Créditos, pedido del dueño 2-nov)
- Estado: Hecho
- Qué se hizo: vista «Tabla» en /admin/creditos (?vista=tabla) con búsqueda, orden por columna y primera columna fija; el admin corrige nombre, cédula y celular y aprueba/rechaza pendientes con UN motivo (guardarCambiosTablaCreditos reutiliza «Editar datos», «Corregir cédula» y la lógica de resolverCredito, extraída a lib/admin/resolucionCredito.ts). Prueba unitaria nueva y manual §7.6.
- Bloqueos o trabajo nuevo: ninguno (sin migraciones; commit y despliegue pendientes junto con la migración 20261102000000).

## 2026-11-08 · sesion-principal
- Actividades: P-xx (fotos de afiliación, PDF del proceso, sección «Cambios», horario de atención, logos y rediseño responsive de la landing)
- Estado: En curso
- Qué se hizo: en /admin/asociados/[id] el admin ve y cambia las 3 fotos de afiliación (la anterior se conserva) y sube/descarga/quita varios PDF del proceso; nueva sección «Cambios» (solo admin) con datos y cédula antes/después, fotos antes/después, proceso y documentos. Landing: un solo contenedor de hasta 1600 px, tarjetas más grandes desde 1280 px, convenios en cuadrícula con logo grande, horario «Lunes a viernes, 8:30 a. m. a 5:00 p. m.» junto al WhatsApp (pie sin cambios). Logos de 5 convenios y video de SB7 como archivos del sitio. Migración 20261108000000 y pgTAP 39 (verificada en Postgres embebido, 50 comprobaciones).
- Bloqueos o trabajo nuevo: aplicar la migración 20261108000000 en producción antes de desplegar; tras el despliegue, apuntar logo_path de los 5 convenios a /convenios/logos/… y video_url de SB7 a /convenios/sb7-motos.mp4; correr supabase test db con Docker.
