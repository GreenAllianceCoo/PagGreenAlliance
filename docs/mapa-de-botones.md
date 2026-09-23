# Mapa de botones y enlaces — Green Alliance

Fuente única de verdad para los agentes `ga-funcionalidad-botones` (implementa) y `ga-verificador-qa` (prueba).
Sacado de las pantallas en `design/` + `docs/spec-afiliacion-y-login.md`.

Estados:
- **Definido** → el comportamiento está en la spec; se implementa y se prueba.
- **Pendiente** → aparece en el diseño pero la spec no dice qué hace. No se inventa: se deja visible, deshabilitado o con `href="#"` + comentario `// TODO(pendiente-spec)`, y se reporta.

## Rutas del diseño → rutas de Next.js
| Archivo de diseño (PC / Móvil) | Ruta |
|---|---|
| `Main.dc.html` / `Landing-Movil.dc.html` | `/` |
| `Ingreso-PC.dc.html` / `Ingreso-Movil.dc.html` | `/ingresar` |
| `Codigo-PC.dc.html` / `Codigo-Movil.dc.html` | `/ingresar/codigo` |
| `Inicio-PC.dc.html` / `Inicio-Movil.dc.html` | `/cuenta` (protegida) |
| (sin diseño; usa los componentes y tokens de Inicio) | `/cuenta/solicitar` (protegida) |
| `Afiliacion-PC.dc.html` / `Afiliacion-Movil.dc.html` | `/afiliacion` |
| `Enviada-PC.dc.html` / `Enviada-Movil.dc.html` | `/afiliacion/enviada` |
| `Afiliacion-Spec.dc.html` | (no es pantalla; es documentación) |
| `Logo.dc.html` | componente `<Logo tone="light|dark" />` |

## 1. Landing `/`
| Elemento | Dónde | Estado | Comportamiento |
|---|---|---|---|
| Logo | header | Definido | → `/` |
| «Apoyos» / «Historias» / «Convenios» | nav escritorio | Definido | Scroll a `#c-apoyos`, `#c-historias`, `#c-convenios` |
| «Afíliate» | nav escritorio | Definido | → `/afiliacion` |
| «Mi cuenta» (escritorio) / «Ingresar» (celular) | header | Definido | → `/ingresar` (si ya hay sesión → `/cuenta`) |
| «Solicitar crédito» | hero | Definido | → `/ingresar` (si ya hay sesión → `/cuenta`) |
| «Conocer la cooperativa» | hero escritorio | Definido | Scroll a `#c-apoyos` |
| «Quiero afiliarme» | hero celular | Definido | → `/afiliacion` |
| «Ver beneficios en mi cuenta» | sección convenios | Definido | → `/ingresar` (o `/cuenta` con sesión) |
| Tarjetas de convenios | sección convenios | Definido (solo lectura) | Datos desde tabla `convenios` (emoji, nombre, especialidad) |

## 2. Ingreso paso 1 `/ingresar`
| Elemento | Estado | Comportamiento |
|---|---|---|
| Logo | Definido | → `/` |
| Input «Número de cédula» | Definido | Solo dígitos, 6–10. `inputmode="numeric"`, `autocomplete="username"` |
| «Enviarme el código» | Definido | Server Action: busca cédula en `perfiles` → `signInWithOtp({ email, options:{ shouldCreateUser:false } })`. **Siempre** responde igual («Si tu cédula está registrada, te enviamos un código») y navega a `/ingresar/codigo`, exista o no la cédula. Guarda el correo enmascarado (y una referencia segura para el paso 2) en cookie httpOnly firmada; nunca el correo completo en la URL ni en el cliente. Estado de carga: botón deshabilitado + «Enviando…». |
| «Deseo afiliarme» | Definido | → `/afiliacion`. Siempre visible. |
| «Ayuda por WhatsApp [NÚMERO]» | Pendiente (número) | Enlace `https://wa.me/57<NÚMERO>` leído de `NEXT_PUBLIC_WHATSAPP`; si no existe la variable, texto sin enlace. |

## 3. Ingreso paso 2 `/ingresar/codigo`
| Elemento | Estado | Comportamiento |
|---|---|---|
| 6 casillas del código | Definido | Un dígito por casilla, avance automático, retroceso con Backspace, pegar 6 dígitos llena todas, `autocomplete="one-time-code"` en la primera. |
| «Entrar a mi cuenta» | Definido | `verifyOtp({ email, token, type:'email' })` → `/cuenta`. Error genérico si falla: «El código no es válido o ya venció». Deshabilitado hasta tener 6 dígitos. |
| «Reenviar código» + contador | Definido | Deshabilitado mientras corre el contador (45 s). Al pulsar, repite el envío del paso 1 y reinicia el contador. |
| «Cambiar cédula» (escritorio) / flecha volver (celular) | Definido | → `/ingresar` y limpia la cookie del paso 1. |
| Texto correo enmascarado | Definido | Muestra `ju•••@correo.com` desde la cookie. Si no hay cookie → redirige a `/ingresar`. |
| «WhatsApp [NÚMERO]» | Pendiente (número) | Igual que en paso 1. |

## 4. Inicio del asociado `/cuenta` (requiere sesión; sin sesión → `/ingresar`)
| Elemento | Estado | Comportamiento |
|---|---|---|
| «Hola, [Nombre]» | Definido | Nombre desde `perfiles`. |
| Tarjeta «Tu solicitud» | Definido | Última fila de `solicitudes_credito` del usuario (RLS). Si no tiene → estado vacío. |
| [TOPE] | Definido | Tope según `grados_credito` del grado del perfil. |
| «Inicio» (nav) | Definido | → `/cuenta` |
| «Salir» (escritorio) / icono cerrar sesión (celular) | Definido | `supabase.auth.signOut()` → `/ingresar` |
| «Nueva solicitud» (nav + acceso rápido + estado vacío) | Definido (23-sep) | → `/cuenta/solicitar`. |
| «Convenios» (nav + acceso rápido) | **Pendiente** | ¿Scroll a la sección «Tus convenios» o página propia? Por ahora scroll a `#convenios`. Confirmar. |
| «Hablar con la cooperativa» | Pendiente (número) | `https://wa.me/57<NÚMERO>` con `NEXT_PUBLIC_WHATSAPP`. |
| Tarjetas de convenios | **Pendiente** | Solo lectura; no hay página de detalle definida. |

## 4b. Solicitud de crédito `/cuenta/solicitar` (requiere sesión; sin sesión → `/ingresar`)
Sin maqueta: usa el encabezado, las tarjetas y los cuadros grises de `/cuenta`. Las rutas viejas `/login` y `/dashboard` (incluida `/dashboard/solicitar`) se borraron el 23-sep.
| Elemento | Estado | Comportamiento |
|---|---|---|
| Encabezado (logo, «Inicio», «Nueva solicitud», «Convenios», «Salir») | Definido | Igual que en `/cuenta`; «Nueva solicitud» marcada como actual; «Convenios» → `/cuenta#convenios`. |
| Flecha volver | Definido | → `/cuenta` |
| «50% / 100% de devolución» | Definido | Elige el paquete de `grados_credito` del grado del perfil; pone el monto en el tope de ese paquete. |
| Monto (deslizador) | Definido | Mínimo $100.000, máximo el tope del paquete, pasos de $50.000. |
| Interés mensual y plazo | Definido | Del paquete elegido (`tasa_interes_mensual`, `plazo_meses`). No se calcula la cuota. |
| «Enviar solicitud» | Definido | Server Action `crearSolicitud`: valida porcentaje, monto mínimo, tope y que no haya otra pendiente → insert con la sesión (RLS; el trigger `chk_monto_solicitud` vuelve a validar) → redirect a `/cuenta`. Deshabilitado mientras envía; error bajo el campo o general, con foco. |
| Sin grado / con solicitud pendiente / sin topes | Definido | Muestra el aviso y «Volver a mi cuenta» (→ `/cuenta`) en lugar del formulario. |

## 5. Afiliación `/afiliacion`
| Elemento | Estado | Comportamiento |
|---|---|---|
| Logo (escritorio) | Definido | → `/` |
| «¿Ya eres asociado? Ingresa» (escritorio) / flecha volver (celular) | Definido | → `/ingresar` |
| Select «Grado» | Definido | Opciones desde `grados_credito`. |
| Campos | Definido | Validación según tabla de la spec, en cliente **y** servidor (mismo esquema zod). Errores bajo cada campo, en español, enlazados con `aria-describedby`. |
| Campo trampa (honeypot) | Definido | Oculto a personas (no `display:none` simple; fuera de pantalla + `tabindex=-1` + `aria-hidden`). Si viene lleno → responder «éxito» sin guardar. |
| Checkbox autorización de datos | Definido | Obligatorio; se guarda `acepto_datos_at = now()`. |
| «política de datos» | **Pendiente** (texto) | → `/politica-de-datos` (página placeholder hasta tener el texto). |
| «Enviar solicitud» | Definido | Server Action: valida → límite por IP y por cédula → verifica que no haya otra solicitud `pendiente` con esa cédula → insert con service role → redirect a `/afiliacion/enviada`. Estado de carga y protección contra doble clic. |

## 6. Afiliación enviada `/afiliacion/enviada`
| Elemento | Estado | Comportamiento |
|---|---|---|
| Correo enmascarado | Definido | Desde cookie/flash de la acción anterior. Si se entra directo sin enviar → redirige a `/afiliacion`. |
| «Volver al inicio» | Definido | → `/` |
| [N] días hábiles | Pendiente (dato) | Constante `DIAS_RESPUESTA` en config. |
