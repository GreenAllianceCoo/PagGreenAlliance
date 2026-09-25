NO APROBADO PARA PRODUCCIÓN

# Verificación 3 · 2026-09-23 · ga-verificador-qa

Verificación de punta a punta antes de producción. Rama `develop`, commit `bf09975` (solicitud de crédito en `/cuenta/solicitar`, límites con HMAC, borrado de `/login` y `/dashboard`).

Entorno: `next dev` en http://localhost:3000 contra Supabase **local** (Docker, `.env.development.local`), después de `npx supabase db reset`. Códigos de ingreso leídos de Mailpit (127.0.0.1:54324). Chrome instalado. Proyectos: escritorio 1280×800 y celular 390×844. No se tocó producción ni la URL de Vercel.

## Resultado

| Suite | Resultado |
|---|---|
| Vitest (unitarias) | 140 / 140 pasan |
| pgTAP (`supabase test db`) | 143 / 143 pasan |
| `tsc --noEmit` y `eslint .` | sin errores |
| Playwright, corrida final (`npx playwright test -c tests/e2e`) | **236 pasan, 5 fallan, 29 se omiten** (pruebas de un solo tamaño y revisiones estáticas) |
| Prueba Z (fuerza bruta del código, `QA_LIMITE_VERIFICACION=1`) | pasa, pero confirma el hallazgo F-02 |

Los 5 fallos de la corrida final son hallazgos reales de la app (F-01, F-03, F-04 ×2, F-05). No queda ningún fallo de las pruebas.

### Por pantalla

| Pantalla | Resultado |
|---|---|
| Landing `/` y navegación | Pasa: anclas, «Afíliate», «Mi cuenta/Ingresar», «Solicitar crédito», «Ver beneficios» (con sesión → `/cuenta`), convenios de solo lectura, ningún enlace da 404. Muestra marcadores de contenido pendientes (ver Bloqueos). |
| `/ingresar` | Pasa: validación 6–10 dígitos, mismo mensaje y misma pantalla exista o no la cédula, tiempo parecido (paso 1 ≥ 1,5 s; paso 2: 201 ms frente a 163 ms), «Deseo afiliarme», estado «Enviando…». **Falla F-01** (el correo enmascarado deja deducir si la cédula existe). |
| `/ingresar/codigo` | Pasa: casillas (teclear, pegar, Backspace), botón deshabilitado hasta 6 dígitos, error genérico, código correcto → `/cuenta`, «Reenviar» deshabilitado 45 s (el servidor lo vuelve a frenar aunque se habilite el botón a mano), código viejo inválido tras reenviar, «Cambiar cédula»/volver borra la cookie, entrada directa y cookie vencida o manipulada → `/ingresar`. **Falla F-02** (sin tope de intentos de código). |
| Límites de intentos | Pasa: 1 código cada 45 s por cédula (también desde otro navegador), 5 por cédula en 15 min, 20 por IP en 15 min: misma pantalla y sin correo. Afiliación: 5 por hora por IP y 3 por día por cédula. |
| `/cuenta` | Pasa: sin sesión → `/ingresar`; nombre, solicitud, tasa y tope solo del propio usuario; RLS; «Mis datos»: celular válido se guarda, inválido (no empieza por 3, 9 u 11 dígitos, letras) da error con foco; no se puede cambiar el nombre ni el teléfono de otro por API; «Salir» cierra la sesión y «atrás» no muestra datos. |
| `/cuenta/solicitar` | Pasa: título, 50 % / 100 %, deslizador (mínimo $100.000, tope del grado, pasos de $50.000, teclado), tasa y plazo del grado, sin cuota; envío válido → `/cuenta`; doble clic → una fila; con pendiente → aviso y «Volver a mi cuenta»; perfil sin grado → aviso; el servidor rechaza monto < $100.000, sobre el tope, no numérico y porcentaje inválido; la base rechaza solicitudes a nombre de otro, una segunda pendiente, autoaprobación y tasa manipulada. **Fallan F-03** (celular sin «Cerrar sesión») y F-06/F-07 (bajas). |
| `/afiliacion` y `/afiliacion/enviada` | Pasa: todas las reglas de la tabla de la spec, foco en el primer error, correo en minúsculas, cédula con puntos normalizada, grados desde `grados_credito`, fila `pendiente` con `acepto_datos_at`, segunda pendiente rechazada conservando lo escrito, campo trampa (éxito sin fila), doble clic (una fila), entrada directa a `/enviada` → `/afiliacion`, RLS (anon y authenticated no leen ni insertan). |
| `/politica-de-datos` | Pasa: responde 200, título y logo → `/`, se abre desde la afiliación. El texto es un marcador de posición (ver Bloqueos). |
| `/login`, `/dashboard`, `/dashboard/solicitar` | Pasa: responden 404, no existen en `app/` y ninguna página pública ni privada enlaza a ellas. **Falla F-04** (la 404 es la de Next.js en inglés). |
| Privacidad | Pasa: el HTML y la red del paso 2 solo traen el correo enmascarado; `/cuenta` y `/cuenta/solicitar` no traen el correo completo ni datos del otro asociado; el log de `next dev` no tiene correos ni cédulas de los asociados; no hay `console.log`; `SUPABASE_SERVICE_ROLE_KEY` no aparece en archivos `'use client'`. **Fallan F-01 y F-05.** |
| Accesibilidad | Pasa: axe sin violaciones serias ni críticas en todas las pantallas (incluidas `/cuenta/solicitar` y el aviso de pendiente); se usa solo con teclado; foco visible; todos los campos con label. |
| Diseño | Pasa: textos y orden contra los `.dc.html`, verde `#1E6652`, navy `#1A3C57`, Manrope. Capturas en `test-results/qa/`. |

## Fallos

| ID | Pantalla | Botón o regla | Esperado | Obtenido | Evidencia | Severidad | Corrige |
|---|---|---|---|---|---|---|---|
| F-01 | `/ingresar/codigo` | Privacidad: «nunca revela si una cédula existe» (spec §1) | El correo enmascarado de una cédula registrada no se distingue del de relleno | Las cédulas no registradas solo muestran `gmail.com`, `hotmail.com`, `outlook.com` o `yahoo.com` (`lib/mascara.ts#correoDeRelleno`). Una registrada muestra su dominio real (`si•••@greenalliance.test`). Si el asociado usa otro dominio (p. ej. uno institucional), se sabe que la cédula existe. | `tests/e2e/j-produccion.spec.ts` › J1; `test-results/qa/j1-mascaras.json` | Crítica (filtra la existencia de la cédula) | `ga-funcionalidad-botones` (+ decisión de producto) |
| F-02 | `/ingresar/codigo` | «Entrar a mi cuenta»: límite de intentos | Tope de códigos equivocados por cédula/IP (p. ej. 5 por código) | 60 códigos equivocados seguidos para la misma cédula en ~40 s, todos respondidos (403 `otp_expired`), ninguno frenado; la app no llama a `dentroDelLimite` en `verificarCodigoIngreso`. En local, Supabase Auth tampoco frenó. En producción Supabase ve la IP del servidor (Vercel): su límite `token_verifications` o no aplica o se reparte entre todos los usuarios. | `tests/e2e/z-limite-verificacion.spec.ts` (`QA_LIMITE_VERIFICACION=1 QA_INTENTOS=60`); `test-results/qa/z-limite-verificacion-60.json` | Alta | `ga-funcionalidad-botones` (revisión de `ga-revisor-seguridad`) |
| F-03 | `/cuenta/solicitar` (celular) | «Salir» / ícono cerrar sesión (mapa §4b: «igual que en /cuenta») | Ícono «Cerrar sesión» en celular, como en `/cuenta` | `EncabezadoCuenta` oculta «Salir» por debajo de `lg` y el ícono de `/cuenta` está en el cuerpo de `Cuenta.tsx`: en celular no hay forma de salir desde `/cuenta/solicitar` (solo volver a `/cuenta`). | J3 › «Salir» desde `/cuenta/solicitar` [celular]; `test-results/qa/i-cuenta-solicitar-celular.png` | Media | `ga-diseno-a-codigo` |
| F-04 | 404 (`/login`, `/dashboard`, cualquier ruta inexistente) | Página de error | 404 en español, con marca y enlace al inicio | Página por defecto de Next.js: «404 · This page could not be found.», sin logo ni enlace (no existe `app/not-found.tsx`). | J4 › 404; `test-results/qa/j4-404-escritorio.png`, `j4-404-celular.png` | Media | `ga-diseno-a-codigo` |
| F-05 | Todas | Protección contra clickjacking | `X-Frame-Options: DENY` o CSP `frame-ancestors 'none'` | Ninguna de las dos cabeceras (`next.config.mjs` no define `headers()`); `/ingresar` y `/cuenta` se pueden incrustar en un iframe de otro sitio. | J4 › cabeceras; `test-results/qa/j4-cabeceras.json` | Media | `ga-funcionalidad-botones` (revisión de `ga-revisor-seguridad`) |
| F-06 | `/cuenta/solicitar` | Monto: «pasos de $50.000» (mapa §4b) | El servidor rechaza montos que no son múltiplos de $50.000 | Con el formulario manipulado se guarda una solicitud de $123.457 (ni la acción ni el trigger lo validan). | I2 › «monto que no es múltiplo»; `test-results/qa/i-monto-no-multiplo.json` | Baja | `ga-funcionalidad-botones` |
| F-07 | `/cuenta/solicitar` (celular 390) | Tarjetas «50% / 100% de devolución» | Texto centrado dentro de la tarjeta | El texto se parte en dos líneas y queda pegado al borde izquierdo y superior (alto fijo `h-13.5`, sin relleno horizontal). | `test-results/qa/i-cuenta-solicitar-celular.png` | Baja | `ga-diseno-a-codigo` |
| F-08 | `/ingresar/codigo` | «Reenviar código» | Lo que la persona escribe mientras se reenvía se conserva, o no se puede escribir | El reenvío tarda ≥ 1,5 s a propósito; al terminar, `setDigitos(VACIO)` borra lo que se pegó o escribió en ese intervalo. Si el correo llega muy rápido y la persona pega el código enseguida, lo pierde. | Traza de la prueba I4 (antes de ajustarla); `app/ingresar/codigo/FormularioCodigo.tsx` | Baja | `ga-funcionalidad-botones` |

### Cómo reproducir
- **F-01:** en `/ingresar`, escribir varias cédulas inexistentes (p. ej. 1000000001, 2233445566) → el paso 2 siempre muestra `xx•••@gmail|hotmail|outlook|yahoo.com`. Escribir 1234567891 → muestra `si•••@greenalliance.test`. Un dominio que no está en esa lista significa «cédula registrada».
- **F-02:** pedir código para 1234567890, pegar 000000, «Entrar», y repetir 60 veces con códigos distintos: nunca aparece un bloqueo ni un mensaje de espera.
- **F-03:** en 390 px, entrar con 1234567891 → «Nueva solicitud» → no hay botón de cerrar sesión.
- **F-04:** abrir `/login`.
- **F-05:** `curl -I http://localhost:3000/ingresar`: no hay `x-frame-options` ni `content-security-policy`.
- **F-06:** en `/cuenta/solicitar`, cambiar con las herramientas del navegador el valor enviado de `monto` a 123457 → se guarda.
- **F-07:** ver `/cuenta/solicitar` a 390 px.
- **F-08:** en el paso 2, cuando «Reenviar código» esté habilitado, pulsarlo y pegar un código en menos de 1,5 s → las casillas quedan vacías.

## Botones Pendientes (visibles y no rompen nada)
| Botón o dato | Estado actual |
|---|---|
| WhatsApp en `/ingresar`, `/ingresar/codigo` y `/cuenta` («Hablar con la cooperativa») | Texto «[NÚMERO]» sin enlace (falta `NEXT_PUBLIC_WHATSAPP`) |
| «política de datos» (afiliación) | Abre `/politica-de-datos` en otra pestaña; el texto es un marcador |
| «Convenios» (nav y accesos de `/cuenta`) | Scroll a `#convenios`; desde `/cuenta/solicitar` → `/cuenta#convenios` |
| Tarjetas de convenios en `/cuenta` | Solo lectura |
| [N] días hábiles en `/afiliacion/enviada` | «[N]» |
| Nombre del grado en «Mis datos» | Código (PP, PT, SI, IT, OF) |

## Qué bloquea pasar a producción
1. **F-01 (crítica):** el ingreso deja deducir qué cédulas están registradas. Hay que decidir cómo mostrar el correo: p. ej. no mostrarlo («Te enviamos un código a tu correo registrado») o enmascarar también el dominio de forma que el relleno sea indistinguible.
2. **F-02 (alta):** no hay tope de intentos al verificar el código.
3. **Contenido legal y público con marcadores** (visible para cualquiera en la landing): «[Vigilada por Supersolidaria — confirmar]», «[correo]@greenallianceco.com», cifras «[N]» y «[TIEMPO]», testimonios «[Testimonio real…] / [Nombre], [grado] · asociado desde [año]», WhatsApp «[NÚMERO]» y «[N] días hábiles». **La política de tratamiento de datos es un marcador**, y el formulario de afiliación recoge datos personales con una autorización que remite a ella (Ley 1581 de 2012). Lo deben entregar la cooperativa y `ga-diseno-a-codigo`.
4. **Configuración de producción (no se puede verificar desde local; revisar en el panel):** Supabase Auth con SMTP propio (Resend) — sin él, Supabase envía solo 2 correos por hora —, plantilla con `{{ .Token }}`, vencimiento de 600 s (P-45); `INGRESO_COOKIE_SECRET` y `LIMITE_HMAC_SECRET` en Vercel; migraciones pendientes de producción (6.8 / P-43 y 6.10 / P-09).
5. **Operación:** ni la afiliación ni la solicitud de crédito avisan al equipo (por decisión de la spec) y no hay panel de administrador: alguien tiene que revisar las tablas a mano. Conviene confirmarlo antes de abrir al público.

F-03 a F-05 no bloquean por sí solos, pero son rápidos de corregir y conviene hacerlo antes de salir. F-06 a F-08 pueden esperar.

## Observaciones (no son fallas)
- **O-01 (sigue abierta):** el límite por IP usa `x-forwarded-for`; en local se falsifica con un encabezado (las pruebas I3 lo aprovechan). En Vercel depende de que la plataforma sobrescriba el encabezado. Que lo confirme `ga-revisor-seguridad`.
- D6 falló una vez en celular y pasó en las otras dos corridas: en local todas las peticiones comparten IP, y el otro agente (responsive) usaba el mismo servidor, así que el límite de 5 afiliaciones por hora por IP se puede agotar. No es un error de la app.
- En `/afiliacion`, «Ya tenemos una solicitud pendiente con esta cédula» deja saber que alguien pidió afiliación con esa cédula. Es lo que pide el encargo (D6); se deja anotado.
- «Salir» usa `signOut()` con alcance global: cierra la sesión del asociado en todos sus dispositivos.
- Cuando la base falla, el límite de intentos deja pasar (M-1, decisión documentada en `lib/servidor/limite.ts`).

## Cambios en las pruebas
- Nuevo `tests/e2e/j-produccion.spec.ts`: J1 (máscara y existencia de la cédula; «Reenviar» con cédula no registrada), J2 (teléfono: RLS contra otro perfil y más casos inválidos), J3 (perfil sin grado; «Salir» desde `/cuenta/solicitar`), J4 (404 y cabeceras anti-clickjacking), J5 (escribir y pegar el código después de «Reenviar»).
- `d-afiliacion.spec.ts` (D5) y `h-credito.spec.ts`: ya no esperan registros de correos. Según la spec §2 y `docs/resend-plantillas.md`, ni la afiliación ni la solicitud de crédito envían correo. Solo se comprueba que el log no tenga datos personales.
- `i-despliegue.spec.ts`: I3 busca el correo enmascarado en toda la página (en escritorio está en el panel verde, fuera de `<main>`); I4 espera la respuesta final del reenvío (el texto «Enviando un código nuevo…» cumplía la condición antes de tiempo); I6 solo exige que no haya `[Nombre]` ni `[TOPE]` en las páginas del asociado. Los marcadores de la landing se reportan como bloqueo de contenido.
- `z-limite-verificacion.spec.ts`: espera la respuesta de cada intento (antes se adelantaba con el mensaje de error del intento anterior); `QA_INTENTOS` permite cambiar la cantidad de intentos.

Resultados: `test-results/qa/corrida-final.txt`, `test-results/qa/resultados.json`, capturas y JSON en `test-results/qa/`, trazas de fallos en `test-results/playwright/`.
