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

## 2026-11-21 · sesion-principal
- Actividades: P-nuevo (módulo de convenios · B0 spec y B1 modelo de datos y RLS)
- Estado: En curso
- Qué se hizo: spec aprobada (docs/spec-convenios.md). Migración 20261121000000 aplicada en producción el 2026-11-21: rol `convenio`, convenios.nit_base y eliminado_en, convenio_cuentas, correo_por_nit (solo service_role), convenio_publicaciones con RLS, guardas y topes 10/5, métricas (totales y únicos) y bucket privado convenios-publicaciones. pgTAP 10 corrido en producción dentro de una transacción revertida: 48/48 ok, sin datos residuales.
- Bloqueos o trabajo nuevo: siguen B2 (ingreso con NIT y cuentas desde el admin) a B6. Horas de B0–B1 por anotar en docs/avances/horas-convenios.md.

## 2026-11-21 · sesion-principal
- Actividades: P-nuevo (módulo de convenios · B2 cuenta y acceso)
- Estado: En curso
- Qué se hizo: ingreso con NIT en /ingresar/convenio reutilizando lib/ingreso/servidor.ts (cookie con `t: "nit"`, correo_por_nit, límites por tipo; mismo paso 2 en /ingresar/codigo con «Cambiar NIT»); rol convenio → /convenio. Admin → Convenios: campo «Correo de acceso» (crea o cambia la cuenta de Auth sin contraseña, vincula con vincular_cuenta_convenio y envía «Ya puedes publicar»; plantilla opcional RESEND_TEMPLATE_CONVENIO_ACCESO con respaldo en texto), línea «Acceso» en la lista, NIT repetido como error de campo, «Eliminar» con cuenta o publicaciones = marcar eliminado_en. Guarda exigirConvenio en /convenio (inicio provisional) y proxy que manda la cuenta de convenio fuera de /cuenta. Unitarias 940/940, tsc, eslint y next build ok; capturas de /ingresar/convenio a 390 y 1280 px.
- Bloqueos o trabajo nuevo: falta la prueba real de punta a punta (crear un acceso con un correo de prueba y entrar con el NIT), que crea un usuario en producción y envía un correo. Sigue B3 (panel /convenio con publicaciones).
