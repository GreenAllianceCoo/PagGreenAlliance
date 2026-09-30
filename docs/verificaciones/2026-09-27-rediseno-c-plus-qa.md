# QA del rediseño C+ · 2026-09-27 · ga-verificador-qa

Verificación de la rama `rediseno-c-plus` (último commit `5766d30`) contra Supabase **local** (`npx supabase start` + `npx supabase db reset`, incluidas las 5 migraciones propuestas `20260925200*`). Suite completa: `npx playwright test -c tests/e2e`, dos proyectos (`escritorio` 1280×800, `celular` 390×844, `devices['iPhone 13']`).

## Veredicto

**Pasa, sin hallazgos de severidad alta o crítica.** Después de actualizar las pruebas que quedaron desactualizadas por cambios intencionales del rediseño (ver «Qué se actualizó» abajo), **161/162 pruebas pasan en escritorio** (1 se omite a propósito: «Quiero afiliarme (celular)» no aplica a ese proyecto) y **129/129 pasan en celular** (33 se omiten a propósito: pruebas de servidor/API marcadas «una vez basta» que no dependen del viewport, p. ej. límites de intentos o `k-roles.spec.ts`, que se declara `test.skip(({ isMobile }) => isMobile)` porque el rol no cambia con el tamaño de pantalla). `z-limite-verificacion.spec.ts` no se corrió: está protegida por `QA_LIMITE_VERIFICACION=1` a propósito porque bloquea el ingreso local ~5 minutos; no es necesaria para esta verificación del rediseño.

No se encontró ningún botón «Definido» roto, ninguna filtración de la existencia de una cédula, ningún bypass de RLS y ningún flujo principal roto. Se registran **2 hallazgos de severidad Baja** (contenido de ejemplo visible, ya rastreado como pendiente) y **1 hallazgo Media** que ya estaba reportado por `ga-revisor-seguridad` el mismo día y sigue sin corregirse (se repite aquí para que no se pierda).

## Cómo se corrió

```
export PATH="/c/Program Files/nodejs:$PATH"
npx supabase start
npx supabase db reset            # aplica también las 5 migraciones 20260925200* propuestas
npm run dev                      # .env.development.local → Supabase local
npx playwright test -c tests/e2e --project=escritorio
npx supabase db reset            # k-roles.spec.ts deja la afiliación/crédito de ejemplo resueltos
npx playwright test -c tests/e2e --project=celular
```

Capturas de pantalla completa en `test-results/qa/*.png`, JSON de accesibilidad (`axe`) en `test-results/qa/axe-*.json` (0 violaciones de cualquier severidad en las 19 combinaciones pantalla×viewport revisadas), trazas de cualquier corrida anterior fallida en `test-results/playwright/`.

## Resumen por pantalla

| Pantalla | Escritorio | Celular | Notas |
|---|---|---|---|
| Landing `/` | Pasa | Pasa | Nav sin «Historias» (ahora «Cómo funciona», ancla `#c-como-funciona`), hero con comprobante animado (fijo con `prefers-reduced-motion`), «Lo que encuentras en Green Alliance» (4 tarjetas), sección «Si hoy el banco te dice que no…», convenios, sedes, pie con WhatsApp/correo/vigilancia reales. Botón primario `#1E6652`, secundarios con sombra navy `1.5px`, Manrope en cuerpo y **Bricolage Grotesque en títulos** (cambio del rediseño). **Hallazgo B-01**: sección de testimonios con texto de ejemplo entre corchetes. |
| `/ingresar` (paso 1) | Pasa | Pasa | Cédula solo dígitos 6–10, «Deseo afiliarme» siempre visible, «Enviarme el código» con estado de carga, mismo mensaje exista o no la cédula, WhatsApp con número real (311 724 1942). |
| `/ingresar/codigo` (paso 2) | Pasa | Pasa | 6 casillas (avance automático, Backspace, pegar), «Reenviar código» con contador de 45 s, «Cambiar cédula»/volver limpia la cookie, correo **completamente** enmascarado (`xx•••@•••`, sin ninguna letra del dominio — mejora de privacidad de una revisión anterior), entrar directo sin cookie → `/ingresar`. |
| `/cuenta` | Pasa | Pasa | «Hola, nombre», tarjeta «Tu solicitud» (o estado vacío), tope del grado, carné de asociado, convenios, «Mis datos» (celular editable, resto de solo lectura), sorteo del mes (botón según ventana 1–5), «Salir»/«Cerrar sesión». Sin la tasa de interés en ningún lado (confirmado: no está ni en el texto ni en las props que llegan al cliente). |
| `/cuenta/solicitar` | Pasa | Pasa | 50 %/100 %, deslizador (mínimo 100.000, tope y pasos de 50.000 del grado), plazo, sin cuota ni tasa visibles. Servidor rechaza monto bajo el mínimo, sobre el tope, porcentaje inválido y monto no múltiplo de 50.000 (ver nota técnica sobre esta prueba abajo). RLS: una sola pendiente, no a nombre de otro, no se auto-aprueba, no supera el tope. |
| `/afiliacion` | Pasa | Pasa | Formulario v2 completo: nombres/apellidos, cédula, grado, Nequi, institución, celular, correo (cualquier dominio, nunca «Correo institucional»), asesor opcional, 3 fotos (con compresión en el navegador y verificación de tipo real en el servidor), mensaje opcional, checkbox con enlace a política de datos. Doble clic → una sola fila; honeypot → «éxito» sin guardar; segunda solicitud con cédula pendiente → misma respuesta que un envío exitoso (S-06); RLS: `anon` y `authenticated` no leen ni insertan. |
| `/afiliacion/enviada` | Pasa | Pasa | Comprobante con sello (animado, fijo con `prefers-reduced-motion`), correo enmascarado, «4 horas o menos» (ya no es un marcador `[N]`), «Volver al inicio». Entrar directo sin enviar → `/afiliacion`. |
| `/politica-de-datos` | Pasa | Pasa | Carga, título, se abre desde el checkbox de afiliación en pestaña nueva. Sigue con los marcadores `[NIT]`, `[dirección y ciudad]`, etc. pendientes de datos reales de la cooperativa — ya confirmado el 25-sep (P-75 a P-81 del plan), no es un hallazgo nuevo. |
| `/asesor`, `/asesor/demo` | Pasa (solo escritorio; el rol no depende del viewport) | — | «Mis clientes» nunca muestra celular, correo ni Nequi del asociado de prueba (verificado con el texto completo de la página, no solo con el dato puntual). Demo: marco ámbar «siempre visible» + «Salir de la demo», no guarda nada. |
| `/admin/afiliaciones`, `/admin/creditos`, `/admin/asesores`, `/admin/sorteo`, `/admin/demo` | Pasa | — | Aprobar (afiliación y crédito) en **2 pasos** («Aprobar» → confirmación → «Sí, aprobar»); rechazar crédito exige motivo (rechazar afiliación no, por diseño: la tabla no tiene esa columna). Atajos J/K mueven la selección, A/R abren el paso de confirmación **sin** aprobar/rechazar, Esc cancela, y **no se disparan** escribiendo en el buscador. KPIs («Créditos pendientes», «Afiliaciones pendientes», «Aprobados este mes», «Monto aprobado este mes») coinciden con consultas directas a la base. «Nota interna» no aparece (bandera `HISTORIAL_NOTAS_INTERNAS_HABILITADO=false`, confirmado en créditos por prueba y en afiliaciones por revisión de código — misma bandera). Demo del admin: mismo marco ámbar. |
| Accesibilidad (`axe`, wcag2a/aa + wcag21a/aa) | Pasa | Pasa | **0 violaciones de cualquier severidad** (no solo serias/críticas) en las 8 pantallas × 2 viewports revisadas. Todo el flujo de ingreso y el formulario de afiliación se completan solo con teclado, con foco siempre visible. Cada input/select/textarea visible tiene nombre accesible. |
| `prefers-reduced-motion: reduce` | Pasa | Pasa | Landing (comprobante fijo), afiliación enviada (sello sin girar), `/cuenta` (sello), `/ingresar/codigo` (aro de reenvío): sin errores de JavaScript y sin nada que dependa de que una animación termine. |
| Revisión estática | Pasa | (una sola vez) | Sin `SUPABASE_SERVICE_ROLE_KEY` en archivos `'use client'`; sin `console.log` con datos personales; sin marcadores del diseño (`ju•••@correo.com`, `[Nombre]`, `[TOPE]`…) fijos en el código (fuera de `lib/mock.ts`); **ninguna pantalla dice «Correo institucional»** (prueba nueva de esta verificación). |
| `z-limite-verificacion.spec.ts` | Bloqueada a propósito | — | Requiere `QA_LIMITE_VERIFICACION=1` y bloquea el ingreso local ~5 min; no se corrió (no hace falta para verificar el rediseño; ya está cubierta por una verificación anterior). |

## Qué se actualizó en las pruebas (cambios intencionales del rediseño, no hallazgos)

| Archivo | Qué cambió en la app | Qué se corrigió en la prueba |
|---|---|---|
| `tests/e2e/a-navegacion.spec.ts` | El nav de la landing ya no tiene «Historias» (pieza 2a: «Apoyos, Cómo funciona, Convenios, Afíliate») | La prueba de anclas ahora usa «Cómo funciona» → `#c-como-funciona` |
| `tests/e2e/e-diseno.spec.ts` | Reescrita casi por completo: landing (2a), `/cuenta` (2b) y afiliación v2 (nombres/apellidos, institución, Nequi, asesor, 3 fotos) cambiaron de textos y de marcado; los títulos (`h1`) ahora usan Bricolage Grotesque, no Manrope | Textos esperados verificados contra el código real (no solo el lienzo) y contra un volcado en vivo de `textoVisible(page)` en los dos viewports; `revisarEstilos` ahora exige Bricolage Grotesque en el título y Manrope en el cuerpo; las partes con fecha (sorteo, «Enviada …») se capturan del propio render en vez de escribirse a mano |
| `tests/e2e/utils.ts` | La afiliación pasó de un solo campo «Nombres y apellidos» (v1, ya reemplazado desde antes del rediseño) a nombres/apellidos separados + institución + Nequi + asesor + 3 fotos | `datosValidos()`/`llenarAfiliacion()` reescritas para el formulario real; usadas también por `a-navegacion.spec.ts`, `f-accesibilidad.spec.ts` e `i-despliegue.spec.ts` |
| `tests/e2e/f-accesibilidad.spec.ts` | Mismo cambio de formulario v2 | `#af-nombre-error` → `#af-nombres-error`; orden de Tab reescrito con los IDs reales (`af-nombres`, `af-apellidos`, `af-nequi`, `af-institucion`, `af-asesor`, las 3 fotos…), igual en escritorio y celular (el formulario v2 ya no reordena por CSS entre viewports) |
| `tests/e2e/k-roles.spec.ts` | Aprobar (afiliación y crédito) pasó a 2 pasos; asesor/admin demo con marco ámbar | Flujo actualizado a «Aprobar» → «Sí, aprobar»; se agregaron las verificaciones nuevas pedidas para esta tanda (KPIs, atajos de teclado, nota interna oculta, marco ámbar) |
| `tests/e2e/b-ingreso.spec.ts`, `tests/e2e/j-produccion.spec.ts` | `lib/mascara.ts` ahora oculta el dominio del correo **por completo** (`xx•••@•••`), no solo sus primeras letras — mejora de privacidad de una revisión de seguridad anterior al rediseño, pero las pruebas todavía esperaban ver parte del dominio | Los patrones y la lista `DOMINIOS_RELLENO` (que ya no existen: no hay ningún dominio que distinguir) se actualizaron al nuevo formato único |
| `tests/e2e/g-estatico.spec.ts` | — | Se agregó la prueba «Ninguna pantalla dice “Correo institucional”», pedida explícitamente para esta verificación |
| `tests/e2e/i-despliegue.spec.ts` (I2 «Teclado y axe») | En celular (pieza 2b) el encabezado de `/cuenta/solicitar` agrega el ícono «Cerrar sesión» entre «Volver» y el formulario (en escritorio esa acción está en otro lugar del encabezado) | La prueba asumía que un solo Tab desde «Volver» llegaba al radio «Porcentaje de devolución»; ahora tabula hasta 3 veces buscando el campo `name="porcentaje"`, válido en los dos viewports |
| `tests/e2e/f-accesibilidad.spec.ts` | — | Se agregó `describe("F · prefers-reduced-motion: reduce")` con 4 pruebas (landing, afiliación enviada, `/cuenta`, `/ingresar/codigo`), pedidas explícitamente para esta verificación |

## Nota técnica: prueba de «cliente manipulado» de `/cuenta/solicitar` (no es un hallazgo de la app)

`tests/e2e/i-despliegue.spec.ts` («Servidor: rechaza monto bajo el mínimo…») fallaba de forma intermitente/confusa. La causa **no es un bug de la aplicación**: con React 19, un `<form action={accionDeServidor}>` ya no serializa el DOM en vivo al enviarse — React arma el `FormData` desde su propio árbol interno y le agrega un prefijo propio a cada campo (p. ej. `name="monto"` en el JSX viaja como `_1_monto` en el `multipart/form-data` real). La técnica anterior (`forzarCampo`: quitarle el atributo `name` al control real y agregar un `<input>` oculto a mano) nunca llegaba a cambiar lo que en verdad se enviaba: el servidor recibía el valor legítimo que ya tenía el formulario, no el manipulado.

Se reescribió `forzarCampoYEnviar` para interceptar la petición de red (`page.route`) y reescribir el cuerpo `multipart/form-data` antes de que salga, sin importar el prefijo interno. Con eso, las 4 variantes (monto bajo el mínimo, sobre el tope, no numérico, porcentaje inválido) pasan de forma confiable. De todos modos, la garantía de seguridad real (que la base rechaza montos fuera de rango) ya estaba probada de forma independiente y confiable por la prueba vecina «RLS / base: una sola pendiente…», que ataca la API REST directamente sin pasar por el cliente.

## Tabla de hallazgos

| ID | Pantalla | Botón o regla | Esperado | Obtenido | Evidencia | Severidad | Agente que corrige |
|---|---|---|---|---|---|---|---|
| B-01 | Landing `/`, sección «Lo que hicieron con su crédito» | Testimonios reales de asociados | La pieza `2a` del lienzo **no incluye** esta sección (se conservó con el estilo nuevo, sin enlace en el nav, por ser contenido que ya existía). Sigue mostrando el texto de ejemplo de `lib/mock.ts#TESTIMONIOS_EJEMPLO`, con corchetes literales visibles: «[Testimonio real de un asociado: qué necesitaba y qué logró.]» y «[Nombre], [grado] · asociado desde [año]», en escritorio y celular | `tests/e2e/e-diseno.spec.ts` › «Hallazgo: testimonios de ejemplo con corchetes visibles» (deja constancia, no bloquea); `lib/mock.ts:70-79` | Baja | `ga-funcionalidad-botones` (contenido) — pedido de diseño abierto: `docs/diseno/pedidos.md` D-07 |
| B-02 | `/politica-de-datos` | Texto legal completo | Sigue con 8 marcadores `[entre corchetes]` (NIT, dirección, fecha de publicación, plazos, país de los servidores…) | `test-results/qa/i-marcadores-escritorio.json`; ya confirmado el 25-sep (`docs/verificaciones/2026-09-25-produccion.md`, P-75 a P-81 del plan) | Baja (no es nuevo) | Dato pendiente de la cooperativa, no de código |
| M-01 | `/admin/afiliaciones/[id]` | La lista de «hermanas» (otras solicitudes del mismo estado, al lado de la ficha) solo debería llevar al cliente lo que se muestra (cédula enmascarada) | El objeto `hermanas` que arma `app/admin/afiliaciones/_datos.ts:34` (`select("id, nombre, cedula, grado, institucion, estado, created_at")`) se pasa completo a `PanelAfiliacionDetalle` (`app/admin/afiliaciones/[id]/page.tsx:70`), un componente `"use client"`: la cédula **sin enmascarar** de cada hermana viaja en las props serializadas al navegador, aunque en pantalla solo se vea `enmascararCedula(h.cedula)` (`components/admin/PanelAfiliacionDetalle.tsx:87`). No es una fuga entre usuarios (el admin ya tiene acceso legítimo a esa cédula completa con solo hacer clic en esa fila), pero no minimiza lo que llega al cliente. **Ya reportado por `ga-revisor-seguridad` el 2026-09-27** (`docs/avances/buzon.md`); se repite aquí porque sigue sin corregir | Revisión de código (no requiere una prueba E2E nueva: el dato ya es visible con las herramientas de desarrollador del navegador estando logueado como admin) | Media | `ga-funcionalidad-botones` |

## Botones «Pendiente» encontrados y su estado actual

| Botón o dato | Estado verificado hoy |
|---|---|
| «Ayuda por WhatsApp [NÚMERO]» (ingreso, `/cuenta`) | Ya no es un marcador: `lib/config.ts` trae un número por defecto real (311 724 1942, `wa.me/573117241942`) si no hay `NEXT_PUBLIC_WHATSAPP`. Confirmar con la cooperativa si es el número definitivo. |
| «política de datos» (checkbox de afiliación) | Funciona: abre `/politica-de-datos` en pestaña nueva sin perder lo escrito. El texto de esa página sigue con huecos (ver hallazgo B-02). |
| [N] días hábiles (`/afiliacion/enviada`) | Ya no es un marcador: usa `TIEMPO_RESPUESTA = "4 horas o menos"` (`lib/config.ts`). |
| «Convenios» (nav y acceso rápido de `/cuenta`) | Funciona: hace scroll a `#convenios` en la misma página. Sigue sin página propia (decisión pendiente, no bloquea nada). |
| Tarjetas de convenio en `/cuenta` | `href="#"`, visibles, no rompen la página (comportamiento correcto para un Pendiente). |
| «Escribir por WhatsApp» (detalle de afiliación del admin) | Visible pero **deshabilitado a propósito**, con `title="Pendiente de decidir (P-95)"` (`components/admin/PanelAfiliacionDetalle.tsx:160-167`): con qué número y si abre `wa.me` o un flujo propio. Comportamiento correcto para un Pendiente. |
| «Desactivar asesor» (`/admin/asesores`) | No implementado, ni siquiera como botón deshabilitado (no hay columna `activo` en `perfiles` ni decisión de negocio). Correcto: no se inventó el comportamiento. |
| «Exportar a CSV» (`/admin/sorteo`) | No implementado (marcado opcional en la spec). |
| Nota interna (créditos y afiliaciones, panel admin) | Oculta detrás de `HISTORIAL_NOTAS_INTERNAS_HABILITADO = false` (`lib/admin/flags.ts`) hasta que se aplique la migración `20260925200200_historial_y_notas_internas.sql`. Correcto: no se muestra un campo que no guarda nada. |

## Pedido de diseño agregado

`docs/diseno/pedidos.md` → **D-07 · Landing · sección «Lo que hicieron con su crédito» (testimonios)**: la pieza `2a` no cubre esta sección; falta decidir si se mantiene (con testimonios reales) o se retira, ver hallazgo B-01.

## Pruebas guardadas

Todas en `tests/e2e/` (se repiten con `npx playwright test -c tests/e2e`):
`a-navegacion.spec.ts`, `b-ingreso.spec.ts`, `c-cuenta.spec.ts`, `d-afiliacion.spec.ts`, `e-diseno.spec.ts`, `f-accesibilidad.spec.ts`, `g-estatico.spec.ts`, `h-credito.spec.ts`, `i-despliegue.spec.ts`, `j-produccion.spec.ts`, `k-roles.spec.ts`, `z-limite-verificacion.spec.ts` (opt-in), más `utils.ts` (helpers compartidos, actualizado a la afiliación v2).
