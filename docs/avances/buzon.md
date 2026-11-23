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

## 2026-11-21 · sesion-principal
- Actividades: P-nuevo (módulo de convenios · B2 prueba real y B3 panel del convenio)
- Estado: En curso
- Qué se hizo: prueba real de B2 contra producción con elguishe123@gmail.com: cuenta creada con el código real, ingreso por NIT → /convenio, /cuenta, /admin e /ingresar redirigen al panel, «Salir» y convenio oculto sin acceso. B3: /convenio con contadores (x de 10 / x de 5), lista con la línea de pasos (Programada → Publicada → Vencida; «Oculta por Green Alliance» con motivo) y métricas (vistas totales y únicas, clics en WhatsApp); /convenio/nueva?tipo=… y /convenio/[id] con vista previa de la tarjeta del asociado. Imágenes: el navegador las reduce a 1600 px y el servidor las reconvierte a WebP con sharp (agregado como dependencia); PDF hasta 15 MB por URL firmada directo al bucket y validación %PDF en el servidor. Retirar borra fila y archivos. Prueba real: promoción con imagen (PNG 118 KB → WebP 13,5 KB), catálogo PDF, edición y retiro; 390 px sin scroll horizontal. Unitarias 965/965, tsc, eslint y next build ok.
- Bloqueos o trabajo nuevo: el correo «Ya puedes publicar» no se probó (Sebas no compartió RESEND_API_KEY; en producción usa la llave de Vercel). Convenio de prueba «Convenio de prueba QA» (NIT 811.111.111-8) queda OCULTO en producción con su cuenta y una promoción, para probar B4 y B5; se borra en B6. Sigue B4 (admin: publicaciones).

## 2026-11-21 · sesion-principal
- Actividades: P-nuevo (módulo de convenios · B4 admin: publicaciones)
- Estado: En curso
- Qué se hizo: /admin/convenios/publicaciones (solo admin) con todas las publicaciones de todos los convenios, filtros por convenio, tipo y estado, miniatura, vigencia, métricas, «Ver imagen / Ver PDF» con URL firmada, «Ocultar» con motivo opcional (≤ 200, lo ve el convenio) y «Volver a mostrar» (aunque el convenio esté en el tope). La fila muestra quién la ocultó y cuándo. Enlaces «Publicaciones» en Convenios (general y por convenio). Migración 20261121100000: tabla historial_publicaciones_convenio (la escribe un trigger, la lee solo el admin) y admin_historial_equipo con el tipo «publicacion» («Ocultó «X» de Convenio Y»). Ensayo en producción dentro de una transacción revertida: sello de quién ocultó, motivo recortado, 1 evento al ocultar, ninguno al cambiar solo el motivo, 1 al mostrar, la RPC los devuelve y nadie puede insertar a mano; sin datos residuales. Unitarias 976/976, tsc, eslint y next build ok.
- Bloqueos o trabajo nuevo: aplicar la migración 20261121100000 en producción (pendiente de autorización). Prueba real en pantalla con una sesión de admin. Sigue B5 (Beneficios para el asociado).

## 2026-11-21 · sesion-principal
- Actividades: P-nuevo (módulo de convenios · B5 Beneficios para el asociado y B6 cierre)
- Estado: En curso
- Qué se hizo: B5: /cuenta/beneficios con las publicaciones activas (más recientes primero), filtros por aliado, categoría y ciudad (sacada de las sedes; sin sedes = «Todo el país», que entra en cualquier ciudad) y «Nuevo» de 7 días; /cuenta/beneficios/[id] con imagen o galería, PDF en visor con enlace de respaldo y «Escribir por WhatsApp» (registra la vista al abrir y el clic al salir con registrar_evento_publicacion). «Beneficios» en el menú de escritorio y en los accesos de celular; el detalle de cada convenio en /cuenta lista sus promociones y catálogos activos. Solo se cargan para asociados (RLS además). B6: e2e tests/e2e/s-convenios-publicaciones.spec.ts (admin crea el convenio con correo → la empresa entra con NIT y publica → el asociado la ve y filtra por ciudad → el admin la oculta con motivo y sale en el Historial → la empresa la ve oculta y el asociado ya no), manual de administración §11.1–11.4 y guía nueva docs/entrega/guia-convenios.md. Contadores del Resumen ya filtran por rol asociado (las cuentas de convenio no los inflan). Unitarias 986/986, tsc, eslint y next build ok.
- Bloqueos o trabajo nuevo: el e2e no se pudo correr en este equipo (Docker Desktop no arranca: Hyper-V/virtualización no disponible), y B4/B5 no se probaron en pantalla con sesiones reales de admin y asociado. Falta aplicar la migración 20261121100000 (autorización pendiente) y borrar el «Convenio de prueba QA» de producción con su cuenta y su promoción cuando terminen las pruebas reales. Horas por anotar.

## 2026-11-22 · sesion-principal
- Actividades: P-nuevo (módulo de convenios · migración de B4)
- Estado: Hecho
- Qué se hizo: migración 20261121100000 aplicada en producción (autorizada por Sebas): tabla historial_publicaciones_convenio con RLS (solo admin la lee, nadie inserta a mano), trigger de ocultar/mostrar y tipo «publicacion» en admin_historial_equipo. Verificado en el catálogo.
- Bloqueos o trabajo nuevo: subir los commits de B4–B6 a la rama del PR; e2e pendiente en un equipo con Docker; borrar el «Convenio de prueba QA» tras las pruebas reales.

## 2026-11-22 · sesion-principal
- Actividades: P-nuevo (fase 2 · rediseño unslop, tanda 1: landing, ingreso y ajustes globales)
- Estado: En curso
- Qué se hizo: auditoría en docs/rediseno/auditoria-unslop.md (modo pulido, se conserva la marca C+), aprobada por Sebas. Global: pesos 800/700 → 600 (Manrope 400/500/600, Bricolage 600), etiquetas sin mayúsculas ni espaciado ancho (salvo «Afiliado Titular» del carné), curva de movimiento sin rebote (`ease-ga`; el rebote solo en el sello del comprobante), borde del admin 14 % → 10 %. Landing: sin la cifra «Aprobados», botones del hero más abajo y con aire, una sola mancha orgánica igual en todas las secciones (pedido de Sebas: decorado parejo), tarjetas de apoyos y pasos con un mismo fondo, títulos sin punto final, píldora del público como texto, «Ingresar» en el encabezado, WhatsApp del horario con el estilo de la casa, convenios sin logo con iniciales en vez de emoji, «¡Aprobada!» → «Aprobada.». Ingreso: «Hola de nuevo» → «Tu cuenta en Green Alliance». Cuenta: el título es el nombre, sin «Hola,». e2e actualizados con los textos nuevos. Unitarias 986/986, tsc, eslint y next build ok; capturas a 1440 y 390.
- Bloqueos o trabajo nuevo: revisar en pantalla /cuenta y /admin con una sesión real (necesita a Sebas para el código del correo). Rediseño no se cobra.

## 2026-11-23 · sesion-principal
- Actividades: P-nuevo (fase 2 · rediseño del ingreso, tanda 2)
- Estado: En curso
- Qué se hizo: pedido de Sebas sobre /ingresar. En escritorio los lados se invierten: formulario a la izquierda con el logo oficial a color encima y panel verde a la derecha (aplica también a código, NIT y recuperar, que comparten PanelIngreso). Panel de cédula recortado: «Tu crédito, paso a paso» + una frase + el comprobante vivo de la landing en vez de la lista de beneficios. Formulario: un solo botón grande; «¿Ya no tienes acceso a tu correo?» más discreto; «Deseo afiliarme» y «Entra con tu NIT» como enlaces bajo una línea; línea de confianza con candado y enlace a la Política de datos. e2e actualizados (título nuevo, «Deseo afiliarme» ya no es botón). Unitarias 986/986, tsc y eslint ok; capturas a 1440 y 390.
- Lado blanco (elegido por Sebas, ideas a + c + d): fondo gris muy claro, formulario en una tarjeta blanca con borde fino, sello de la cooperativa como marca de agua abajo a la izquierda y pie «© año Cooperativa Green Alliance · Política de datos · Volver al inicio». Solo escritorio; celular sin cambios. Capturas a 1440, 1100 y 390.
- Bloqueos o trabajo nuevo: e2e pendiente en un equipo con Docker. Rediseño no se cobra.
