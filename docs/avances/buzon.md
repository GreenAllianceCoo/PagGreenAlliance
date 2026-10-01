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


## 2026-10-01 · ga-diseno-a-codigo
- Actividades: tanda §13 (pendientes visuales 13.1–13.3)
- Estado: Hecho
- Qué se hizo: Verificación visual/de código de CuentaDemo (selector Policía/Ejército radiogroup, «Sin cupo configurado»), ícono WhatsApp en el pie, paneles con por_estado_proceso y «Desembolsos del mes», y HabilitarCredito alineado con BajaAsociado (3m). tsc, lint, vitest (552) y build en verde.
- Bloqueos o trabajo nuevo: ninguno

## 2026-10-01 · ga-auditor-supabase
- Actividades: pruebas pgTAP (migraciones 20261001*)
- Estado: Hecho
- Qué se hizo: arreglado admin_habilitar_credito (array_append en bloqueos) y pruebas 21 y 10 (sorteo independiente de la fecha); npx supabase test db en verde (22 archivos, 497 pruebas).
- Bloqueos o trabajo nuevo: ninguno; la migración 20261001100000 sigue sin aplicar en remoto.
Evidencia: `test-results/playwright/*/` (capturas y trazas), `test-results/qa/resultados.json`.

## 2026-10-01 · ga-verificador-qa
- Actividades: 6.21, 6.15
- Estado: En curso
- Qué se hizo: Suite e2e completa con Supabase local: escritorio 150/24/3 (+8 sin correr), celular 128/18/39. Se encontraron 5 hallazgos de la app (media/baja) y unas 15 pruebas desactualizadas por v3 y por el crédito bloqueado.
- Bloqueos o trabajo nuevo: ga-diseno-a-codigo (QA-01, QA-02, QA-05) y ga-funcionalidad-botones (QA-03, QA-04). Falta actualizar las pruebas de crédito y v3, y que el usuario apruebe los 4 ajustes a pruebas de seguridad.

## 2026-10-01 · ga-funcionalidad-botones
- Actividades: P-xx (correcciones QA-01 a QA-05 de /afiliacion)
- Estado: Hecho
- Qué se hizo: texto «Esto no crea tu cuenta todavía…» restaurado junto al aviso del correo personal; contador n/500 con `text-ga-texto-3`; el formulario se rehace con `key` tras cada respuesta (React 19 reseteaba los selects controlados) para conservar Institución/Grado; «No pudimos subir tus fotos…» cuando el servidor rechaza bytes que no son imagen; lista de SelectBusqueda con tabIndex=-1 (Chrome la hacía tabulable y el foco caía en body).
- Bloqueos o trabajo nuevo: y-tanda2:136 (error en #af-cc-error con cédula pendiente) contradice S-06 (respuesta idéntica al éxito, anti-enumeración): hay que actualizar la prueba, no la app. f-accesibilidad:169 tiene el orden esperado desactualizado (v3: institución antes que grado, cuenta de nómina, correo institucional, botón «Tomar selfie»); D9 espera ruta por cédula y ahora es solicitudes/<id>/.

## 2026-10-01 · ga-verificador-qa
- Actividades: 6.21, 6.15
- Estado: Hecho
- Qué se hizo: Se ajustaron las e2e aprobadas por Sebas: g-estatico 35/69, y-tanda2 136/152/248/284, f-accesibilidad (orden de Tab v3), D9 con rutas `solicitudes/<id>/`, radios nuevos, grado según la institución, maxLength 500, convenios con diálogo, sorteo independiente de la fecha y demo con grado SI. Antes: escritorio 150/24 fallidas (+8 sin correr) y celular 128/18. Después: escritorio 171/4 (3 corregidas y confirmadas al volver a correrlas, +7 sin correr por la serie Y5) y celular 143/3 (las 3 corregidas y confirmadas).
- Bloqueos o trabajo nuevo: hay un bug real para ga-funcionalidad-botones. Cuando un asociado dado de baja ingresa con su código, vuelve al paso 1 sin el aviso «Tu cuenta está inactiva». En app/ingresar/actions.ts se llama a `borrarCookieIngreso()` antes de revisar `activo`, así que el error se pierde al redirigir (y-tanda2:336). QA-01 a QA-05 ya no fallan: la QA-05 era por la prueba (el grado está deshabilitado sin institución).
