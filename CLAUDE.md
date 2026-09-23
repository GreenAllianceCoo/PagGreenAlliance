@AGENTS.md

# Seguimiento de avances

- El avance del proyecto vive en `docs/avances/Avances_Green_Alliance.xlsx` (pendientes, plan de 2 filas con cola infinita, Gantt con pesos 1–5, bitácora). Se genera desde `docs/avances/plan.json`; nunca se edita el Excel a mano.
- Cuando un agente `ga-*` termine una tarea importante, deja su reporte en `docs/avances/buzon.md` y lo repite al final de su entrega. Después de recibir esa entrega, invoca a `ga-supervisor-avances` para que actualice el plan y el Excel.
- Si la sesión principal termina algo importante sin usar un agente (p. ej. aplicar una migración, desplegar, configurar el SMTP), también agrega un reporte al buzón e invoca al supervisor.
