# Revisión responsive · 2026-09-23 · ga-verificador-responsive

Rama `develop`, commit `bf09975`. Servidor `npm run dev` (http://localhost:3000) con Supabase local. Chrome vía Playwright.

- Pruebas: `tests/responsive/responsive.spec.ts` (8 rutas × 9 anchos, alto 900) y `tests/responsive/casos-limite.spec.ts` (nombre largo en /cuenta y 844×390).
- Mediciones crudas: `test-results/responsive/responsive-2026-09-23.jsonl` y `casos-limite-2026-09-23.jsonl`.
- Capturas: esta carpeta, `<ruta>-<ancho>.png` (página completa), `diseno-*.png` (maquetas), `nombre-largo_*.png`, `horizontal_*-844x390.png`.

## Resumen

8 rutas × 9 anchos (360, 390, 640, 767, 768, 1023, 1024, 1280, 1440) = 72 combinaciones, más 6 de nombre largo y 4 en horizontal.
**0 críticos · 8 menores.**

Correcto en todos los anchos:
- No hay scroll horizontal.
- Ningún texto mide menos de 13 px.
- Los inputs miden 16 px o más en celular.
- Las 6 casillas OTP caben (45 px de ancho y 8 px de separación a 360).
- En /ingresar y /ingresar/codigo, el panel verde está arriba por debajo de 1024 y a la izquierda (540 px) desde 1024.
- /afiliacion usa 1 columna por debajo de 1024 y 2 columnas con el aside a la izquierda desde 1024.
- Los convenios de / y /cuenta aparecen en lista por debajo de 1024 y en grilla de 5 desde 1024.
- La nav, «Conocer la cooperativa», «Cambiar cédula», la flecha de volver y los pasos 1-2-3 aparecen solo donde corresponde.
- A 390 y 1280 las pantallas coinciden con las maquetas de design/.

## Hallazgos

| # | Ruta | Ancho | Problema | Severidad | Captura | Causa probable | Sugerencia |
|---|------|-------|----------|-----------|---------|----------------|------------|
| 1 | /cuenta/solicitar | 360–767 | Las opciones «50 % / 100 % de devolución» parten el texto en 2 líneas alineado a la izquierda y pegado al borde, sin padding. | Menor (se ve roto) | cuenta_solicitar-390.png | app/cuenta/solicitar/SolicitudForm.tsx:77 (`flex … justify-center` sin `px` ni `text-center`) | Agregar `px-3 text-center leading-tight`, o usar el texto corto «50 %» / «100 %» en celular. |
| 2 | /cuenta/solicitar | < 1024 | El control deslizante del monto mide 16 px de alto como área de toque. | Menor | cuenta_solicitar-390.png | SolicitudForm.tsx:111 (`w-full accent-ga-verde`) | Subir el alto a ≥ 44 px (`h-11`) o agrandar el pulgar. |
| 3 | /ingresar/codigo | < 1024 | El botón «Reenviar código» mide 119×21 px de área de toque. | Menor | ingresar_codigo-390.png | components/pantallas/IngresoCodigo.tsx:104-110 | Agregar `py-3` / `inline-flex min-h-11 items-center` sin cambiar el aspecto de enlace. |
| 4 | /cuenta y /cuenta/solicitar | 1024–~1150 | Con un nombre largo, el logo se encoge, «Nueva solicitud» baja a 2 líneas y el nombre ocupa 2 líneas en el header. | Menor | nombre-largo_cuenta-1024.png | components/pantallas/EncabezadoCuenta.tsx:31 (nav sin `whitespace-nowrap`) y :53 (nombre sin límite) | Agregar `whitespace-nowrap` a la nav; poner `max-w-[200px] truncate` al nombre o mostrar solo el primer nombre. |
| 5 | / (landing) | 1024–~1150 | En el hero, «Solicitar crédito» y «Conocer la cooperativa» parten su texto en 2 líneas. «Ver beneficios en mi cuenta» también se parte, y los nombres de los convenios quedan en columnas de 124 px. | Menor | landing-1024.png | components/pantallas/Landing.tsx:123-133 y :265 | Agregar `whitespace-nowrap` a los botones y al enlace, o usar `lg:grid-cols-[1fr_auto]` en el hero. |
| 6 | / (landing) | 640–1023 | Se estira el layout de celular: botones de ~1000 px, franjas de apoyos muy anchas y bajas, texto de lado a lado. No usa el ancho máximo centrado que sí tienen /afiliacion y /cuenta (`md:max-w-2xl`). | Menor (zona intermedia) | landing-1023.png, landing-768.png | Landing.tsx:112-269 (secciones solo con `px-5` hasta `lg`) | Agregar `md:mx-auto md:max-w-2xl` al contenido, o `md:grid-cols-2`/`3` en apoyos y testimonios. |
| 7 | /afiliacion | 1024–~1100 | En 2 columnas cada campo mide 204 px: el placeholder «Sin puntos ni espacios» llega justo al borde y «Enviar solicitud» baja a 2 líneas. | Menor | afiliacion-1024.png | components/pantallas/Afiliacion.tsx:98 (`lg:grid-cols-2`) y botón :259 | Aplicar las 2 columnas desde `xl`, o reducir el aside/`gap-12` a 1024; `whitespace-nowrap` en el botón. |
| 8 | /afiliacion/enviada | 768–1023 | Queda un hueco de ~280 px entre «Qué sigue» y «Volver al inicio», porque el botón se pega al fondo (`mt-auto`) en tableta. | Menor | afiliacion_enviada-768.png | components/pantallas/AfiliacionEnviada.tsx:19 (`min-h-dvh`) y :45 (`mt-auto`) | Usar `md:mt-6` en el botón o `md:min-h-0` en main. |

Observaciones que no cuentan como problema:
- Header de /afiliacion y /politica-de-datos a 768–1023: el logo queda a 24 px del borde, mientras el contenido está centrado en 672 px. No se alinea como en /cuenta.
- Horizontal 844×390 en /ingresar: el panel verde ocupa 222 de 390 px y el botón queda bajo el pliegue. La página sí hace scroll.

## Falsos positivos descartados
- Imagen «deformada» en el pie de la landing: el logo apilado usa `loading="lazy"` y aún no había cargado en la captura de página completa. Al hacer scroll carga a 170×111, con la proporción correcta.
- «Texto desbordado» en los convenios de la landing (≥ 1024): el padre usa `display: contents`, así que la medición no aplica.
- «Solape» en /afiliacion/enviada (≥ 1024): es el mismo párrafo partido en líneas, un `strong` y un `span` en línea.
- El enlace «política de datos» (112×19) es un enlace dentro del texto (excepción de WCAG 2.5.8).
- Los radios de porcentaje miden 1×1 porque son `sr-only`; el área de toque es la etiqueta, de 54 px de alto.
- El círculo «N» y el aviso «1 Issue» de las capturas son el indicador de Next en modo dev; no salen en producción. El «1 Issue» apareció en /afiliacion pero no se reprodujo en consola al volver a cargar; conviene que ga-verificador-qa lo revise.

## No probado
- Estado «solicitud en curso» de /cuenta: el usuario 1234567891 no tiene solicitudes. No usé otro usuario para no interferir con ga-verificador-qa.
- Anchos 320, 414, 834 y 1920: no estaban en el pedido. En la revisión anterior (5.8) pasaron sin scroll horizontal.
- Dispositivos reales (iOS Safari y Android): solo probé Chrome de escritorio con viewport emulado.

## Quién corrige
Los 8 hallazgos le tocan a **ga-diseno-a-codigo**. El #1 y el #3 primero, porque se notan en celular.
