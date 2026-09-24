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

## 2026-09-24 · ga-escritor-tests
- Actividades: 6.1, P-58
- Estado: En curso
- Qué se hizo: Reescribí tests/e2e/d-afiliacion.spec.ts entero para la afiliación v2 (nombres/apellidos, institución+correo institucional, Nequi, asesor, 3 fotos con magic bytes y bucket privado); 48 pruebas × 2 proyectos (escritorio/celular) = 96, corridas contra Supabase local: 92 pasan, 4 fallan (2 por proyecto) por un bug real de la app, no de la prueba. Reproduje el bug también sin navegador y lo agregué como prueba unitaria en tests/unit/validaciones.test.ts (falla a propósito, documentando el defecto). Corrí k-roles.spec.ts (referencia): 4/4 en escritorio (tuve que corregir a mano el estado de la solicitud de ejemplo «Camilo», que había quedado «aprobada» de una corrida previa a mi sesión, sin poder usar `supabase db reset`, bloqueado por el permiso de la sandbox). npm run test:unit: 307 pasan, 1 falla (la nueva, documentando el bug). npx tsc --noEmit sin errores.
- Bloqueos o trabajo nuevo: Bug para ga-funcionalidad-botones en lib/validaciones/afiliacion.ts (esquemaAfiliacion): el `.check()` que cruza institución↔dominio del correo no se evalúa si CUALQUIER otro campo del formulario también es inválido a la vez (ej. la autorización sin marcar), aunque institución y correo sean individualmente válidos — el comentario del propio esquema dice que solo debería omitirse si institución o correo fallan, no si falla cualquier otro campo. Reproducido en tests/unit/validaciones.test.ts («el dominio equivocado se detecta aunque TAMBIÉN falte la autorización») y en tests/e2e/d-afiliacion.spec.ts (D4, 2 casos marcados `bug: true`). Falta correr `npm run test:db` (pgTAP) porque no puedo invocar `supabase db reset`/`supabase test db` desde la sandbox (bloqueado por el permiso de auto mode); queda para quien tenga ese permiso o para el propio Sebas. También faltan por reescribir b-ingreso.spec.ts, i-despliegue.spec.ts y j-produccion.spec.ts (formato viejo de máscara de correo), fuera del alcance de esta tarea.
