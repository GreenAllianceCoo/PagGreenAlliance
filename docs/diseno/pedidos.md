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
