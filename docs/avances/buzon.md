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

## 2026-09-27 · ga-verificador-responsive
- Actividades: 6.17, 6.19
- Estado: Hecho
- Qué se hizo: Verificación responsive del rediseño C+ (15 rutas × 10 anchos 320-1920 + horizontal 844×390, Playwright/Chrome contra Supabase local). 9 hallazgos responsive (5 críticos: barra inferior flotante tapa contenido real en /cuenta y /asesor —confirmado con capturas—, scroll horizontal real en /admin/creditos, botones <44px en el encabezado móvil del admin, tabla de /admin/sorteo sin versión en tarjetas; 4 menores) más 1 hallazgo crítico fuera del alcance responsive estricto: los colores `bg-admin-*`/`text-admin-*` del panel de administración no existen en el CSS compilado (tailwind.config.ts los anida bajo la paleta `ga` en vez de un grupo propio `admin`), así que el panel se ve blanco/sin tema oscuro en todos los anchos. tests/responsive/responsive.spec.ts y logo-y-fotos.spec.ts actualizados (nav sin «Historias», sin espacios de foto, nuevas rutas /asesor y /admin/*). Informe completo en docs/verificaciones/2026-09-27-rediseno-c-plus-responsive.md.
- Bloqueos o trabajo nuevo: para ga-diseno-a-codigo, en orden: (0) anidar los colores admin-* bajo su propia clave en tailwind.config.ts; (1) revisar el solape de la barra inferior flotante con contenido real (/cuenta, /asesor); (2) flex-wrap en el filtro de /admin/creditos; (3) subir a 44px los controles del encabezado móvil del admin; (4) tabla de /admin/sorteo a tarjetas en celular. No se pudo probar /admin/* en horizontal (844×390) por el límite diario de reenvío de código del correo de prueba del admin (protección anti-abuso ya probada antes, no es un hallazgo nuevo).

## 2026-09-27 · ga-diseno-a-codigo
- Actividades: 6.17
- Estado: Hecho
- Qué se hizo: Corregidos todos los hallazgos de docs/verificaciones/2026-09-27-rediseno-c-plus-responsive.md. Confirmado con capturas que el hallazgo #0 (colores admin-* fuera de `ga` en tailwind.config.ts) ya estaba resuelto: el panel /admin ahora se ve con su tema oscuro real en /admin/creditos, /admin/afiliaciones (+detalle), /admin/asesores, /admin/sorteo y /admin/demo, a 1440 y 390px. De paso, axe encontró (y se corrigió) un problema de contraste nuevo que solo aparecía en /admin/demo escritorio: el encabezado compartido (EncabezadoAdmin) se volvía transparente en `lg:` pensando que siempre estaría sobre el fondo oscuro del admin, pero en /admin/demo esa misma barra flota sobre el fondo claro de la vista de asociado — se le puso el mismo fondo oscuro opaco que ya usa en celular, y se agregó `text-admin-texto` explícito al bloque nombre+«Salir» que heredaba el color de texto claro por defecto. Corregidos también: #1 barra inferior flotante de /cuenta y /asesor (en vertical corto aparece recién tras el primer scroll para no tapar contenido que cae por coincidencia en la franja inferior de la primera pantalla — components/ui/BarraInferior.tsx nuevo; en horizontal bajo 844×390 deja de flotar del todo vía CSS); #2 flex-wrap en el filtro de /admin/creditos; #3 controles del encabezado móvil del admin a 44×44 (botón «☰», pestañas, logo); #4 tabla de /admin/sorteo con versión en tarjetas para celular; #5 botones Volver/Cerrar de /cuenta/solicitar a 44px fijos; #6 casillas OTP a 44px de ancho a 320px; #7 selects de /admin/sorteo a 16px. tsc, lint, build, vitest (316/316) y playwright k-roles+f-accesibilidad (36/36, 6 skip esperados) en verde tras `npx supabase db reset`.
- Bloqueos o trabajo nuevo: ninguno para esta corrección. Pendiente de que otra sesión re-corra tests/responsive/responsive.spec.ts completo (no estaba en el alcance de esta tarea): su función `medirSolapeBarraInferior` scrollea hasta el final de la página y comprueba que la barra sea visible ahí — sigue siendo válido — pero la comprobación de «barra inferior flotante visible» en `medir()` (línea ~428, ancho<1024) puede fallar en el primer instante de una prueba que no haga scroll antes de medir, porque ahora la barra empieza oculta (opacity:0, `inert`) hasta que `window.scrollY > 8`; si ese test falla por eso, hay que ajustarlo para hacer un pequeño scroll antes de medir (o revisar `p.barraInferior` después de un scroll), no es un bug de la app.
