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

## 2026-09-23 · ga-auditor-supabase
- Actividades: P-43
- Estado: Hecho
- Qué se hizo: Auditoría de solo lectura de 20260923210000_limite_de_intentos.sql contra producción. Veredicto: se puede aplicar tal cual, sin críticos ni altos. Reporte en docs/auditorias/2026-09-23-limite-de-intentos.md.
- Bloqueos o trabajo nuevo: Sebas aplica la migración con db push antes del despliegue (6.5). Trabajo nuevo (medio, código): hash de la clave con HMAC y secreto (ga-funcionalidad-botones) y alerta en los logs de Vercel para limite_de_intentos_fallo. Opcional: revocar la secuencia limites_intentos_id_seq a anon y authenticated.

## 2026-09-23 · ga-diseno-a-codigo
- Actividades: 2.1, 5.3, P-16 (y revisión visual del mapa de botones: 2.2, 2.3, 3.4)
- Estado: Hecho
- Qué se hizo: El logo horizontal ahora usa las letras del logo oficial (SVG nuevo green-alliance-wordmark.svg y su versión blanca, recortados de los archivos de public/logos) en lugar de Montserrat, que se dejó de descargar. Los espacios de foto de la landing pasan a un diseño de marca (degradado verde/navy, patrón de puntos, isotipo en marca de agua e ilustración por apoyo) con el componente EspacioFoto, que acepta la foto real cambiando `null` por { src, alt }. Se revisaron contra el diseño todos los botones y enlaces del mapa (Landing, Ingreso, Código, Afiliación, Enviada, Cuenta): todos existen y están bien ubicados. /dashboard y /dashboard/solicitar muestran el Logo en vez del texto «GREEN ALLIANCE».
- Bloqueos o trabajo nuevo: Faltan las fotos reales (P-16, cooperativa). El mapa de botones §4 todavía marca «Nueva solicitud» como Pendiente aunque ya va a /dashboard/solicitar (hay que actualizar el documento), y no tiene sección para /dashboard. No falta lógica en ningún botón.
