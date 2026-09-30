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

### D-08 · Admin · botón «Escribir por WhatsApp» habilitado · /admin/afiliaciones/[id]
- Pedido por: sesión principal (Sebas, P-95 aprobado) · 2026-09-27
- Prioridad: alta
- Qué falta: en `3e` el botón queda deshabilitado a la espera de P-95. Ya aprobado: diseñarlo habilitado, con el glifo oficial de WhatsApp en SVG en línea (sin imágenes externas), que abra `https://wa.me/57<celular>` en pestaña nueva con un mensaje inicial corto y cordial, en tuteo. Definir colores dentro del admin oscuro (verde de WhatsApp #25D366 solo en el ícono o también en el botón, con contraste AA), estados normal/hover/foco/deshabilitado (sin celular válido, con motivo visible), y que conviva con «Aprobar»/«Rechazar» sin competir con ellos.
- Datos y reglas: mismas reglas de datos que hoy (celular visible solo en la ficha del admin, nunca en listas ni al asesor); nada de fotos de personas en el ícono (es un glifo, no una foto).
- Estado: Resuelto → 3e (botón habilitado en el ejemplo «Pendiente») y 3i (estados normal/hover/foco/deshabilitado)

### D-09 · Admin · asignar asesor a un asociado ya aprobado · /admin/afiliaciones/[id]
- Pedido por: sesión principal (Sebas, P-96 aprobado) · 2026-09-27
- Prioridad: alta
- Qué falta: bloque «Asesor» en la ficha, distinto del campo existente «Asesor que refirió». Aparece **solo** cuando la afiliación está `aprobada` y el perfil del asociado **no tiene** `asesor_id` todavía. Selector de asesores registrados + botón «Asignar asesor», con confirmación ligera y estados cargando/éxito/error. Si ya tiene asesor, se ve de solo lectura («Asesor: Andrés Rojas»), sin opción de cambiarlo por ahora. Si no hay asesores registrados, mensaje con enlace a /admin/asesores. Si la afiliación no está aprobada, el bloque no aparece en absoluto.
- Datos y reglas: usa `perfiles.asesor_id`, que ya existe con su validación (`validar_perfil_asesor_id`, debe ser un perfil con `rol = 'asesor'`); no hace falta migración nueva, sí una Server Action nueva para asignar desde el admin.
- Estado: Resuelto → 3i

### D-10 · Afiliación v3 · /afiliacion
- Pedido por: sesión principal (spec-requerimientos-ricardo-2026-09-29.md §1–2) · 2026-09-29
- Prioridad: alta
- Qué falta: institución → grado filtrado (17 grados), «Cuenta de nómina» en cascada (entidad con búsqueda → ahorros/corriente → número; caso billetera sin tipo de cuenta), correo institucional + correo personal, asesor con los nombres reales (Ricardo Varón, Miguel Rueda, Nany Barón, Rafael González, «No tengo asesor»), verificador de foto (nitidez/luz, aviso no bloqueante) y selfie con cámara en la página (vista de cámara, «Tomar selfie», repetir, permiso negado → alternativa), «¿Algo que debamos saber?».
- Datos y reglas: spec §1 (grados por institución) y §2 (afiliación); el código de ingreso queda anclado al correo personal; el verificador de foto nunca bloquea el envío.
- Estado: Resuelto → 3j

### D-11 · Perfil del asociado · /cuenta «Perfil»
- Pedido por: sesión principal (spec-requerimientos-ricardo-2026-09-29.md §3) · 2026-09-29
- Prioridad: alta
- Qué falta: línea de 8 pasos del proceso ejecutivo, conteo de 36 meses (antes/después de «Operando»), botón «Retiro anticipado» (sin suma, con modal del cobro de $10.000.000 y «Avisar al administrador»), botón «Renovar los 36 meses» (desactivado hasta los 24 meses), crédito con conteo de 3 meses.
- Datos y reglas: spec §3; el asociado no ve la tasa de interés (decisión del 25-sep-2026); ninguna suma calculada en el botón de retiro.
- Estado: Resuelto → 3k

### D-12 · Panel del asesor · comisiones y búsqueda por cédula · /asesor
- Pedido por: sesión principal (spec-requerimientos-ricardo-2026-09-29.md §5) · 2026-09-29
- Prioridad: alta
- Qué falta: pestaña «Comisiones» (corte el 15, ingresos nuevos $500.000 c/u, operativos $100.000 c/u, «Acumulado ganado a la fecha» oculto que se revela al tocar, avance a bonos 50/100 opcional, enlace al simulador) y búsqueda de cliente por cédula con estado del proceso y capacidad de endeudamiento (50 %/100 % o «sin cupo configurado»).
- Datos y reglas: spec §0 (comisiones) y §5; sigue la regla F2-03 (solo sus propios clientes) y enmascara la cédula en listas.
- Estado: Resuelto → 3l

### D-13 · Admin · Asociados, Alertas, pagos de comisión y «Atiende asociados» · /admin
- Pedido por: sesión principal (spec-requerimientos-ricardo-2026-09-29.md §6) · 2026-09-29
- Prioridad: alta
- Qué falta: selector de estado del proceso ejecutivo + fecha de inicio del embargo + historial en el detalle del asociado; bandeja de alertas de retiro/renovación con «Marcar atendida»; formulario para registrar pago de comisión; interruptor «Atiende asociados» en /admin/asesores.
- Datos y reglas: spec §6; solo el admin cambia el proceso ejecutivo; Ricardo Varón queda con `atiende_asociados = true`.
- Estado: Resuelto → 3m

### D-14 · Convenios · detalle por marca · landing y /cuenta
- Pedido por: sesión principal (spec-requerimientos-ricardo-2026-09-29.md §4) · 2026-09-29
- Prioridad: media
- Qué falta: detalle por marca (modal en escritorio, hoja inferior en celular) con descripción, viñetas, sedes, NIT y «Escribir por WhatsApp» con el glifo oficial.
- Datos y reglas: spec §4, con los textos literales de «REQUERIMIENTO DE PAGINA WEB 2.pdf» (páginas 3–4) — cerrado el 2026-09-30 con los textos literales de la migración `20260929100600_convenios_servicios_sedes_y_datos.sql`.
- Estado: Resuelto → 3n

### D-15 · Admin · corregir y anular un pago de comisión + bitácora · /admin/asesores
- Pedido por: ga-funcionalidad-botones · 2026-09-30
- Prioridad: media
- Qué falta: en la lista de pagos de comisión (3m), por cada pago vigente: «Corregir» (monto, concepto y/o nota; casilla «Borrar la nota») y «Anular», los dos con un campo «Motivo» obligatorio; estado del pago anulado (tachado o chip «Anulado» con motivo, quién y cuándo; no suma al total); y una vista «Bitácora» (por pago o general) con acción (Registro / Corrección / Anulación), quién, cuándo, motivo y los cambios «antes → después».
- Datos y reglas: spec-requerimientos-ricardo §8 y migración 20260930100000. Acciones `editarPagoComision` y `anularPagoComision` (app/admin/asesores/actions.ts); loaders `listarPagosComision` (trae `anulado`, `motivoAnulacion`, `anuladoPor`, `anuladoEl`) y `listarBitacoraPagos` (lib/admin/equipo.ts). Motivo de 5 a 300 caracteres. Un pago anulado ya no se puede corregir. Los pagos nunca se borran. Errores posibles: «No hay cambios para guardar.», «Un pago anulado ya no se puede modificar.», «El monto no es válido para ese concepto (para descontar usa «Ajuste»).».
- Estado: Resuelto → 3o (2026-09-30, ga-disenador-lienzo)

### D-16 · Crédito bloqueado hasta «Operando» · /cuenta y /cuenta/solicitar
- Pedido por: ga-funcionalidad-botones · 2026-09-30
- Prioridad: alta
- Qué falta: el estado de «Solicitar crédito» cuando el asociado NO puede pedir: botón deshabilitado (o reemplazado) con el texto «Podrás pedir tu crédito cuando tu proceso esté operando», tanto en la tarjeta de /cuenta como en /cuenta/solicitar. Los otros motivos ya tienen texto: grado sin cupo («Tu grado todavía no tiene cupo de crédito configurado; tu asesor te contactará»), solicitud pendiente y sin grado.
- Datos y reglas: spec §8 (regla de Sebas): solo si el asociado está activo y su proceso ejecutivo está en «operando»; la base lo vuelve a exigir (trigger de 20260930100200). Datos: `perfilAsociado.credito` = `{ puedeSolicitar, motivo, mensaje }` con motivo `inactivo | sin_grado | sin_cupo | no_operando | pendiente | sin_topes` (lib/asociado/servidor.ts). Inactivo usa el mismo texto que «no operando».
- Estado: Resuelto → 3p (2026-09-30, ga-disenador-lienzo)
