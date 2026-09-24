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

## 2026-09-23 · ga-verificador-responsive
- Actividades: 6.3
- Estado: Hecho
- Qué se hizo: Revisé responsive 8 rutas × 9 anchos (360–1440), más nombre largo y 844×390, con Playwright en local (develop bf09975). 0 críticos y 8 menores: sin scroll horizontal y con los patrones de la spec correctos. Reporte y capturas en docs/verificaciones/responsive-2026-09-23/.
- Bloqueos o trabajo nuevo: ga-diseno-a-codigo debe corregir 8 hallazgos menores. Los más visibles: el texto de las opciones 50/100 % en /cuenta/solicitar en celular, y el área de toque de «Reenviar código» y del deslizador de monto. También: header de /cuenta con nombres largos a 1024, hero de la landing a 1024, landing estirada entre 640 y 1023, /afiliacion a 1024 y hueco en /afiliacion/enviada en tableta.

## 2026-09-23 · ga-verificador-qa
- Actividades: 6.3, P-39
- Estado: Bloqueado
- Qué se hizo: Verificación E2E del commit bf09975 en local (Supabase local + next dev): 236 pruebas Playwright pasan y 5 fallan por hallazgos reales; unitarias (140), pgTAP (143), tsc y eslint sin errores. Nuevo tests/e2e/j-produccion.spec.ts y ajustes en D5, H, I3, I4, I6 y Z. Reporte: docs/verificaciones/2026-09-23-verificacion-3.md.
- Bloqueos o trabajo nuevo: NO APROBADO para producción. F-01 crítica: el dominio del correo enmascarado delata si la cédula existe (ga-funcionalidad-botones + decisión de producto). F-02 alta: sin tope de intentos al verificar el código (ga-funcionalidad-botones, revisar con ga-revisor-seguridad). Contenido pendiente de la cooperativa visible en la landing y política de datos vacía (Ley 1581). Configuración de producción por revisar: SMTP/Resend, P-45, secretos en Vercel, P-43 y P-09. Además, F-03 (celular sin «Cerrar sesión» en /cuenta/solicitar) y F-04 (404 en inglés) para ga-diseno-a-codigo; F-05 (sin cabeceras anti-clickjacking) para ga-funcionalidad-botones; F-06 a F-08 bajas.

## 2026-09-23 · ga-funcionalidad-botones
- Actividades: 6.3, P-49
- Estado: Hecho
- Qué se hizo: Corregí F-01 (correo enmascarado ya no delata la cédula: se oculta también el dominio y el relleno se genera con la misma mezcla de dominios institucionales reales), F-02 (tope de intentos al verificar el código: 5 por cédula y 30 por IP cada 15 min, con `dentroDelLimite`), F-05 (cabeceras `X-Frame-Options`, CSP `frame-ancestors 'none'`, `Referrer-Policy` y `X-Content-Type-Options` en `next.config.mjs`), F-06 (el servidor de `/cuenta/solicitar` exige monto múltiplo de $50.000) y F-08 (el código pegado durante «Reenviar» ya no se borra). Documenté O-01 en `lib/servidor/limite.ts` (x-forwarded-for/x-real-ip solo confiables detrás de Vercel). Agregué pruebas unitarias para F-01, F-02, F-06 y O-01 (tests/unit/cuenta-y-mascara.test.ts, ingreso-codigo.test.ts nuevo, crear-solicitud.test.ts, limite.test.ts). `tsc`, `eslint` y `test:unit` sin errores nuevos (162/163; la falla restante de `enlaceWhatsapp` es previa y no la toqué). No toqué `supabase/`, `components/` ni `app/afiliacion/`.
- Bloqueos o trabajo nuevo: `tests/e2e/j-produccion.spec.ts`, `i-despliegue.spec.ts` y `b-ingreso.spec.ts` (de ga-verificador-qa) usan el formato viejo de máscara y dominios gmail/hotmail/outlook/yahoo; hay que actualizarlos al nuevo formato `xx•••@yy•••.co`. `supabase/config.toml` → `[auth.rate_limit] token_verifications = 30` por IP cada 5 min: como nuestras llamadas a `verifyOtp` salen desde el servidor (Vercel), ese límite de Supabase se reparte entre TODOS los usuarios, no por persona; recomiendo subirlo bastante en el panel de producción (o no bajarlo del valor por defecto) y tratarlo solo como respaldo, ya que el límite real por cédula/IP ahora lo hace nuestra app. Pendiente decisión de la cooperativa: confirmar que solo hay 3 dominios institucionales de asociados (policia.gov.co, buzonejercito.mil.co, ejercito.mil.co) para no dejar ningún dominio real fuera de la mezcla de relleno.

## 2026-09-23 · ga-diseno-a-codigo
- Actividades: 6.3
- Estado: Hecho
- Qué se hizo: Corregí los 8 hallazgos de docs/verificaciones/responsive-2026-09-23/reporte.md y F-03/F-04/F-07 de la verificación 3, sin tocar Afiliacion.tsx, app/afiliacion/page.tsx, Cuenta.tsx, lib/, app/ingresar/codigo/ ni supabase/. Tarjetas 50%/100% de /cuenta/solicitar con padding y texto centrado; deslizador con área de toque de 44 px; «Reenviar código» con min-h-11; header de /cuenta con nav sin partir (whitespace-nowrap) y nombre truncado; «Cerrar sesión» agregado en celular a /cuenta/solicitar; botones del hero y «Ver beneficios» de la landing sin partirse entre 1024–1150 y landing centrada (md:max-w-2xl) entre 640–1023, igual que /afiliacion y /cuenta; hueco de tableta en /afiliacion/enviada corregido (md:min-h-0); nueva app/not-found.tsx en español con logo y «Volver al inicio». Verifiqué con tsc, eslint, npx playwright test -c tests/responsive (19/21, 2 fallas ya documentadas como falsos positivos) y capturas manuales a 360/390/768/1024/1150/1280.
- Bloqueos o trabajo nuevo: ninguno de mi parte. El hallazgo #7 (afiliacion-1024, grid a 2 columnas muy angosta) queda pendiente para la tanda que rehaga Afiliacion.tsx, según lo pedido.

## 2026-09-24 · ga-auditor-supabase
- Actividades: Fase 2 (nueva, sin ID en plan.json todavía) — PARTE 1: base de datos y spec. Relacionada con 1.2, 3.1.
- Estado: Hecho
- Qué se hizo: 6 migraciones nuevas (no aplicadas a producción, solo probadas contra Supabase local): rol 'asesor' (enum aparte por la restricción de Postgres de no usar el valor nuevo en la misma transacción), `perfiles.asesor_id` con validaciones (debe ser un asesor real, no autoreferencia, nadie se autoasigna asesor ni rol), `solicitudes_afiliacion` v2 (nombres/apellidos separados, institución + correo institucional según policía/ejército, Nequi, asesor_id opcional, 3 fotos obligatorias; `unidad` queda nullable sin borrarse), `obtener_asesores_publico()` y `resumen_clientes_asesor()` (SECURITY DEFINER, columna a columna, nunca celular/correo/nequi/fotos), bucket privado `afiliacion-documentos` (5 MB, jpeg/png/webp, sin ninguna política de storage.objects: todo por service_role + URL firmada desde el servidor tras verificar admin), y sorteo mensual (`boletas_sorteo` + `participar_sorteo()`/`confirmar_boleta_sorteo()`/`sorteo_ventana_abierta()`, ventana 1–5 hora Bogotá, una boleta por asociado y mes, tope de 5 intentos). `supabase/seed.sql` actualizado (asesor de prueba cédula 1234567892 asignado al asociado 1234567890, solicitud de afiliación de ejemplo con institución y Nequi). 4 archivos de pruebas pgTAP nuevos (07 a 10) y 2 ajustados (00, 04) por el cambio de esquema. `docs/spec-fase-2.md` nuevo con tablas, funciones, cómo llamarlas desde el servidor y preguntas abiertas. Verificado con `supabase db reset` desde cero + `supabase test db` (203/203 pgTAP) + `npm run test:unit` (163/163) + `tsc --noEmit` sin errores. No toqué `lib/ingreso/`, `next.config.mjs` ni componentes visuales.
- Bloqueos o trabajo nuevo: Sebas debe aplicar estas 6 migraciones a producción cuando corresponda (después de la auditoría de seguridad de esta tanda), igual que la pendiente ya existente de `limite_de_intentos`. `ga-funcionalidad-botones` necesita: (1) sumar a `docs/resend-plantillas.md` el correo del número de boleta del sorteo (no estaba en la lista de 3 correos existente); (2) construir el formulario de afiliación nuevo (nombres/apellidos, institución, Nequi, asesor, 3 fotos) y la subida al bucket privado con service role; (3) la pantalla del asesor (resumen_clientes_asesor) y su cuenta de demostración (decidida por la cooperativa como solo-app, sin tablas); (4) el flujo de participar/confirmar del sorteo. `ga-diseno-a-codigo` necesita maquetar esas pantallas nuevas (no existen en `docs/mapa-de-botones.md` todavía). Preguntas abiertas para la cooperativa en `docs/spec-fase-2.md` §"Preguntas abiertas" (plantilla del correo de boleta, tope de intentos del sorteo, cómo se activa la demo del asesor, texto del asesor en el desplegable público, import de asesores en lote).
