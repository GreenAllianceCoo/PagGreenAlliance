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

## 2026-09-27 · ga-disenador-lienzo
- Actividades: D-08, D-09 (docs/diseno/pedidos.md)
- Estado: Hecho
- Qué se hizo: en `docs/Green Alliance C+.dc.html` se habilitó el botón «Escribir por WhatsApp» de `3e` (glifo oficial en SVG en línea, enlace `wa.me` con mensaje prellenado) y se agregó la pieza `3i` con el bloque «Asesor» para asignar `perfiles.asesor_id` a un asociado ya aprobado, con todos sus estados (sin elegir, asignando, éxito, error, ya asignado, sin asesores registrados) y los 4 estados del botón de WhatsApp (normal, hover, foco, deshabilitado por falta de celular).
- Bloqueos o trabajo nuevo: `ga-diseno-a-codigo` debe (1) habilitar el botón de WhatsApp en `components/admin/PanelAfiliacionDetalle.tsx` (hoy deshabilitado a la espera de P-95) con el ícono y el mensaje de `3i`; (2) crear la Server Action «asignar asesor» sobre `perfiles.asesor_id` (sin migración nueva, la columna y su validación ya existen) y el bloque «Asesor» en la ficha, visible solo si `estado = 'aprobada'` y `asesor_id` es `null`.

## 2026-09-27 · ga-funcionalidad-botones
- Actividades: 4.11, P-96
- Estado: Hecho (servidor/datos); UI queda para ga-diseno-a-codigo sobre la pieza 3i ya diseñada
- Qué se hizo: Server Action `asignarAsesor` en `app/admin/afiliaciones/actions.ts` (con `exigirAdmin`, zod `esquemaAsignarAsesor`, re-verificación en servidor de afiliación aprobada + perfil sin asesor + update condicional `.is("asesor_id", null)` para la carrera, y mensaje claro si el trigger rechaza un id que no es asesor); `app/admin/afiliaciones/[id]/page.tsx` ahora carga `perfilAsociado` y `asesores` solo cuando aplica y los pasa como props opcionales nuevas a `PanelAfiliacionDetalle` (firma con `TODO(diseno: D-09)`, sin maquetar nada). 9 pruebas de la Server Action + 5 del esquema zod, `tsc`/`lint`/`build`/`vitest` en verde (334 pruebas).
- Bloqueos o trabajo nuevo: ninguno de mi parte. Confirmé que NO hace falta una migración nueva: la política RLS `perfiles_update` (20260923123853) ya permite a un admin actualizar cualquier perfil, y el trigger `proteger_campos_perfil` (20260924000100) ya deja pasar el cambio de `asesor_id` cuando quien edita es admin, con `validar_perfil_asesor_id` validando que el elegido tenga rol asesor. Falta que `ga-diseno-a-codigo` maquete la pieza 3i del lienzo (ya diseñada por `ga-disenador-lienzo`, ver su reporte arriba) y la conecte a `asignarAsesor`.

## 2026-09-27 · ga-diseno-a-codigo
- Actividades: 4.11, P-95, P-96
- Estado: Hecho
- Qué se hizo: pasé a código las piezas `3e`/`3i` que faltaban. (1) Botón «Escribir por WhatsApp» habilitado en `PanelAfiliacionDetalle.tsx`: enlace `wa.me` en pestaña nueva con mensaje prellenado (primer nombre interpolado), glifo SVG en línea (`IconoWhatsapp`, `components/ui/Iconos.tsx`), normalización pura del celular en `lib/admin/whatsapp.ts` (con pruebas Vitest) y estado deshabilitado con motivo visible si el celular no es válido. (2) Bloque «Asesor» nuevo (`components/admin/AsignarAsesor.tsx`), conectado a la Server Action `asignarAsesor` ya existente (`useActionState`), con sus estados sin elegir/asignando/éxito/error/sin asesores registrados; visible solo cuando el servidor manda `perfilAsociado`. Encontré y corregí una condición de carrera real: como `asignarAsesor` llama `revalidatePath`, Next vuelve a pedir la página apenas la Server Action termina, y como el servidor solo manda `perfilAsociado` cuando el perfil TODAVÍA no tiene asesor, ese refresco lo deja en `null` justo cuando la asignación acaba de tener éxito — sin cuidarlo, `<AsignarAsesor>` se desmontaba antes de poder mostrar su propio aviso. Lo resolví «congelando» la prop inicial con `useState` en `PanelAfiliacionDetalle` (sin tocar la Server Action ni la página de servidor). Agregué una prueba corta a `tests/e2e/k-roles.spec.ts` (WhatsApp habilitado tras aprobar + bloque «Asesor» forzando el caso sin asesor con `adminRest`, ya que el seed refiere a Camilo con el único asesor de prueba). `tsc`, `lint`, `build`, `vitest` (360 pruebas) y `npx supabase db reset` + Playwright (`k-roles.spec.ts`, escritorio) en verde. Capturas del detalle aprobado en `test-results/responsive/3i/detalle-aprobado-{1440,390}.png`.
- Bloqueos o trabajo nuevo: ninguno de código. Queda una diferencia de comportamiento con el lienzo que no pude cerrar sin tocar la página de servidor (fuera de mi alcance en este encargo): tras asignar un asesor, el bloque no queda visible como tarjeta de solo lectura permanente en una recarga posterior (el estado «YA ASIGNADO» del lienzo `3i`) porque `app/admin/afiliaciones/[id]/page.tsx` solo consulta el perfil cuando `asesor_id IS NULL`, así que nunca vuelve a mandar el nombre del asesor ya asignado; hoy la única confirmación duradera es el historial (que no incluye este evento) y el toast del momento. Si se quiere el estado «ya asignado» de verdad en cada carga, hace falta un ajuste chico en esa página de servidor (traer siempre el asesor si ya existe) — se lo dejo a la sesión principal para decidir si vale la pena.
