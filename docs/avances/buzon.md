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

## 2026-09-30 · ga-auditor-supabase
- Actividades: §12.14 (SP → IJ), R-10, R-11
- Estado: Hecho
- Qué se hizo: SP se agregó al remapeo a IJ en la migración 20260930200100 (sin aplicar); TODO R-10/R-11 marcados como decididos por Sebas; pgTAP 12 y 19 y comentario del seed ajustados. db reset, test db y vitest en verde.
- Bloqueos o trabajo nuevo: Sebas aplica la migración en remoto.

## 2026-09-30 · ga-diseno-a-codigo
- Actividades: P-xx (convenios: medios en el detalle)
- Estado: Hecho
- Qué se hizo: videos de AMB Móvil, Dr. Ribero y Dream & Go Visas y PDF de Racing Tours en el detalle de convenio (mapa por NIT en lib/convenios.ts; archivos renombrados a public/convenios/).
- Bloqueos o trabajo nuevo: ninguno (sin poster; Locos por los Viajes sin medio).
