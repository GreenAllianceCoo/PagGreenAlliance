# Responsive del rediseño C+ · 2026-09-27 · ga-verificador-responsive

Verificación de la rama `rediseno-c-plus` (commit `fdab456` al empezar) contra Supabase **local**
(`npx supabase start`, ya en marcha) y `npm run dev`. Playwright con Chrome instalado
(`channel: "chrome"`), `-c tests/responsive`.

## Resumen

- **15 rutas** × **10 anchos** (320, 360, 390, 414, 768, 834, 1024, 1280, 1440, 1920, alto 900) +
  **390 en horizontal** (844×390) + comparación visual contra las piezas `2a…3h` de
  `docs/Green Alliance C+.dc.html`.
- Rutas: `/`, `/ingresar`, `/ingresar/codigo`, `/afiliacion`, `/afiliacion/enviada`, `/cuenta`,
  `/cuenta/solicitar`, `/politica-de-datos`, `/asesor`, `/asesor/demo`, `/admin/afiliaciones`,
  `/admin/creditos`, `/admin/asesores`, `/admin/sorteo`, `/admin/demo`.
- **160 mediciones automáticas completas** (15×10 + 10 de las 15 de horizontal; a las 5 rutas
  `/admin/*` en horizontal les faltó sesión, ver «No probado»). Capturas de pantalla completa en
  `docs/verificaciones/responsive-2026-09-27/*.png` (171 archivos, incluida la comparación con el
  lienzo). JSONL con todas las mediciones en `test-results/responsive/responsive-2026-09-27.jsonl`.
- **9 hallazgos** (5 críticos, 4 menores) más **1 hallazgo crítico fuera del alcance responsive
  estricto** (colores del panel admin) que apareció al revisar `/admin/*` y que **hay que corregir
  primero** porque explica por qué varias capturas del admin se ven "sin diseño".
- Pruebas actualizadas (no eran del rediseño, eran mantenimiento de la suite): nav de la landing
  ya no tiene «Historias» → ahora «Cómo funciona»; se quitó la prueba de «espacios de foto»
  (`EspacioFoto` ya no se usa) y se reemplazó por una prueba de la ilustración nueva del hero
  (manchas + `MatrizCirculos` + `ComprobanteSolicitud`); se agregaron `/asesor`, `/asesor/demo` y
  las 5 secciones de `/admin`; la comparación contra `design/*.dc.html` (obsoleta para
  `/ingresar`, `/afiliacion` y sus pantallas, que ahora siguen las piezas `3b`/`3c`/`3d` del
  lienzo C+) se reemplazó por una captura de esas piezas del lienzo como referencia.

## Hallazgo 0 (fuera del alcance responsive, pero bloquea revisar el resto del admin a fondo)

**El panel de administración completo no tiene ningún color propio: se ve blanco/sin estilo en
TODOS los anchos, no es un problema de un ancho en particular.**

Causa confirmada (no es un artefacto de mi navegador ni de mi prueba: lo reproduje aparte con
`getComputedStyle`, revisando la respuesta HTTP del CSS compilado y con `git show HEAD` sobre el
código ya commiteado):

- `tailwind.config.ts:65` y siguientes definen los colores del admin **anidados dentro de la
  paleta `ga`**: `ga.admin-fondo`, `ga.admin-menu`, `ga.admin-texto`, etc. Eso genera la clase
  `bg-ga-admin-fondo`, `text-ga-admin-texto`, etc. (mismo patrón que `bg-ga-verde`, que sí existe
  en el CSS compilado y sí funciona en el resto del sitio).
- Pero **todos** los componentes del admin (`components/admin/AdminShell.tsx:41`,
  `EncabezadoAdmin.tsx`, `PanelCreditos.tsx`, `PanelAfiliacionDetalle.tsx`, `ChipEstado.tsx`,
  `TarjetaKpi.tsx`, `ToastAdmin.tsx`, `FormularioAsesor.tsx`, `SelectorMes.tsx`,
  `AccionesAfiliacion.tsx`, las páginas `app/admin/**/page.tsx` y `CuentaDemo.tsx`) usan la clase
  **sin el prefijo `ga-`**: `bg-admin-fondo`, `text-admin-texto`, `bg-admin-superficie-2`, etc.
- Como `admin-fondo` no es una paleta de nivel superior en `tailwind.config.ts`, Tailwind no
  genera ninguna regla para esas clases. Verifiqué el CSS servido por el propio `next dev`
  (`grep -c "\.bg-admin-\|\.text-admin-" build.css` → **0** coincidencias) — ni una sola de las
  ~30 clases `bg-admin-*`/`text-admin-*` usadas en el código existe en el CSS final.
- Resultado: fondo del `<body>` blanco (en vez del navy oscuro `#0e1a22`), las tarjetas y chips no
  tienen fondo, los KPIs no tienen color, y el texto queda con el color por defecto del navegador
  (negro) porque `text-admin-texto` (que debía ser casi blanco) tampoco existe — por eso el texto
  igual se lee (queda negro sobre blanco), pero nada del diseño oscuro de la pieza `2d`/`3e-3h` se
  ve.

**Cómo arreglarlo (para `ga-diseno-a-codigo`):** mover las claves `admin-*` de
`tailwind.config.ts` fuera del objeto `ga` a un grupo propio de nivel superior, p. ej.:
```ts
colors: {
  ga: { ... },
  admin: {
    fondo: "var(--ga-admin-fondo)",
    menu: "var(--ga-admin-menu)",
    // ...
  },
}
```
así las clases que el código YA usa (`bg-admin-fondo`, `text-admin-texto`, …) generan la regla
correcta sin tocar ninguno de los ~15 archivos que las usan. Es un cambio de una sola línea de
anidación en `tailwind.config.ts`, no hay que renombrar nada más.

**Severidad: crítica.** No es un problema de un ancho de pantalla (aparece igual en 320 y en
1920), pero como esta verificación cubre `/admin/*` a fondo, lo reporto primero porque **todas**
las capturas de esa sección que acompañan este informe se ven sin el tema oscuro por esta causa —
no confundir con un problema de layout/responsive: la estructura (grid de 248 px, pestañas,
etc.) sí funciona, solo faltan los colores. Evidencia:
`test-results/responsive/evidencia-admin-creditos-sin-tema-oscuro.png` y cualquier captura
`admin_*` en `docs/verificaciones/responsive-2026-09-27/`.

## Tabla de hallazgos (responsive)

| # | Ruta(s) | Ancho | Problema | Severidad | Captura | Causa probable (archivo:línea) | Sugerencia |
|---|---|---|---|---|---|---|---|
| 1 | `/cuenta`, `/asesor` (y por patrón `/cuenta/solicitar`, `/asesor/demo`) | 320–834 (peor en 844×390 horizontal) | **La barra inferior flotante tapa contenido real al cargar la página, antes de hacer scroll.** En `/cuenta` (390×900) tapa los accesos «Nueva solicitud»/«Convenios»; en `/asesor` (390×900) tapa la tarjeta completa del último cliente de la lista. En horizontal (844×390) es mucho peor: en `/asesor` tapa la mitad del KPI «3 Aprobada» **y casi todo el campo «Buscar por nombre»** (un input funcional, no decorativo); en `/cuenta` tapa los 4 pasos de «Tu solicitud». Confirmado con capturas del viewport real (sin `fullPage`, que oculta el problema al recomponer todo el documento) | **Crítica** | `test-results/responsive/evidencia-cuenta-390x900-sin-scroll.png`, `evidencia-asesor-390x900-sin-scroll.png`, `evidencia-cuenta-844x390-sin-scroll.png`, `evidencia-asesor-844x390-sin-scroll.png` | `components/pantallas/Cuenta.tsx:383` (`BarraInferiorCuenta`, `position:fixed`) + `components/pantallas/Cuenta.tsx:447` (`nav id="sorteo" aria-label="Accesos"`, la fila «Nueva solicitud»/«Convenios» que **no está en la pieza 2b** — el propio comentario del código dice que se agregó solo para no romper una prueba e2e existente); `app/asesor/page.tsx:99` (`BarraInferiorAsesor`) | La barra flotante y el `padding-bottom` (`pb-28`/`pb-24`) solo evitan que tape el FINAL de la página; no evitan que tape contenido que cae dentro del último tramo del viewport inicial. Revisar si el buscador de `/asesor` puede ir arriba del todo (no al final de la tarjeta blanca), o si la barra debe aparecer con un fundido solo tras el primer scroll, o subir el `padding-bottom` en pantallas cortas (`h-` pequeño) |
| 2 | `/admin/creditos` | 320, 360 | **Scroll horizontal real** (`document.documentElement.scrollWidth` 366px en un viewport de 320/360px). El filtro «Pendiente / Aprobado / Rechazado» no tiene `flex-wrap` (a diferencia del mismo filtro en `/admin/afiliaciones`, que sí lo tiene) | **Crítica** | `docs/verificaciones/responsive-2026-09-27/admin_creditos-320.png` | `components/admin/PanelCreditos.tsx:132` — `<nav aria-label="Filtrar por estado" className="flex gap-2">` sin `flex-wrap` | Agregar `flex-wrap` (como ya tiene `app/admin/afiliaciones/page.tsx:29`) |
| 3 | Todas las rutas `/admin/*` excepto `/admin/demo` | 320–834 | **Botones de toque menores a 44×44 px en el encabezado móvil del admin**, en los 5 anchos <1024 probados, en las 4 secciones: botón «☰ Menú» 36×36 px; las 5 pestañas «Afiliaciones/Créditos/Asesores/Sorteo/Demostración» miden 34 px de **alto**; el enlace del logo «Ir al panel de administración» mide 26 px de alto | **Crítica** (toque, repetido en cada pantalla del admin en celular) | `docs/verificaciones/responsive-2026-09-27/admin_creditos-390.png` (y equivalentes) | `components/admin/EncabezadoAdmin.tsx:98` (botón menú `h-9 w-9`), `:113` (pestañas `px-3.5 py-2`, sin altura mínima), `:43` (logo, sin altura fija) | Subir el botón menú a `h-11 w-11`; dar a las pestañas `min-h-11` (o `py-3` en vez de `py-2`); envolver el logo en un contenedor `h-11` con `items-center` |
| 4 | `/admin/sorteo` | Estructural (no se disparó porque no hay boletas confirmadas este mes en los datos de prueba) | **La tabla de boletas confirmadas no se convierte en tarjetas en celular**, a diferencia de todas las demás listas del admin y del asesor (`PanelCreditos`, `/admin/afiliaciones`, `/admin/asesores`, `TablaClientes` del asesor). Es un `<table>` HTML con `min-w-[480px]` dentro de un `overflow-x-auto`: en <480 px hay que hacer scroll horizontal *dentro* de la tabla para leer las 4 columnas | **Crítica** (rompe el patrón «tablas en tarjetas en celular» pedido explícitamente) | — (revisión de código; sin datos para capturar) | `app/admin/sorteo/page.tsx:64-88` | Igual que `TablaClientes.tsx`: `<table class="hidden lg:table">` + una `<ul>` de tarjetas `lg:hidden` para <1024 |
| 5 | `/cuenta/solicitar` | 320–834 y 844×390 | Los botones «Volver» y «Cerrar sesión» del encabezado miden 40×40 px en celular (`lg:` sí sube a 44×44, pero eso es escritorio, donde no hace falta) | **Menor** (4 px por debajo del mínimo, siempre visible, siempre el mismo tamaño) | `docs/verificaciones/responsive-2026-09-27/cuenta_solicitar-390.png` | `app/cuenta/solicitar/page.tsx:73` y `:86` (`h-10 w-10`) | Cambiar a `h-11 w-11` en celular (o quitar el `lg:h-11 lg:w-11` actual y dejarlo fijo en 44, igual que el resto del sitio) |
| 6 | `/ingresar/codigo` | 320 | Las 6 casillas del código miden 40 px de **ancho** (alto 52 px), 4 px por debajo del mínimo de toque; caben bien dentro del viewport (no hay scroll) | **Menor** | `docs/verificaciones/responsive-2026-09-27/ingresar_codigo-320.png` | `components/ui/OtpInput.tsx:104` (`grid-cols-6 gap-1.5`, sin ancho mínimo) | Es aritmético: `p-6` (24 px) del formulario + 5 huecos de 6 px dejan (320-48-30)/6 ≈ 40 px por casilla a 320 px. Bajar el `gap` a 4 px o el padding del formulario en celular angosto para llegar a 44 |
| 7 | `/admin/sorteo` | 320–834 | Los dos `<select>` (mes y año) tienen `text-15` (15 px), 1 px por debajo del mínimo de 16 px en celular (riesgo de zoom automático en iOS) | **Menor** | `docs/verificaciones/responsive-2026-09-27/admin_sorteo-390.png` | `components/admin/SelectorMes.tsx:21` (`text-15`) | Subir a `text-16` |
| 8 | `/` (landing) | 320 | El `<h1>` del hero (con `text-wrap:balance`) fuerza que la pista de la grilla del hero mida ~325 px en vez de los ~288 px disponibles (320 − 32 px de `px-4`), un desborde de ~37 px que hoy es invisible porque el contenedor raíz tiene `overflow-x-clip` (pensado para que sangren las manchas decorativas, no para esto). No hay ningún defecto visual hoy (confirmado con captura), pero es frágil: cualquier cambio de texto, fuente o el día que se quite `overflow-x-clip` esto se vuelve scroll horizontal real a 320 px | **Menor** (sin efecto visible hoy) | — (medido con `getBoundingClientRect`, sin defecto visual que capturar) | `components/pantallas/Landing.tsx:149` (`h1` con `[text-wrap:balance]`) dentro de la sección de la línea 140 (`grid` sin `grid-template-columns` explícito en celular) | Agregar `min-w-0` al contenedor de texto del hero (línea 141, `div.flex.flex-col.gap-5`) para que no pueda forzar la pista de la grilla más allá del ancho disponible |
| 9 | Todo `/admin/*` | Todos | Etiquetas de columnas (Asociado/Grado/Monto/Recibida/Estado, Nombre/Cédula/Confirmada, etc.) y el contador numérico del menú lateral usan `text-12` (12 px), 1 px bajo el mínimo pedido (13 px). Es consistente con la propia pieza `2d` del lienzo (que especifica 12 px ahí), así que es una decisión de diseño repetida en todo el panel, no un error aislado — lo dejo anotado igual porque la regla general de esta verificación lo pide | **Menor** (por diseño, repetido) | `docs/verificaciones/responsive-2026-09-27/admin_creditos-1280.png` | `components/admin/PanelCreditos.tsx:151-157` (encabezados), `components/admin/AdminShell.tsx:76` (chip) | Si se quiere subir a 13 px, es un cambio de token en todo el sistema del admin, no archivo por archivo |

## Falsos positivos descartados (para que no se dupliquen en otra verificación)

Mi propia prueba automática (comparación de cajas por `getBoundingClientRect`) marcó estos casos
que, al revisar la captura o reproducirlos aparte, **no son defectos reales**:

- **Logo apilado del pie de la landing "deformado"** (`w=150 h=98 natural=[0,0]`): es un `next/image`
  con `loading="lazy"` fuera del primer tramo de la página; mi prueba mide antes de que el
  navegador decida cargarlo (nunca hice scroll hasta el pie), así que `naturalWidth` queda en 0 y
  mi heurística de proporción calcula `Infinity`. No es una imagen rota — visualmente se ve bien
  (verificado). Pasa lo mismo con el logo apilado de `/afiliacion/enviada` a los anchos de
  escritorio (fuera de la primera pantalla también).
- **`/afiliacion/enviada` @1024-1920: «solape» entre el correo enmascarado y «Te contactaremos…»**:
  es un falso positivo del método (cajas delimitadoras de texto en línea que envuelve varias
  líneas): la captura (`afiliacion_enviada-1280.png`) muestra el párrafo perfectamente legible,
  sin ningún solape visual.
- **Wordmark del header «se sale de su contenedor» en `/cuenta`, `/cuenta/solicitar`, `/asesor`
  (≥1024 px)**: el desborde medido es de **1,1 px** verticales — por debajo del umbral de 1-4 px
  que el propio encargo pide no reportar.
- Las etiquetas «Sorteo»/«Demostración» del admin que aparecen «fuera del viewport» en 320-414 px
  **no** son un error: esa fila de pestañas tiene `overflow-x-auto` a propósito (mismo patrón que
  describe la pieza `3h` del lienzo: «la franja mobile de pestañas se desplaza con inercia»), así
  que esas pestañas están ahí pero hay que deslizar el dedo para verlas — eso es lo esperado, no
  un desborde de página (confirmado: no aparece en `scrollWidth` salvo en el caso ya reportado del
  hallazgo #2, que es un componente distinto sin `overflow-x-auto`).

## Patrones de la spec verificados y correctos

- `/ingresar` y `/ingresar/codigo`: panel verde arriba del formulario <1024 px, panel de 540 px a
  la izquierda ≥1024 px — correcto en los 10 anchos y en 844×390 (horizontal, sigue el patrón
  <1024 correctamente).
- `/afiliacion`: 1 columna hasta 1024 px. **Nota (no es hallazgo nuevo):** el formulario pasa a 2
  columnas recién en **1280 px** (`xl:grid-cols-2`), no en 1024 px como pide la regla general —
  esto ya estaba documentado en el propio código (`components/pantallas/Afiliacion.tsx`, comentario
  «F-01») como una decisión deliberada de una verificación anterior (2026-09-23) para que ningún
  campo quedara angosto entre 1024-1279 px. Lo repito aquí solo para que quede registrado en esta
  tanda; no hace falta corregirlo salvo que diseño decida lo contrario.
- Convenios (`/` y `/cuenta`): lista <1024 px, grilla de 5 ≥1024 px — correcto en ambas rutas.
- `/cuenta` y `/asesor`: header píldora en escritorio (barra blanca flotante, ≥1024 px) y barra
  inferior flotante en celular (<1024 px) — el PATRÓN aparece donde debe (ver hallazgo #1 sobre
  que además tapa contenido).
- `/admin/*`: menú lateral de 248 px ±4 px en escritorio, oculto en celular; encabezado +
  pestañas visible solo en celular — correcto en las 4 secciones con `AdminShell`. `/admin/demo`
  mantiene el mismo encabezado en línea en las dos versiones (sin menú lateral), como corresponde
  a esa pieza (`3h`).
- Landing: nav «Apoyos / Cómo funciona / Convenios / Afíliate» y «Conocer la cooperativa» solo
  ≥1024 px — correcto (ya no dice «Historias»).
- OTP: siempre 6 casillas, siempre dentro del viewport en los 10 anchos (incluido 320 px) — cumple
  la regla #7, aunque el ancho individual quede corto (hallazgo #6).

## Lo que no se pudo probar

- **Las 5 rutas `/admin/*` en horizontal (844×390)**: el correo de prueba del admin
  (`admin.prueba@greenalliance.test`) llegó al límite diario de reenvíos de código (protección
  anti-abuso de `supabase/migrations/20260923210000_limite_de_intentos.sql`, con ventanas de hasta
  1 día) después de usarse muchas veces hoy entre esta verificación y otras corridas de QA. No es
  un hallazgo de la app — es el comportamiento esperado del límite. `/asesor` y `/asesor/demo` sí
  se completaron en horizontal antes de que esto pasara (ver hallazgo #1).
- **`/admin/afiliaciones/[id]`** (detalle de una afiliación, con la lista de «hermanas»): no
  estaba en la lista de rutas de esta tanda (se agregarían credenciales/IDs de prueba aparte). Por
  revisión rápida de código (`components/admin/PanelAfiliacionDetalle.tsx:67-95`): la lista de
  «hermanas» (para navegar con J/K entre solicitudes del mismo estado) está **oculta por completo
  en celular** (`hidden lg:block`, sin una versión en tarjetas que la reemplace), así que en
  celular no hay forma de ver ni navegar entre las solicitudes hermanas desde el detalle — no es
  un error (la ficha principal se ve completa y funciona sola), pero es una limitación que
  `ga-diseno-a-codigo` podría confirmar si es intencional.
- El toast «Aprobado»/«Rechazado» del admin (`ToastAdmin.tsx`, `fixed bottom-7 right-7`, sin
  `max-width`) no se disparó en esta tanda (requiere aprobar/rechazar algo). Con un mensaje largo
  y una pantalla de 320 px podría acercarse al borde izquierdo; no confirmado, queda como riesgo a
  vigilar, no como hallazgo.
- Comparación visual pixel a pixel contra las piezas del lienzo: se capturaron las 11 piezas
  (`2a…3h`) como referencia (`docs/verificaciones/responsive-2026-09-27/pieza-*.png`), pero la
  revisión fue cualitativa (mirar lado a lado), no una resta de imágenes.

## Pedido de diseño

No se agregó ningún pedido a `docs/diseno/pedidos.md`: todos los hallazgos de esta tanda son de
implementación (colores, `flex-wrap`, tamaños de toque, una tabla sin convertir a tarjetas), no
faltan pantallas ni estados en el lienzo.

## Qué debería corregir `ga-diseno-a-codigo` (en orden sugerido)

1. **Hallazgo 0** — anidar los colores `admin-*` fuera de `ga` en `tailwind.config.ts` (una línea,
   arregla el tema oscuro completo del admin).
2. **Hallazgo #1** — revisar el solape de la barra inferior flotante con contenido real en
   `/cuenta` y `/asesor` (crítico, con evidencia visual).
3. **Hallazgo #2** — `flex-wrap` en el filtro de `/admin/creditos` (scroll horizontal real).
4. **Hallazgo #3** — subir a 44×44 los controles del encabezado móvil del admin.
5. **Hallazgo #4** — convertir la tabla de `/admin/sorteo` en tarjetas en celular.
6. Hallazgos #5-#9 (menores) cuando haya tiempo.

## Archivos tocados

- `tests/responsive/responsive.spec.ts` — reescrito: nuevas rutas (`/asesor`, `/asesor/demo`,
  `/admin/*`), patrón `navComoFunciona` (antes `navHistorias`), patrones nuevos del admin (menú
  lateral 248 px, encabezado móvil) y de la barra inferior flotante (con verificación de solape al
  final de la página), prueba de 390° horizontal, reemplazo de la comparación contra `design/` por
  capturas de las piezas del lienzo C+.
- `tests/responsive/logo-y-fotos.spec.ts` — se agregaron `/asesor` y `/admin/afiliaciones`; se
  quitó `/afiliacion/enviada` (necesitaría su propia cookie flash, no vale la pena para esta
  prueba puntual del logo); se reemplazó la prueba obsoleta «Landing · espacios de foto»
  (`EspacioFoto` ya no se usa en ningún lado) por «Landing · ilustración del hero».
- No se tocó ningún archivo de `app/`, `components/`, `lib/` ni estilos.

## Reporte al buzón

```
## 2026-09-27 · ga-verificador-responsive
- Actividades: verificación responsive del rediseño C+ (piezas 2a-2d, 3b-3h)
- Estado: Hecho
- Qué se hizo: Se probaron 15 rutas × 10 anchos (320-1920) + horizontal 844×390 con Playwright/Chrome
  contra Supabase local. 9 hallazgos responsive (5 críticos: barra inferior flotante tapa
  contenido real en /cuenta y /asesor, scroll horizontal real en /admin/creditos, botones <44px
  en el encabezado móvil del admin, tabla de /admin/sorteo sin versión en tarjetas; 4 menores) más
  1 hallazgo crítico fuera del alcance responsive (los colores bg-admin-*/text-admin-* del panel
  de administración no existen en el CSS compilado porque tailwind.config.ts los anida bajo `ga`
  en vez de un grupo propio — el panel se ve blanco en todos los anchos). Pruebas actualizadas por
  cambios intencionales del rediseño (nav sin «Historias», sin espacios de foto). Informe completo
  en docs/verificaciones/2026-09-27-rediseno-c-plus-responsive.md.
- Bloqueos o trabajo nuevo: para ga-diseno-a-codigo, en orden: (0) anidar los colores admin-* bajo
  su propia clave en tailwind.config.ts; (1) revisar el solape de la barra inferior flotante con
  contenido real (/cuenta, /asesor); (2) flex-wrap en el filtro de /admin/creditos; (3) subir a
  44px los controles del encabezado móvil del admin; (4) tabla de /admin/sorteo a tarjetas en
  celular. No pude probar /admin/* en horizontal (844×390) por el límite diario de reenvío de
  código del correo de prueba del admin — no es un hallazgo, es la protección anti-abuso ya
  probada en otra verificación.
```
