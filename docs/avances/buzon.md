# Buzón del supervisor de avances

Cada agente `ga-*` agrega aquí un reporte al terminar una tarea importante. `ga-supervisor-avances` los pasa a `plan.json`, regenera `Avances_Green_Alliance.xlsx` y vacía este buzón (lo procesado queda en la hoja Bitácora).

Formato (copiar debajo de la línea, uno por tarea):

```
## AAAA-MM-DD · nombre-del-agente
- Actividades: 2.5, 2.6            (IDs de la hoja Plan; P-xx si es un pendiente suelto)
- Estado: Hecho | En curso | Bloqueado
- Qué se hizo: una o dos frases.
- Bloqueos o trabajo nuevo: qué falta, de quién, o «ninguno».
```

---

## 2026-09-25 · ga-disenador-lienzo
- Actividades: nueva (rediseño C+, D-04 y D-05 de `docs/diseno/pedidos.md`)
- Estado: Hecho
- Qué se hizo: agregué al lienzo `docs/Green Alliance C+.dc.html` las piezas `3d` (asociado: /cuenta/solicitar, estado vacío, Mis datos y la boleta del sorteo con sus 3 pasos) y `3e`–`3h` (admin: detalle de afiliación, Asesores, Sorteo, pestaña Demostración y el patrón del admin en celular), con escritorio, celular y todos los estados reales de cada pantalla.
- Bloqueos o trabajo nuevo: `ga-diseno-a-codigo` puede pasar `3d`–`3h` a Next.js (todas usan componentes/rutas que ya existen, salvo el botón «Escribir por WhatsApp» en el detalle de afiliación, que es nuevo). Falta decisión de la cooperativa antes de diseñar «asignar/desactivar un asesor» (no hay backend ni proceso definido). El cambio de franja azul → marco ámbar en `/admin/demo` (3h) y la corrección de «Correo institucional» → «Correo» en `2d` (ya hecha) son ajustes de estilo pendientes de aplicar en código.

## 2026-09-25 · ga-diseno-a-codigo
- Actividades: 2.15, 1.7
- Estado: Hecho
- Qué se hizo: reestilicé `components/ui/*` (Button, Input, Select, Textarea, Checkbox, Field, OtpInput, Badge, ProgressSteps, PasosSolicitud, la carga de foto de afiliación) según la pieza `3a` del lienzo (botones píldora, borde `--ga-borde-input`, foco con halo verde, deshabilitado, casilla de checkbox dibujada a mano) y maqueté `/ingresar`, `/ingresar/codigo`, `/afiliacion` y `/afiliacion/enviada` según `3b`/`3c`, con sus animaciones MOVIMIENTO: foco animado (borde + halo), OTP con sacudida en código inválido (sin tocar el estado del formulario), aro que se vacía en «Reenviar código», vista previa de foto con fundo de opacidad, y sello + check con trazo en el comprobante de «Solicitud enviada». `tsc`, `lint`, `build` y las 308 pruebas de `vitest` pasan.
- Bloqueos o trabajo nuevo: ninguno para diseño; queda pendiente que `ga-funcionalidad-botones` o QA corran `tests/e2e/b-ingreso.spec.ts` y `d-afiliacion.spec.ts` contra estos cambios (no los corrí: requieren Supabase local). `tests/e2e/e-diseno.spec.ts` ya estaba desactualizado desde antes de esta tanda (usa los campos viejos de afiliación v1) y sigue así.
