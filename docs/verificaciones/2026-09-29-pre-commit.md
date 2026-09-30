# Verificación pre-commit · rama `rediseno-c-plus` · 2026-09-29

Objetivo: confirmar que las 4 suites afectadas por el crédito de prueba huérfano quedan en verde y que la suite completa, vitest, tsc, lint y build también pasan, antes de que la sesión principal haga el commit y la fusión a `develop`.

## 1. Las 4 suites afectadas (con `npx supabase db reset` antes)

Orden: `k-roles.spec.ts` → `c-cuenta.spec.ts` → `e-diseno.spec.ts` → `i-despliegue.spec.ts` (Playwright las corre en orden alfabético de archivo dentro de cada proyecto, no en el orden del comando).

- **Antes de mi corrección** (con el `afterAll` de `k-roles.spec.ts` ya aplicado, sin tocar): 72 ok / **2 fallas** / 18 saltadas.
  - `[celular] e-diseno.spec.ts:323` — «Inicio del asociado /cuenta · Textos, orden, colores y fuente (asociado con solicitud)»: todos los textos esperados salían «FUERA DE ORDEN».
  - `[celular] i-despliegue.spec.ts:318` — «I2 · Con solicitud pendiente (asociado 1234567890)»: no aparecía el aviso «Ya tienes una solicitud pendiente de revisión».
- **Después de mi corrección**: **74 ok / 0 fallas** / 16 saltadas (exit code 0).

### Causa

El `afterAll` nuevo de `k-roles.spec.ts` borra el crédito de **prueba** que ese archivo crea para el asociado 2 (1234567891), pero el segundo test de `k-roles.spec.ts` («admin: KPIs coherentes, atajos J/K/A/R/Esc…») también **resuelve el crédito del *seed*** (cédula 1234567890, «Asociado de Prueba», $500.000, único registro de `supabase/seed.sql`): ese test junta las dos solicitudes pendientes que hay en ese momento (la del seed + la nueva del asociado 2) y dentro del mismo test rechaza una y aprueba la otra — así que el crédito del seed **siempre** termina en `aprobado` o `rechazado`, nunca vuelve a quedar `pendiente`.

Como Playwright corre los archivos en orden alfabético por proyecto (`c, e, f, g, h, i, j, k, z`) y el proyecto `celular` corre **completo después** del proyecto `escritorio` (sin reset entre proyectos), cualquier prueba de `c-cuenta`, `e-diseno` o `i-despliegue` en `celular` que dependa de que el crédito del seed siga «pendiente» hereda la mutación que dejó `k-roles.spec.ts` al correr en `escritorio`. Confirmé con una consulta directa a la base (`solicitudes_credito`) que, tras la corrida, esa fila queda en `estado='aprobado'`.

Intenté además "reponerla" con un `UPDATE` normal y no se puede: hay un trigger (`sellar_revision_solicitud`, migración `20260923173355_blindar_solicitudes_y_revisiones.sql`) que congela cualquier solicitud ya resuelta («Una solicitud ya resuelta no puede cambiar de estado») — es una regla de negocio intencional (H-23/P-09), no un bug. La única forma de reponerla es borrar la fila y volver a crearla igual que el seed.

`c-cuenta.spec.ts` en particular **no** apareció en la lista de fallas a pesar de tener la misma dependencia (`expect(texto).toContain("En revisión")`), porque esa aserción es débil: «En revisión» también es la etiqueta de un paso del stepper de la pantalla (Enviada → En revisión → Aprobada/Desembolso), así que sigue apareciendo en el texto aunque el estado real ya sea «Aprobada». La until pasaba por casualidad, no porque el dato estuviera bien; lo dejé corregido igual para que no sea frágil.

### Corrección (dentro de `tests/`, sin tocar `k-roles.spec.ts`)

- `tests/e2e/utils.ts`: nueva función `restaurarCreditoDeEjemplo()` — busca el perfil de `USUARIOS.conSolicitud` (cédula 1234567890), y si su solicitud de crédito más reciente no está `pendiente`, la borra y crea una igual a la del seed (`porcentaje_devolucion: "50"`, `monto_solicitado: 500000`).
- `tests/e2e/c-cuenta.spec.ts`: `test.beforeAll(restaurarCreditoDeEjemplo)` en el describe «C2 · Con sesión: datos del propio usuario».
- `tests/e2e/e-diseno.spec.ts`: `test.beforeAll(restaurarCreditoDeEjemplo)` en el describe «E · Inicio del asociado /cuenta».
- `tests/e2e/i-despliegue.spec.ts`: se agregó `await restaurarCreditoDeEjemplo()` al `beforeEach` ya existente del describe «I2 · /cuenta/solicitar» (junto a `borrarSolicitudesSinSolicitudes()`).

Revisé también `h-credito.spec.ts` y `f-accesibilidad.spec.ts`, que tienen la misma cédula/usuario cerca de la palabra «En revisión»: no dependen del crédito del *seed* (usan la asociada `sinSolicitudes` o textos genéricos de landing/axe), así que no necesitaron el mismo arreglo. `j-produccion.spec.ts` usa `ID_CON_SOLICITUD` solo para `perfiles`, no para `solicitudes_credito`: tampoco le afecta.

## 2. Suite completa (`npx supabase db reset` + `npx playwright test -c tests/e2e/playwright.config.ts`)

**290 pasadas / 0 fallidas / 36 saltadas** (19.6 min, exit code 0).
- Escritorio: 161 ok, 2 saltadas.
- Celular: 129 ok, 34 saltadas (incluye las 6 pruebas de `k-roles.spec.ts` × proyecto que son «solo escritorio», y las de límites de intentos que ya corrieron en la corrida parcial anterior — Playwright no las repite dentro de la misma invocación cuando dependen de ventanas de tiempo ya consumidas, quedan como saltos esperados, no fallas).

Antes del arreglo, la corrida completa reportada por la sesión principal daba 285 pasadas / 5 fallidas (las mismas 5 líneas ya conocidas). 285 + 5 = 290 = 290 + 0 ahora: mismo universo de pruebas, sin fallas nuevas ni pruebas perdidas.

## 3. Resto de comprobaciones

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | Sin errores |
| `npx vitest run` | 347 pasadas / 347 (21 archivos) |
| `npm run lint` | Sin problemas (exit code 0) |
| `npm run build` | Compila y genera las 19 rutas sin errores (exit code 0) |

## Conclusión

**Listo para commit.** No se tocó código de la aplicación, solo `tests/e2e/utils.ts`, `tests/e2e/c-cuenta.spec.ts`, `tests/e2e/e-diseno.spec.ts` y `tests/e2e/i-despliegue.spec.ts` (además de este archivo). `tests/e2e/k-roles.spec.ts`, el lienzo y el resto de `docs/` quedaron intactos, como se pidió.
