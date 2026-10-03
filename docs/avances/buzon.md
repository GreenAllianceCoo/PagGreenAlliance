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

## 2026-10-02 · ga-funcionalidad-botones
- Actividades: trabajo nuevo sin ID (rol secretario ampliado, cambio de rol/desactivación de secretarios, búsqueda con nombre del admin, Historial del equipo)
- Estado: Hecho
- Qué se hizo: el secretario ve Asociados y Créditos en solo lectura (sin tasa ni botones de acción; en Asociados cambia el proceso ejecutivo y la fecha de embargo con historial) y todo lo demás sigue bloqueado en UI, servidor y RLS; el admin desactiva/reactiva a un secretario y cambia su rol (secretario↔asesor/admin, asesor→secretario) con motivo y log (RPC admin_cambiar_rol_equipo, historial_cambio_rol con motivo); la búsqueda general muestra el nombre del admin que atiende en vez de «Cooperativa»; nueva sección /admin/historial «Historial del equipo» (solo admin, filtros por persona y fechas, 25 por página, RPC admin_historial_equipo). Todo en la migración 20261003100000 (aún sin aplicar); pgTAP 29 (82) + 00 y 15, vitest (751), e2e p-secretario-busqueda (26, escritorio y celular) y k-roles, tsc, lint y build en verde; manual actualizado (14, 8.2 y nueva 17).
- Bloqueos o trabajo nuevo: la migración 20261003100000 sigue sin aplicar en producción (Sebas, con respaldo previo).

## 2026-10-02 · ga-auditor-supabase
- Actividades: trabajo nuevo sin ID (resincronizar migraciones 20261003000000/100000/200000 con producción)
- Estado: Hecho
- Qué se hizo: las tres migraciones se restauraron a su versión del commit 7d3249a (la aplicada en producción: los 136 cuerpos de función de public coinciden con producción) y los cambios posteriores (comprobantes 30 días + tarea programada, secretario con Asociados/Créditos y proceso ejecutivo, nadie cambia su propio rol, admin_cambiar_rol_equipo con motivo, asesor anterior/nuevo, admin_historial_equipo, búsqueda con nombre del admin) pasaron a la nueva 20261003300000_comprobantes_30_dias_y_secretario_ampliado.sql. Dump local final vs restauradas+300000: idéntico salvo la posición de la columna historial_cambio_rol.motivo; supabase test db 31 archivos / 799 pruebas PASS.
- Bloqueos o trabajo nuevo: Sebas aplica la 20261003300000 en producción ANTES de desplegar el código nuevo de la app (respaldo previo); riesgo de datos bajo (tablas afectadas vacías o sin filas que choquen).
