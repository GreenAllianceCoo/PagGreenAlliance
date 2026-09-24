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
| «Sorteo del mes» (acceso rápido) | Definido (24-sep) | Del 1 al 5 del mes (hora de Colombia): destacado y animado, abre el modal. Fuera de esa ventana: deshabilitado con «Próximo sorteo: 1 de <mes>» (excepto si ya confirmó su boleta ese mes, que sigue pudiendo abrir el modal para verla). `components/sorteo/SorteoDelMes.tsx`. |
| Modal «Sorteo del mes» → «Quiero participar» | Definido (24-sep) | Server Action `participarSorteo` (`app/cuenta/actions-sorteo.ts`) → RPC `participar_sorteo()` → correo con el número (`lib/correo/sorteo.ts`, plantilla `RESEND_TEMPLATE_SORTEO_BOLETA`, docs/resend-plantillas.md §4). El número nunca llega al navegador; pasa al paso «confirmar» con el correo enmascarado. |
| Modal «Sorteo del mes» → «Confirmar» | Definido (24-sep) | Server Action `confirmarBoletaSorteo` → RPC `confirmar_boleta_sorteo()`. Si no coincide, muestra el error y los intentos restantes (tope 5, ver migración); al confirmar pasa al paso de celebración (confeti + número dígito por dígito, respeta `prefers-reduced-motion`). |
| Modal «Sorteo del mes»: cerrar (X, Esc, clic fuera) | Definido (24-sep) | Foco atrapado dentro del modal (`aria-modal`); al cerrar, el foco vuelve al botón «Sorteo del mes». |

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

## 7. Pantalla del asesor `/asesor` (requiere sesión con `rol = 'asesor'`; sin sesión → `/ingresar`, con sesión de otro rol → `/cuenta`)
Sin maqueta (no hay diseño para el asesor en `design/`): usa los mismos tokens, tarjetas y `Badge` de `/cuenta`, en componentes nuevos de `components/asesor/` (no se tocó `Cuenta.tsx` ni `EncabezadoCuenta.tsx`, que son zona de otro agente).
| Elemento | Estado | Comportamiento |
|---|---|---|
| Logo | Definido | → `/` |
| «Salir» (escritorio) / icono cerrar sesión (celular) | Definido | `supabase.auth.signOut()` → `/ingresar` (`app/asesor/actions.ts`, mismo mecanismo que `/cuenta`). |
| «Mis clientes» (tabla / tarjetas) | Definido | `select * from resumen_clientes_asesor()` (RLS + `SECURITY DEFINER`, autofiltrada por `auth.uid()`). Nunca celular, correo, Nequi ni fotos: `lib/asesor/resumen.ts` además filtra explícitamente los campos antes de pasarlos a la UI (defensa en profundidad). Tabla en `lg:`, tarjetas debajo de eso. |
| Buscador (nombre o cédula) | Definido | Filtro en el cliente sobre la lista ya cargada (sin acentos ni mayúsculas). |
| Filtro «Estado» | Definido | Desplegable con los estados que de verdad aparecen en la lista del asesor (afiliación pendiente/contactada/aprobada/rechazada, o crédito en revisión/aprobado/rechazado, o «Asociado sin solicitud»). |
| Estado vacío («Todavía no tienes clientes») | Definido | Cuando `resumen_clientes_asesor()` no devuelve filas. |
| «Ver cuenta de demostración» | Definido | → `/asesor/demo`. |

## 7b. Cuenta de demostración del asesor `/asesor/demo` (misma protección de rol que `/asesor`)
Decisión de la cooperativa (`docs/spec-fase-2.md` §5): «cuenta fantasma», **no guarda nada en la base**. Todos los datos del cliente son ficticios a propósito (`lib/asesor/datosDemo.ts`).
| Elemento | Estado | Comportamiento |
|---|---|---|
| Franja «Modo demostración: nada se guarda» | Definido | Visible en toda la pantalla, arriba del contenido. |
| Desplegable «Grado» | Definido | PP/PT/SI/IT/OF; al cambiarlo se recalculan tope, tasa y plazo con los datos que trajo la lectura de `grados_credito` (o, si esa lectura falla, con la copia de referencia en `lib/asesor/datosDemo.ts`). Es solo estado de React: no hay ida y vuelta al servidor al cambiar de grado. |
| «Nueva solicitud» (demo) | Definido | Mismo formulario y reglas que `/cuenta/solicitar` (50 %/100 %, mínimo $100.000, pasos de $50.000, tope del grado elegido). Al «enviarla» solo simula una carga breve y muestra una confirmación de ejemplo: no hay Server Action, no hay `insert`, no hay `fetch`. Cubierto por prueba unitaria que falla si la página llegara a llamar `insert`/`update`/`delete`/`upsert`/`rpc`. |
| «Volver a Mis clientes» | Definido | → `/asesor`. |

## 8. Panel de administración `/admin` (requiere sesión con `rol = 'admin'`; sin sesión → `/ingresar`, con sesión de otro rol → `/cuenta`)
Sin maqueta (no hay diseño en `design/`): usa los mismos tokens y componentes de `components/ui`, en un encabezado y componentes nuevos de `components/admin/` (coherente con `/cuenta`, pero sin tocar `Cuenta.tsx` ni `EncabezadoCuenta.tsx`). `proxy.ts` solo exige sesión en `/admin/:path*`; el ROL lo comprueba `exigirAdmin()` (`lib/admin/servidor.ts`) en cada página y cada Server Action.
| Elemento | Estado | Comportamiento |
|---|---|---|
| Logo | Definido | → `/admin` |
| Pestañas «Afiliaciones» / «Créditos» / «Asesores» / «Sorteo» | Definido | → `/admin/afiliaciones`, `/admin/creditos`, `/admin/asesores`, `/admin/sorteo`. |
| «Salir» | Definido | `supabase.auth.signOut()` → `/ingresar` (reusa `cerrarSesion` de `/cuenta`). |

### 8a. Afiliaciones `/admin/afiliaciones`
| Elemento | Estado | Comportamiento |
|---|---|---|
| Filtro por estado | Definido | Pendiente / contactado / aprobada / rechazada, con enlaces `?estado=`. |
| Fila de la lista | Definido | → `/admin/afiliaciones/[id]` (detalle). |
| Detalle: datos y 3 fotos | Definido | Todos los datos de la solicitud + fotos con URL firmada (`createSignedUrl`, ~180 s) generadas solo después de confirmar `rol = 'admin'` con la sesión normal (spec §3). |
| «Marcar como contactado» | Definido | `UPDATE solicitudes_afiliacion SET estado = 'contactado'` con la sesión del admin (RLS + trigger). |
| «Rechazar» | Definido (sin motivo) | Solo cambia `estado = 'rechazada'`: la tabla `solicitudes_afiliacion` no tiene columna `motivo_rechazo` (a diferencia de `solicitudes_credito`). **Pendiente-spec**: si la cooperativa quiere guardar el motivo del rechazo de una afiliación, hace falta una migración nueva (no es zona de este agente). |
| «Aprobar (crea la cuenta)» | Definido | `app/admin/afiliaciones/actions.ts#aprobarAfiliacion`: crea el usuario en Supabase Auth con el correo institucional (cédula y grado en `app_metadata`, nombre en `user_metadata`), asigna `perfiles.asesor_id` y `telefono`, marca la solicitud como aprobada y envía el correo «Ingreso aceptado» (Resend). Idempotente: aprobar dos veces no crea un segundo usuario. |

### 8b. Créditos `/admin/creditos`
| Elemento | Estado | Comportamiento |
|---|---|---|
| Filtro por estado | Definido | Pendiente / aprobado / rechazado. |
| Fila de la lista | Definido | Nombre, cédula, grado, monto, porcentaje, tasa y fecha (solo lectura). |
| «Aprobar» | Definido | `app/admin/creditos/actions.ts#resolverCredito`: valida con zod → la base vuelve a validar (nadie resuelve su propia solicitud, una resuelta no cambia) → envía el correo de resultado (`enviarResultadoCredito`). |
| «Rechazar» + motivo | Definido | El motivo es obligatorio (zod en el cliente y `solicitudes_motivo_rechazo_chk` en la base); si falta, error bajo el campo. |

### 8c. Asesores `/admin/asesores`
| Elemento | Estado | Comportamiento |
|---|---|---|
| «Registrar asesor» (cédula, nombres, apellidos, correo) | Definido | Crea el usuario en Supabase Auth (mismo mecanismo que un asociado) y, con la sesión del admin, cambia su `rol` a `asesor`. |
| Lista de asesores | Definido | Nombre, cédula y cuántos clientes (`perfiles.asesor_id`) y afiliaciones referidas (`solicitudes_afiliacion.asesor_id`) tiene cada uno. |
| Desactivar un asesor | **Pendiente-spec** | No hay columna `activo` en `perfiles` ni mecanismo descrito en la spec; falta confirmar con la cooperativa qué debe pasar (¿deja de aparecer en el desplegable de `/afiliacion`? ¿se reasignan sus clientes?). |

### 8d. Sorteo `/admin/sorteo`
| Elemento | Estado | Comportamiento |
|---|---|---|
| Selector de mes/año | Definido | Cambia `?anio=&mes=` en la URL; por defecto el mes actual en hora de Colombia. |
| Tabla de boletas confirmadas | Definido | Número, nombre, cédula y fecha de confirmación (`estado = 'confirmada'`, ordenadas por `fecha_confirmacion`). |
| Exportar a CSV | **Pendiente** (opcional) | No implementado en esta tanda; la spec lo marca como opcional. |
