# Pedidos de diseño · lienzo C+

Bandeja de lo que falta en `docs/Green Alliance C+.dc.html`. Cualquier agente (`ga-*`) o la sesión principal puede **agregar** un pedido al final; solo `ga-disenador-lienzo` los marca como resueltos.

Formato de cada pedido:

```
### D-NN · <pieza> · <ruta>
- Pedido por: <agente> · <fecha>
- Prioridad: alta | media | baja
- Qué falta: <pantalla, estado o sección>
- Datos y reglas: <campos, estados, textos, reglas de negocio o de la spec que debe respetar>
- Estado: Pendiente | Resuelto → <id de la pieza en el lienzo>
```

---

### D-01 · Design system · (sin ruta)
- Pedido por: sesión principal · 2026-09-25
- Prioridad: alta
- Qué falta: la página de design system que Claude Design dejó como «Sigue». Tokens (paleta claro y oscuro con estados de solicitud y de afiliación, escala tipográfica Bricolage/Manrope con cifras tabulares, espaciado 4/8, radios, sombras, tokens de movimiento con nombre) y componentes con todos sus estados: botón, input, select, checkbox, OTP de 6 casillas, carga de foto, chip de estado, línea de pasos, tarjeta KPI, fila de tabla, tarjeta de convenio, menú lateral, barra inferior, modal de confirmación, toast, skeleton.
- Datos y reglas: conservar los nombres `--ga-*` de `app/globals.css` e indicar cuáles cambian de valor y cuáles son nuevos. Es lo primero que necesita `ga-diseno-a-codigo`.
- Estado: Resuelto → 3a

### D-02 · Ingreso · /ingresar y /ingresar/codigo
- Pedido por: sesión principal · 2026-09-25
- Prioridad: alta
- Qué falta: las dos pantallas de ingreso en estilo C+ (hoy solo existen en el estilo viejo de `design/`).
- Datos y reglas: cédula → «Enviarme el código» → código de 6 dígitos → «Entrar a mi cuenta»; «Reenviar código» con contador de 45 s (circular), «Cambiar cédula», «Deseo afiliarme» siempre visible, ayuda por WhatsApp. Mensaje siempre «Si tu cédula está registrada, te enviamos un código»; correo enmascarado `ju•••@•••`. Estados: normal, cargando, código inválido (sacudida), bloqueado por muchos intentos, éxito (check).
- Estado: Resuelto → 3b

### D-03 · Afiliación · /afiliacion y /afiliacion/enviada
- Pedido por: sesión principal · 2026-09-25
- Prioridad: alta
- Qué falta: el formulario de afiliación por pasos y la pantalla «Solicitud enviada» como comprobante con sello.
- Datos y reglas: nombres, apellidos, cédula, institución (Policía / Ejército), grado, celular, Nequi, **correo de cualquier dominio** (etiqueta «Correo electrónico»), «¿Quién te refirió?» (asesor, opcional), tres fotos (cédula frente, reverso y selfie, con guía de encuadre y previsualización), mensaje opcional y autorización de datos (Ley 1581, enlace a /politica-de-datos). Validación en vivo, errores por campo, envío de hasta 3 MB en total.
- Estado: Resuelto → 3c

### D-04 · Asociado · /cuenta/solicitar, estado vacío, Mis datos y boleta del sorteo
- Pedido por: sesión principal · 2026-09-25
- Prioridad: media
- Qué falta: formulario «Nueva solicitud» (control de monto con slider + campo, aviso inmediato si supera el tope, 50 % / 100 %, plazo), estado vacío de /cuenta («Todavía no tienes solicitudes de crédito» + «Nueva solicitud»), «Mis datos» (nombre, cédula y grado de solo lectura; celular editable) y la boleta del sorteo (inscribirse del 1 al 5, número de boleta, confirmación).
- Datos y reglas: **sin tasa de interés** para el asociado. Monto mínimo 100.000 y máximo el tope del grado.
- Estado: Resuelto → 3d

### D-05 · Admin · afiliaciones, asesores, sorteo, demostración y celular
- Pedido por: sesión principal · 2026-09-25
- Prioridad: media
- Qué falta: lo que Claude Design dejó como «Sigue» en `2d`: detalle de afiliación (etapas Recibida → Contactada → Aprobada/Rechazada, «Escribir por WhatsApp», «Marcar como contactada», visor de las 3 fotos con estado de carga y de enlace vencido), Asesores (lista, crear, asignar asociados), Sorteo (selector de mes, tabla de boletas), la pestaña «Demostración» (/admin/demo) y la versión para celular del admin.
- Datos y reglas: en `2d` cambiar la etiqueta «Correo institucional» por «Correo» (el correo puede ser de cualquier dominio).
- Estado: Resuelto → 3e (detalle de afiliación), 3f (Asesores), 3g (Sorteo), 3h (Demostración + patrón del admin en celular). El cambio de etiqueta en `2d` ya se había hecho el 2026-09-25.

### D-06 · Panel del asesor · /asesor (tarjetas y chips de resumen)
- Pedido por: ga-diseno-a-codigo · 2026-09-27
- Prioridad: media
- Qué falta: la pieza `2c` modela «Mis clientes» con datos ficticios en los que TODO cliente tiene un estado de afiliación (`CLIENTES` del script: `af` siempre es Pendiente/Contactado/Aprobada/Rechazada). El modelo real (`resumen_clientes_asesor()`) es más rico: además de solicitudes de afiliación (`origen: 'solicitud_afiliacion'`, con `estado_afiliacion`), el asesor también ve asociados YA afiliados (`origen: 'asociado'`), que pueden tener su propio estado de crédito (`estado_credito`: pendiente/aprobado/rechazado/ninguno) pero no tienen `estado_afiliacion`. El lienzo no dice qué tarjeta/chip debe contar a esos asociados.
- Datos y reglas: implementé la regla «un asociado ya es, por definición, una afiliación Aprobada» (agrupa `origen: 'asociado'` en la tarjeta/chip «Aprobada» sin importar su estado de crédito) — `lib/asesor/resumen.ts`, función `categoriaAfiliacion` (marcada `TODO(diseno: D-06)`). Falta decidir: (a) si esa regla es correcta, o si un asociado con crédito rechazado debería verse distinto de uno recién afiliado; (b) si la columna/chip «Último crédito» de la tabla (En revisión/Aprobado/No aprobado/Sin crédito) debe aparecer en el lienzo con su propio color, o si ya está cubierta por el design system `3a`.
- Estado: Pendiente

### D-07 · Landing · sección «Lo que hicieron con su crédito» (testimonios)
- Pedido por: ga-verificador-qa · 2026-09-27
- Prioridad: baja
- Qué falta: la pieza `2a` no incluye esta sección (así lo documenta el propio código, `components/pantallas/Landing.tsx`: «Historias: no está en la pieza 2a del lienzo C+, se conserva con el estilo nuevo... sin enlace en el nav»). Al no tener respaldo en el lienzo, hoy vive con el texto de ejemplo de `lib/mock.ts#TESTIMONIOS_EJEMPLO` visible en producción, con corchetes literales: «[Testimonio real de un asociado: qué necesitaba y qué logró.]» y «[Nombre], [grado] · asociado desde [año]» (visto en escritorio y celular, ver `tests/e2e/e-diseno.spec.ts`, prueba «Hallazgo: testimonios de ejemplo con corchetes visibles»).
- Datos y reglas: decidir (a) si la sección se mantiene en el rediseño C+ (y en ese caso, agregarla a `2a` con enlace en el nav, como tenía la landing anterior) o se retira; (b) si se mantiene, de dónde salen los testimonios reales (¿tabla nueva? ¿contenido fijo redactado por la cooperativa?) para reemplazar el texto de ejemplo antes de producción.
- Estado: Pendiente
