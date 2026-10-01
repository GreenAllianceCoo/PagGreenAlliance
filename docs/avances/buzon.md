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


## 2026-09-30 · ga-funcionalidad-botones
- Actividades: P-xx (política de datos v1.0, sin ID en el plan)
- Estado: Hecho
- Qué se hizo: /politica-de-datos publica las 28 secciones + aprobación + anexo de la plataforma, con índice por anclas, aviso «En revisión jurídica» en 7.3, 8 y 18, botón «Descargar en PDF» (window.print) y enlace en el pie de la landing y en la casilla de /afiliacion.
- Bloqueos o trabajo nuevo: Por definir: horario de atención, órgano y acta de aprobación; TODO(backend): guardar VERSION_POLITICA_DATOS junto a acepto_datos_at (no hay columna de versión).
