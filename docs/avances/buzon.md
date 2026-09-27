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

## 2026-09-27 · ga-funcionalidad-botones
- Actividades: 4.11
- Estado: Hecho
- Qué se hizo: Cerró los 2 frentes de backend que dejó abiertos el maquetado del panel de admin en modo oscuro (commit e39ad72, rama rediseno-c-plus): (1) los 4 KPI de /admin/creditos ahora son siempre exactos (lib/admin/kpis.ts, cargarKpisAdmin: 3 conteos `count:'exact',head:true` + una suma sobre las filas aprobadas del mes, con el cliente de sesión del admin vía RLS, sin service role; mes calendario en hora de Colombia con rangoMesColombia, con pruebas unitarias nuevas en tests/unit/admin-kpis.test.ts); (2) el aviso «Dentro/Supera el tope» y el bloqueo de «Aprobar» en el detalle de crédito ahora usan los topes reales de `grados_credito` (cargarPaquetesDemo, que ya hace fallback a la copia estática si la consulta falla), en vez de la copia de lib/asesor/datosDemo.ts a secas. También oculté el textarea de «Nota interna · solo la ve el equipo» (créditos y afiliaciones): antes se mostraba sin guardar nada; ahora queda detrás de una bandera `HISTORIAL_NOTAS_INTERNAS_HABILITADO = false` (lib/admin/flags.ts) con un TODO(backend) que apunta a la migración sin aplicar `20260925200200_historial_y_notas_internas.sql`. Confirmé (sin cambios de código) que la aprobación en 2 pasos y el rechazo con motivo obligatorio siguen llamando a las mismas Server Actions (resolverCredito, aprobarAfiliacion, cambiarEstadoAfiliacion) con validación en servidor, que los atajos J/K/A/R/Esc nunca se disparan dentro de campos de texto ni saltan el segundo paso, y que un crédito por encima del tope no se puede aprobar aunque la UI fallara: el trigger `chk_monto_solicitud`/`validar_monto_solicitud` ya congela el monto al crear la solicitud y `tr_proteger_topes` impide bajar el tope de `grados_credito` mientras haya solicitudes pendientes de ese grado y porcentaje, así que el invariante «monto ≤ tope» ya está garantizado antes de que exista un botón «Aprobar» que apretar. npx tsc --noEmit, npm run lint, npm run build y npx vitest run (19 archivos, 316 pruebas) en verde. Sin commits.
- Bloqueos o trabajo nuevo: Ninguno nuevo. Sigue pendiente lo ya registrado en 1.8 (5 migraciones propuestas sin aplicar, entre ellas la de historial/nota interna): cuando Sebas la aplique, falta conectar una Server Action nueva a `agregar_nota_solicitud()` y poner `HISTORIAL_NOTAS_INTERNAS_HABILITADO` en `true`.
