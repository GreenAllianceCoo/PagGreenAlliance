APROBADO

# Verificación 2 · 2026-09-23 · ga-verificador-qa

Segunda verificación después de la corrección de F-01 en `components/pantallas/Afiliacion.tsx`: el select «Grado» ahora tiene un `key` que depende de `valores.grado_id`.

Entorno: `next dev` en http://localhost:3000 contra Supabase **local** (`.env.development.local`) y Chrome instalado. Proyectos: escritorio 1280×800 y celular 390×844.

## Resultado
`npx playwright test -c tests/e2e`: **188 pasan, 0 fallan, 10 se omiten a propósito** (pruebas que solo aplican a un tamaño y la revisión estática, que corre una sola vez).

| Sección | Resultado |
|---|---|
| A. Navegación | Todo pasa |
| B. Ingreso | Todo pasa |
| C. Cuenta | Todo pasa |
| D. Afiliación | Todo pasa, incluida F-01 |
| E. Fidelidad al diseño | Todo pasa |
| F. Accesibilidad | Todo pasa; axe sin violaciones |
| G. Revisión estática | Todo pasa |

## F-01: corregida
- **Error del navegador** (autorización sin marcar): «Grado» conserva «PT», igual que los demás campos. Lo cubre la prueba «Checkbox sin marcar → error; lo escrito se conserva», que falló en la verificación 1 y ahora pasa.
- **Error del servidor** (cédula con solicitud pendiente, D6): tras «Ya tenemos una solicitud pendiente con esta cédula…», se conservan «Grado» (PT), la cédula, el correo y la casilla marcada. Agregué esta comprobación a `tests/e2e/d-afiliacion.spec.ts` › D6 y pasa en escritorio y celular.

## Otros cambios en las pruebas
- Quité el `eslint-disable` que sobraba en `tests/e2e/g-estatico.spec.ts`. `npx eslint tests/e2e` ya no da advertencias.

## Sigue abierto (no son fallas; ver verificación 1)
- O-01: límite por IP basado en `x-forwarded-for`; lo debe revisar `ga-revisor-seguridad`.
- O-02: «Reenviar código» deshabilitado se ve igual que habilitado.
- Correos de Resend: no se pudo leer el log de `next dev`.
- Pendientes de datos de la cooperativa: WhatsApp, días hábiles, política de datos, convenios en /cuenta, cifras y testimonios, nombre completo del grado.
