# QA de producción · 2026-09-25 · ga-verificador-qa

Verificación de la actividad 6.3 contra **https://www.greenallianceco.com** (rama `main`, merge `5a39d34` → `debe226`). Regla estricta de esta verificación: **no se envió el formulario de afiliación, no se pidió ningún código de ingreso real y no se creó ni modificó ningún dato.** Solo navegación, cabeceras HTTP y validaciones del lado del navegador.

Herramienta: Playwright (`@playwright/test` + `@axe-core/playwright`, ya presentes como devDependencies) contra la `baseURL` de producción, en una configuración **fuera de `tests/`** para que nadie la corra sin querer contra datos reales:

- `docs/verificaciones/prod-2026-09-25/playwright.config.ts`
- `docs/verificaciones/prod-2026-09-25/prod.spec.ts`

Cómo repetirla:
```
npx playwright test -c docs/verificaciones/prod-2026-09-25
```
Capturas, JSON de accesibilidad y trazas de fallos en `test-results/qa/produccion/`.

## Veredicto

**Con observaciones.** El flujo público (landing, ingreso sin enviar código, afiliación sin enviar, política de datos, redirecciones protegidas, 404, cabeceras de seguridad, accesibilidad básica) funciona y es fiel al diseño. Se encontraron **1 hallazgo Alto** (la ayuda del dominio de correo institucional no se actualiza en vivo en `/afiliacion`), **3 hallazgos Medios** (número de WhatsApp mostrado sin espacios por un error de regex; el dominio raíz a veces no redirige a `www`; texto legal de vigilancia sigue siendo un marcador visible al público) y **2 Bajos**. Ninguno es una filtración de datos, un bypass de RLS ni impide usar el sitio; no bloquean el uso normal, pero conviene corregirlos.

No se pudieron probar (bloqueado a propósito por las reglas de esta verificación, no por falta de entorno): envío real de la afiliación, envío/verificación de un código OTP real, y por lo tanto tampoco RLS de escritura, duplicados por cédula, doble clic, ni el contenido de los correos. Esas rutas ya están cubiertas por las pruebas E2E contra Supabase local (`tests/e2e/`, ver `docs/verificaciones/2026-09-23-verificacion-3.md`); no se repiten aquí para no crear datos en producción.

## Resumen por pantalla

| Pantalla | Escritorio 1280 | Celular 390 | Notas |
|---|---|---|---|
| Landing `/` | Pasa | Pasa | Título, h1, anclas `#c-apoyos/#c-historias/#c-convenios`, «Afíliate», «Mi cuenta»/«Ingresar», «Solicitar crédito», «Conocer la cooperativa»/«Quiero afiliarme», convenios, sin 404 en los enlaces visibles, sin errores de consola. Pie con WhatsApp, correo y texto de vigilancia (hallazgos M-01, M-03, B-01). |
| `/ingresar` | Pasa | Pasa | Formato de cédula (numérico, `inputmode`, filtra letras), «Deseo afiliarme» → `/afiliacion`, botón primario verde `#1E6652`, Manrope, enlace real a WhatsApp (hallazgo M-01 en el texto visible). `/ingresar/codigo` sin cookie → `/ingresar`. |
| `/afiliacion` | Pasa (con hallazgo) | Pasa (con hallazgo) | Título, h1, «¿Ya eres asociado? Ingresa»/volver, nombres/apellidos solo letras, cédula/celular/Nequi solo números, institución con Policía Nacional y Ejército Nacional, asesor con «No tengo asesor», 3 campos de foto, checkbox con enlace a `/politica-de-datos` en otra pestaña, botón «Enviar solicitud» visible (verde, no pulsado), `/afiliacion/enviada` directo → `/afiliacion`, axe sin violaciones. **Hallazgo A-01**: la ayuda del dominio de correo no cambia al elegir institución. |
| `/politica-de-datos` | Pasa | Pasa | Carga 200, título, h1. Huecos en amarillo confirmados (ver abajo) — **esperados, no son falla**, según el encargo. |
| `/admin`, `/asesor`, `/cuenta` sin sesión | Pasa | Pasa | Los 3 redirigen a `/ingresar` (307) con `h1` visible. |
| Dominio y 404 | Con hallazgo | (una vez basta) | `greenallianceco.com` → hallazgo M-02 (ver abajo). 404 en español, con logo/enlace al inicio, cabeceras de seguridad presentes en `/`, `/ingresar`, `/cuenta`. |
| Accesibilidad | Pasa | Pasa | `axe` (wcag2a/aa, wcag21a/aa): **0 violaciones serias/críticas** en landing, `/ingresar`, `/afiliacion`, `/politica-de-datos`, en los dos tamaños. Foco visible en `/ingresar`. |
| Consola | Pasa | Pasa | Sin errores de consola ni `pageerror` en `/`, `/ingresar`, `/afiliacion`, `/politica-de-datos`, `/admin`, `/asesor`, `/cuenta` (ambos tamaños). |

**Pruebas Playwright:** 58 casos (29 por proyecto) → 55 pasan, 1 falla (dominio apex, hallazgo real, no un error de la prueba), 2 se omiten (la del dominio y la de cabeceras están marcadas «una vez basta», no dependen del viewport). Ver `test-results/qa/produccion/resultados.json`.

## Tabla de hallazgos

| ID | Pantalla | Botón o regla | Esperado | Obtenido | Evidencia | Severidad | Corrige |
|---|---|---|---|---|---|---|---|
| A-01 | `/afiliacion` | Desplegable «Institución» → ayuda del dominio de correo bajo «Correo institucional» (pedido explícito de este encargo y del mapa de botones §5) | Al elegir «Policía Nacional» o «Ejército Nacional», el texto de ayuda bajo «Correo institucional» cambia para indicar el dominio esperado (p. ej. `@policia.gov.co`) | El texto de ayuda se queda fijo en «Selecciona primero tu institución.» aunque el `<select>` sí cambia de valor (confirmado con Policía Nacional, esperando 1 s). Causa: `components/pantallas/Afiliacion.tsx` calcula `institucionElegida` a partir de la prop `valores.institucion`, que solo se actualiza cuando `app/afiliacion/FormularioAfiliacion.tsx` (`useActionState`) recibe la respuesta de la Server Action tras un envío; no hay estado de React ligado al `onChange` del `<select>` mientras la persona solo está eligiendo la institución. | `docs/verificaciones/prod-2026-09-25/prod.spec.ts` › C › «Institución…» (anotación `ayuda-dominio` en `test-results/qa/produccion/resultados.json`); capturas `c-afiliacion-*.png` | **Alta** (función «Definido» del mapa de botones §5 no funciona como se pidió; no bloquea el envío pero deja sin la ayuda prometida) | `ga-funcionalidad-botones` |
| M-01 | Pie de la landing y «Ayuda por WhatsApp» en `/ingresar` (y previsiblemente `/ingresar/codigo`, `/cuenta`, que usan el mismo `WHATSAPP_NUMERO`) | Mostrar «311 724 1942» (con espacios) | Se muestra «3117241942» (sin espacios). El enlace en sí funciona bien: `href="https://wa.me/573117241942"` es correcto en `/ingresar`. Causa: `lib/config.ts` líneas 7 y 10 usan `replace(/D/g, "")` y `replace(/^(d{3})(d{3})(d{4})$/, "$1 $2 $3")` — **a las clases de carácter `\D` y `\d` les falta la barra invertida**, así que la primera no quita nada y la segunda nunca hace match (no hay letras «D»/«d» en un número de teléfono), por lo que `WHATSAPP_NUMERO` queda igual a los dígitos crudos. La función `enlaceWhatsapp()` (que sí arma el `href`) usa `\D` correctamente unas líneas más abajo, por eso el enlace no se rompió. | `docs/verificaciones/prod-2026-09-25/prod.spec.ts` › A › «Contacto…» y «Ayuda por WhatsApp…» (anotaciones `whatsapp-formato`, `whatsapp-ingresar-texto`); `lib/config.ts:7,10` | Media (cosmético; el enlace funciona) | `ga-funcionalidad-botones` |
| M-02 | Dominio raíz `greenallianceco.com` | Redirección permanente (308) a `https://www.greenallianceco.com/`, como exige el encargo | **Comportamiento inconsistente en la misma sesión de pruebas:** a las 19:41 GMT, `curl -I https://greenallianceco.com/` devolvió `308 Permanent Redirect` con `Location: https://www.greenallianceco.com/` (correcto). ~14 minutos después, 5 intentos seguidos por `curl` y la prueba de Playwright devolvieron **`200 OK` sirviendo el sitio completo directamente desde el dominio raíz**, sin redirigir (mismo `Content-Length` que `www`), con cabecera `Age` creciente (164 s → 379 s), es decir, una respuesta de la caché de borde de Vercel, no del origen en cada request. El dominio raíz resuelve a una IP de Vercel distinta (`216.198.79.1`) de la de `www` (`216.198.79.65`/`64.29.17.65`), consistente con un dominio «apex» de Vercel. No es un cambio de código de este repositorio (no hay ningún `redirect()`/`rewrite` para el dominio raíz en `next.config.mjs` ni en `proxy.ts`, y no se desplegó nada durante la prueba): revisar en el panel de Vercel → Project → Domains si `greenallianceco.com` sigue configurado como «Redirect to `www.greenallianceco.com`» o si quedó agregado también como dominio de producción (alias) del mismo deployment. Riesgo si queda así: contenido duplicado (SEO), y cualquier cookie de sesión fijada solo para `www.greenallianceco.com` no serviría si alguien entra por el dominio raíz. | `test-results/qa/produccion/resultados.json` (anotaciones `apex-domain` y `hallazgo` del test F); comandos `curl -I https://greenallianceco.com/` repetidos a las 19:41, 19:55, 19:57 y 20:00 GMT del 25-sep-2026 | Media (no es una filtración ni rompe el flujo, pero es justo lo que este encargo pidió confirmar) | **Ninguno de los dos agentes de código**: es configuración de Vercel/DNS, no del repositorio. Repórtese a Sebas/coordinador (P-64/6.4 en el plan). |
| M-03 | Pie de la landing (y `/politica-de-datos` §1) | Texto legal de vigilancia con el dato real de la cooperativa | Sigue el marcador de posición «[Vigilada por Supersolidaria — confirmar]», visible al público en producción (`lib/config.ts#TEXTO_VIGILANCIA`, ya marcado `TODO(pendiente-spec)`). No es un hallazgo nuevo (ya estaba en el plan como dato pendiente de la cooperativa), pero se confirma que sigue visible en producción real. | Anotación `vigilancia` en `resultados.json`; `a-landing-*.png` | Media (contenido legal incompleto, visible al público; no es código) | Dato pendiente de la cooperativa (no aplica a ninguno de los dos agentes; ya está en `docs/avances/plan.json`) |
| B-01 | Pie de la landing | — | `soporte@greenallianceco.com` se muestra como texto plano, sin `mailto:`. **No es un incumplimiento del diseño**: `design/Main.dc.html` también lo deja como `<span>` de texto plano, sin `<a>`. Se anota solo como oportunidad de mejora de UX (un correo clicable ahorra un copiar/pegar). | Anotación `contacto` en `resultados.json` | Baja | `ga-diseno-a-codigo` (si la cooperativa decide que sí debería ser clicable; hoy es fiel al diseño) |
| B-02 | `/ingresar` | Botón «Enviarme el código» con una cédula muy corta (3 dígitos) | Idealmente deshabilitado o con aviso inmediato antes de intentar enviar | El botón permanece habilitado con 3 dígitos (no se pulsó, por la regla de esta verificación); la validación real ocurre al enviar (cubierto ya por `tests/e2e/b-ingreso.spec.ts` contra Supabase local). Se deja como observación, no como fallo nuevo. | Anotación `cedula-corta` en `resultados.json` | Baja | `ga-funcionalidad-botones` (opcional) |

## Huecos `<Pendiente>` confirmados en `/politica-de-datos` (esperados, no son falla)

Confirmado visible en producción, resaltado en amarillo (`<mark>`), tal como anticipaba el encargo:
`[NIT]`, `[dirección y ciudad]`, `[fecha de publicación]`, `[número de días]`, `[plazo]`, `[plazo, p. ej. 10 años]`, `[país o región de los servidores]`, `[otra forma de verificar tu identidad, p. ej. en persona con tu asesor]`.

Coincide exactamente con los pendientes P-75 a P-81 de `docs/avances/plan.json` (NIT/dirección, fecha de vigencia, plazos de conservación, país de los servidores, alternativa sin selfie, revisión legal). No se abre un hallazgo nuevo por esto: es contenido pendiente de la cooperativa, ya rastreado.

## Botones «Pendiente» encontrados en producción (visibles, no rompen nada)

| Botón o dato | Estado actual verificado en producción |
|---|---|
| «Hablar con la cooperativa» / «Ayuda por WhatsApp» | Ya **no** está pendiente: `NEXT_PUBLIC_WHATSAPP` está configurado y el enlace `wa.me/573117241942` funciona en `/ingresar` (con el hallazgo cosmético M-01 en el texto mostrado). |
| «política de datos» en el checkbox de `/afiliacion` | Funciona: abre `/politica-de-datos` en pestaña nueva sin perder lo escrito en el formulario. El texto de la política sigue con huecos `<Pendiente>` (ver arriba). |
| «[N] días hábiles» en `/afiliacion/enviada` | No verificado en esta corrida (no se envió el formulario a propósito). Según `lib/config.ts`, ya se reemplazó por «4 horas o menos» (confirmado en la landing). |
| Texto de vigilancia («[Vigilada por Supersolidaria — confirmar]») | Sigue como marcador de posición, visible al público (hallazgo M-03). |
| Convenios en `/cuenta` («Pendiente-spec» en el mapa) | No verificado (requiere sesión real; fuera de las reglas de esta corrida). |

## Observación operativa (no es un hallazgo de la app)

Durante esta verificación, el árbol de trabajo local (rama `develop`, no lo que corre en producción) mostró cambios **sin confirmar** en `components/pantallas/Afiliacion.tsx` y `docs/avances/buzon.md` que no estaban al inicio de la sesión — aparentemente un fix en curso de otro agente (`ga-funcionalidad-botones` o `ga-diseno-a-codigo`) que retira `dominioEsperado`, cambia la etiqueta a «Correo electrónico» y simplifica el campo. Esto es coherente con el hallazgo A-01 de este informe (puede que ya se esté corrigiendo), pero **no se verificó** porque no está desplegado y no es responsabilidad de este agente tocar código de la app. Se avisa para que el supervisor de avances confirme quién está trabajando ahí y evite choques entre agentes.

## Qué no se pudo probar (bloqueado por las reglas de esta verificación, no por falta de entorno)

1. Envío real de `/afiliacion` (Enviar solicitud) → no se pulsó a propósito. Ya cubierto en local (`tests/e2e/d-afiliacion.spec.ts`).
2. Pedir/verificar un código real en `/ingresar` → `/ingresar/codigo` → no se hizo a propósito (evita generar tráfico OTP real hacia una cédula/correo real). Ya cubierto en local (`tests/e2e/b-ingreso.spec.ts`, `j-produccion.spec.ts`).
3. RLS de escritura, duplicados por cédula, doble clic, contenido de correos Resend → requieren sesión o inserciones; no se probaron contra producción. Ya cubiertos en local.
4. `/cuenta`, `/admin`, `/asesor`, `/cuenta/solicitar` con sesión real → no se probaron (se limitó a confirmar la redirección sin sesión). El plan ya tiene anotado P-82 (prueba manual con sesión real de los 3 administradores) como hecha por Sebas el 25-sep para `/admin`; falta lo mismo para `/asesor` y `/cuenta`/`/cuenta/solicitar` con un asociado real.

## Archivos de esta verificación

- `docs/verificaciones/prod-2026-09-25/playwright.config.ts` — configuración apuntando a `https://www.greenallianceco.com`, dos proyectos (escritorio 1280×800, celular 390×844 con `devices['iPhone 13']`).
- `docs/verificaciones/prod-2026-09-25/prod.spec.ts` — 29 casos × 2 proyectos (58 en total), organizados en A (landing), B (ingreso sin enviar), C (afiliación sin enviar), D (política de datos), E (rutas protegidas), F (dominio/404/cabeceras), G (accesibilidad/consola).
- `test-results/qa/produccion/` — capturas de pantalla completa, JSON de `axe`, cabeceras (`f-cabeceras.json`), resultado de Playwright (`resultados.json`) y trazas de la única prueba que queda en rojo (`playwright/`).
