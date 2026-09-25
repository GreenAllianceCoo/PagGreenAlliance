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

## 2026-09-25 · ga-diseno-a-codigo
- Actividades: nuevo (tanda 3 del rediseño C+: panel del asociado, piezas 2b y 3d de docs/Green Alliance C+.dc.html); relacionada con 1.7/2.15
- Estado: Hecho
- Qué se hizo: Pasé a código el panel del asociado (/cuenta y /cuenta/solicitar) siguiendo las piezas 2b y 3d del lienzo C+: encabezado en píldora flotante en escritorio (components/pantallas/EncabezadoCuenta.tsx), comprobante «Tu solicitud» con sello girado y pasos con entrada animada, insignia de estado con color real (aprobada/rechazada/en revisión, antes siempre ámbar), tope con medidor visual, carné de asociado (nombre, cédula enmascarada, grado — con `institucion`/`activo` como props opcionales sin usar, TODO(backend)), franja informativa del sorteo junto al saludo, barra inferior de navegación en celular (anclas a las secciones de la misma página), y deslizador de monto con relleno/thumb propios en /cuenta/solicitar (mismo `<input type="range">`, mismo `name`, sin tocar el envío). «Tu camino a la estabilidad» queda escrito pero sin renderizarse (prop `caminoEstabilidad` nunca se pasa): falta la fecha del primer descuento del embargo solidario (P-90). Agregué `enmascararCedula` a lib/mascara.ts con pruebas. Revisé a fondo tests/e2e (a-navegacion, c-cuenta, e-diseno, f-accesibilidad, h-credito, i-despliegue, j-produccion, k-roles) antes de tocar el marcado para no romper roles/textos/orden esperados: por eso «Nueva solicitud» y «Convenios» siguen repetidos en `nav[aria-label="Accesos"]` aunque el mockup los mueve solo al menú/barra inferior (documentado en el código). npx tsc --noEmit, npm run lint, npm run build y npx vitest run (311 pruebas) pasan en verde; no corrí Playwright (requiere Supabase local).
- Bloqueos o trabajo nuevo: P-90 (fecha del primer descuento del embargo solidario) y la fila «Carné de asociado» de docs/auditorias/2026-09-25-backend-rediseno-c-plus.md (institución/activo en perfiles) siguen bloqueando esas 2 piezas visuales. Quedan TODO(pendiente-spec) ya existentes (página propia de convenios, número de WhatsApp). Falta correr tests/e2e/c-cuenta.spec.ts, h-credito.spec.ts, i-despliegue.spec.ts (I2), j-produccion.spec.ts y k-roles.spec.ts contra Supabase local para confirmar que el rediseño no rompió nada (ga-verificador-qa).
