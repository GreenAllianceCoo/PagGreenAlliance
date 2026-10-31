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


## 2026-10-30 · sesion-principal
- Actividades: P-nuevo (editar condiciones del crédito)
- Estado: En curso
- Qué se hizo: «Editar condiciones» en /admin/creditos hasta el desembolso: lo que recibe y devuelve, plazo, porcentaje entero de 50 a 100 y tipo cooperativa/convenio, con motivo e historial. Migración 20261030000000 y pgTAP 37 escritos.
- Bloqueos o trabajo nuevo: migración 20261030000000 aplicada en producción el 2026-10-31 (verificado: columnas y RPC existen; anon sin permiso). Falta pgTAP 37 (sin Docker en el equipo), commit y despliegue del código.
