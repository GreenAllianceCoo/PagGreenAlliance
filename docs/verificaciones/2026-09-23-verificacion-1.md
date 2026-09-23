APROBADO con 1 falla media para corregir. No hay fallas críticas ni altas. Todo lo Definido funciona.

# Verificación 1 · 2026-09-23 · ga-verificador-qa

Entorno: `next dev` en http://localhost:3000 con `.env.development.local`, que apunta a Supabase **local** (127.0.0.1:54321). Los códigos se leyeron de Mailpit en 127.0.0.1:54324. Navegador: Chrome instalado (`channel: "chrome"`). Proyectos: escritorio 1280×800 y celular 390×844 (iPhone 13).
No se usó producción ni `.env.local`. `tests/e2e/utils.ts` se niega a correr si la URL de Supabase no es local.

Cómo repetir:
```
export PATH="/c/Program Files/nodejs:$PATH"
npx supabase db reset        # opcional: base limpia (local)
npx playwright test -c tests/e2e
```
Resultado: **186 pasan, 2 fallan (es la misma falla en los dos tamaños), 10 se omiten a propósito** (pruebas que solo aplican a un tamaño y la revisión estática, que corre una sola vez).

## Tabla de fallos

| ID | Pantalla | Botón o regla | Esperado | Obtenido | Evidencia | Severidad | Agente que debe corregir |
|---|---|---|---|---|---|---|---|
| F-01 | `/afiliacion` (escritorio y celular) | «Enviar solicitud» con un error de validación (cliente o servidor) | Se conserva todo lo escrito, como pasa con nombre, cédula, celular, correo, unidad, mensaje y casilla | El select **«Grado» vuelve a «Selecciona tu grado»**. Si la persona corrige solo el campo con error y reenvía, ahora le sale «Selecciona tu grado.» | `tests/e2e/d-afiliacion.spec.ts` › «Checkbox sin marcar → error; lo escrito se conserva». Captura y traza en `test-results/playwright/d-afiliacion-D2-·-Reglas-d-a2d20-rror-lo-escrito-se-conserva-{escritorio,celular}/` | Media | `ga-funcionalidad-botones` |

### Pasos para reproducir F-01
1. Abrir http://localhost:3000/afiliacion.
2. Llenar: nombre «Laura Gómez Prueba», cédula «12» (inválida), Grado «PT», celular «3104567890», correo «laura.qa@correo.com», y marcar la autorización.
3. Pulsar «Enviar solicitud».
4. Aparece el error de la cédula, y todos los campos conservan su valor **menos «Grado»**, que queda en «Selecciona tu grado».
5. Pasa lo mismo cuando el error viene del servidor, por ejemplo con una cédula que ya tiene una solicitud pendiente (D6).

Causa probable: React 19 reinicia el `<form action>` después de cada acción. Los inputs vuelven a su `defaultValue`, que ya trae `valores.*`. El `<select>`, en cambio, vuelve a la opción marcada al montarse (vacía): `defaultValue` en `<select>` no cambia `defaultSelected` después del primer render. Opciones para corregirlo: `key` en el `<Select>` que cambie con `valores.grado_id`, `selected` en la `<option>` que corresponde, o un select controlado. En `components/pantallas/Afiliacion.tsx` y `app/afiliacion/FormularioAfiliacion.tsx`.

## Observaciones (no son fallas; para decidir)
- **O-01 (Baja, seguridad, para `ga-revisor-seguridad`):** `lib/servidor/limite.ts` toma la IP de `x-forwarded-for` sin validar. En Vercel el encabezado lo pone la plataforma. Detrás de otro proxy se podría falsear para esquivar el límite por IP; el límite por cédula sigue funcionando. No lo probé en ataque.
- **O-02 (Baja, visual):** «Reenviar código» deshabilitado se ve igual que habilitado (verde subrayado); solo cambia el cursor. El diseño tampoco define un estilo de deshabilitado. El contador «en 0:45» sí se muestra.
- **O-03 (informativa):** el indicador de desarrollo de Next mostró de forma pasajera «1 Issue» en `/cuenta` durante la tanda de capturas. No quedó ningún error en consola y no lo pude reproducir; solo existe en `next dev`.
- **Correos de Resend (D5):** bloqueado parcialmente. Sin `RESEND_API_KEY` se espera el log `afiliacion_correos_no_enviados` en la terminal de `next dev`, pero esa terminal no la lanzó QA y no se pudo leer. Sí se verificó que la solicitud se guarda y que la página responde bien.

## Pruebas que pasaron (no romper)

### A. Navegación (`a-navegacion.spec.ts`)
- Landing: Logo → `/`; anclas Apoyos/Historias/Convenios (escritorio) hacen scroll a `#c-*`; «Afíliate» → `/afiliacion`; «Mi cuenta» (escritorio) / «Ingresar» (celular) → `/ingresar`; «Solicitar crédito» → `/ingresar`; «Conocer la cooperativa» → `#c-apoyos`; «Quiero afiliarme» (celular) → `/afiliacion`; «Ver beneficios en mi cuenta» → `/ingresar`; 5 tarjetas de convenios visibles.
- Con sesión: «Solicitar crédito», «Mi cuenta»/«Ingresar» y «Ver beneficios» → `/cuenta`.
- `/ingresar`: Logo → `/`, «Deseo afiliarme» → `/afiliacion`. `/ingresar/codigo`: Logo → `/`, «Cambiar cédula» / flecha Volver → `/ingresar`.
- `/afiliacion`: Logo → `/`, «¿Ya eres asociado? Ingresa» / flecha → `/ingresar`; «política de datos» abre `/politica-de-datos` en otra pestaña.
- `/cuenta`: «Inicio» → `/cuenta`, «Convenios» → `#convenios`, «Nueva solicitud» (nav, accesos y estado vacío) → `/dashboard/solicitar` y su «Volver» → `/cuenta`, tarjetas `href="#"` no rompen, Logo → `/`.
- `/afiliacion/enviada`: «Volver al inicio» → `/`.
- Sin 404: todas las rutas públicas y todos sus enlaces internos responden < 400.

### B. Ingreso (`b-ingreso.spec.ts`)
- Cédula con letras, de 5 dígitos, de 11 dígitos o vacía → error, foco en el campo, no navega. `inputmode=numeric`, `autocomplete=username`.
- Cédula registrada y no registrada → mismo mensaje, misma pantalla (texto idéntico salvo el correo enmascarado) y tiempo parecido: 1766 vs 1746 ms en escritorio y 1784 vs 1732 ms en celular (diferencia de 20–52 ms).
- El HTML y **todas** las respuestas de red no contienen el correo completo; solo `si•••@greenalliance.test`. La cédula no registrada muestra un correo de relleno con la misma forma. La cookie `ga_ingreso` es httpOnly, está cifrada y no lleva `@`; la URL no lleva datos.
- Código de 6 casillas: deshabilitado hasta tener 6 dígitos, avanza solo, Backspace retrocede, pegar llena todo, no acepta letras, `one-time-code` en la primera.
- Código incorrecto → «El código no es válido o ya venció» y casillas vacías; código correcto (de Mailpit) → `/cuenta`, se borra la cookie y `/ingresar` con sesión → `/cuenta`. Con cédula no registrada, cualquier código da el mismo error.
- «Reenviar código» deshabilitado con el contador, habilitado a los 45 s; al pulsarlo reinicia el contador y anuncia el reenvío.
- «Cambiar cédula»/Volver borra la cookie; `/ingresar/codigo` directo o con cookie manipulada → `/ingresar`.
- Estado de carga «Enviando…» con el botón deshabilitado.

### C. Cuenta (`c-cuenta.spec.ts`)
- `/cuenta` y `/dashboard/solicitar` sin sesión → `/ingresar`.
- Asociado 1234567890: nombre, «En revisión», $ 500.000, 50%, «Interés mensual: 7,9 %», sin «cuota», tope $ 2.100.000 (PP) y ningún dato de la otra asociada.
- Asociada 1234567891: estado vacío, tope $ 3.000.000 (SI) y no ve la solicitud del otro asociado.
- RLS con token de asociado: no ve solicitudes ni perfiles ajenos, y no puede cambiar su `nombre_completo`.
- Mis datos: un solo campo editable (celular). «2001234567» → error y foco; un número válido se guarda («Guardamos tu celular.») y sigue ahí al recargar.
- «Salir» (escritorio) / «Cerrar sesión» (celular) → `/ingresar`. Al volver atrás no aparece nombre ni cédula, `/cuenta` → `/ingresar` y no quedan cookies `sb-*`.

### D. Afiliación (`d-afiliacion.spec.ts`)
- Envío vacío → error en nombre, cédula, grado, celular, correo y autorización; ninguno en los opcionales; foco en el nombre; `aria-describedby` enlazado.
- Reglas: nombre 2 ✗ / 3 ✓ / 120 ✓ / 121 ✗; cédula 5 ✗ / 6 ✓ / 10 ✓ / 11 ✗ / con letras ✗ / con puntos ✓ (se normaliza); grado vacío ✗; unidad 120 ✓ / 121 ✗; celular que empieza por 2 ✗ / de 9 dígitos ✗ / 10 dígitos con 3 ✓; correo «laura@» ✗ / sin arroba ✗ / válido ✓; mensaje 500 ✓ / 501 ✗; autorización sin marcar ✗.
- Select «Grado»: `["", PP, PT, SI, IT, OF]`.
- Envío válido → `/afiliacion/enviada` con `la•••@correo.com`. La fila queda `pendiente`, con `acepto_datos_at` lleno, correo en minúsculas («  Laura.QA@Correo.COM » → `laura.qa@correo.com`), cédula sin puntos y celular «+57 310 456 7890» → `3104567890`.
- Misma cédula pendiente → «Ya tenemos una solicitud pendiente con esta cédula…» y sigue habiendo una sola fila.
- Campo trampa: está fuera de pantalla, con `tabindex=-1` y `aria-hidden`. Si llega lleno, responde como éxito y no guarda nada.
- Doble clic → una sola fila. Estado «Enviando…» con el botón deshabilitado.
- `/afiliacion/enviada` directo → `/afiliacion`.
- RLS: con la clave anon y con token de asociado no se puede leer ni insertar en `solicitudes_afiliacion`.

### E. Fidelidad al diseño (`e-diseno.spec.ts`)
Las 6 pantallas en los 2 tamaños tienen los textos del `.dc.html` en el mismo orden. Primarios en verde `#1E6652`; secundarios con borde navy `#1A3C57` de 1.5px; «Hablar con la cooperativa» con borde verde; fuente Manrope cargada. En escritorio, afiliación va en 2 columnas y «Enviar solicitud» queda a la derecha del texto. Las capturas están en `test-results/qa/*.png`.

### F. Accesibilidad (`f-accesibilidad.spec.ts`)
- axe (WCAG 2.1 A/AA) no encontró **ninguna violación** en `/`, `/ingresar` (normal y con error), `/ingresar/codigo`, `/afiliacion` (vacía y con errores), `/afiliacion/enviada`, `/cuenta` ni `/politica-de-datos`. El detalle está en `test-results/qa/axe-*.json`.
- Todos los campos tienen label.
- Con teclado: el ingreso completo se hace con Tab y Enter. En afiliación el orden de Tab sigue el orden visual de cada tamaño, Espacio marca la casilla y el campo trampa queda fuera del orden. En `/cuenta` se llega con Tab a «Nueva solicitud», «Guardar» y «Salir»/«Cerrar sesión», y el foco se ve siempre.

### G. Revisión estática (`g-estatico.spec.ts`)
- `SUPABASE_SERVICE_ROLE_KEY` solo aparece en `lib/supabase/admin.ts` (`server-only`), nunca en archivos `'use client'`, y ningún archivo cliente importa módulos del servidor.
- No hay `console.log`, y los registros no incluyen correo, cédula ni celular.
- No quedan `ju•••@correo.com`, `[Nombre]`, `[TOPE]`, `[MONTO]` ni `[PLAZO]` en las pantallas. Solo están en `lib/mock.ts`, y de ahí la landing usa únicamente cifras y testimonios de ejemplo (Pendiente).

## Botones y datos Pendientes (visibles, no rompen)
| Elemento | Estado actual |
|---|---|
| «Ayuda por WhatsApp [NÚMERO]» (`/ingresar`), «¿Cambiaste de correo?… [NÚMERO]» (`/ingresar/codigo`), pie de la landing | Se ve el texto sin enlace porque falta `NEXT_PUBLIC_WHATSAPP` |
| «Hablar con la cooperativa» (`/cuenta`) | Sin enlace, con `aria-disabled` y opacidad reducida |
| «[N] días hábiles» (`/afiliacion/enviada`) | Muestra «[N]» (`DIAS_RESPUESTA`) |
| «política de datos» → `/politica-de-datos` | Página provisional con el texto pendiente |
| Tarjetas de convenios en `/cuenta` | `href="#"`; no rompen la página |
| Cifras, testimonios, correo de contacto y texto de vigilancia de la landing | Datos de ejemplo del diseño |
| Grado en «Mis datos» y en el select de afiliación | Muestra el código (PP, SI…), no el nombre completo |
