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

## 2026-10-02 · ga-correos
- Actividades: trabajo nuevo sin ID
- Estado: Hecho
- Qué se hizo: 5 plantillas HTML nuevas en docs/resend/ (desembolsado, habilitado, sorteo-ganador, correo-cambiado, codigo-eliminacion) con las variables exactas del código, y guía docs/entrega/instrucciones-plantillas-resend.md con la tabla de las 10 plantillas. COMPROBANTE ahora viaja siempre (vacía sin comprobante) en lib/correo/credito.ts.
- Bloqueos o trabajo nuevo: Sebas debe publicar las 5 plantillas en Resend y agregar las 5 RESEND_TEMPLATE_* en Vercel (Production) + redeploy.

## 2026-10-02 · ga-funcionalidad-botones
- Actividades: P-xx (eliminar definitivamente: comprobantes 30 días)
- Estado: Hecho
- Qué se hizo: al eliminar definitivamente a un asociado sus comprobantes de desembolso se conservan 30 días (solicitudes_credito.comprobante_borrar_at, solo admin) y la tarea programada /api/cron/limpiar-fotos los borra al vencer, además de los comprobantes huérfanos de más de 24 h; ficha del eliminado con «Comprobantes que se borrarán el DD/MM/AAAA» + «Ver»; aviso del diálogo y manual actualizados; pgTAP 28 (76), vitest y e2e ajustados.
- Bloqueos o trabajo nuevo: migraciones 20261003000000/100000/200000 siguen sin aplicar en producción (la 0000 se editó; la 2000 redefine admin_confirmar_eliminacion coherente).
