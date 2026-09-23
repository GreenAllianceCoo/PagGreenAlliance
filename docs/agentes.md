# Agentes de Claude Code — Green Alliance

## Instalación
Los agentes viven en `.claude/agents/` dentro del repo `PagGreenAlliance` (se suben a git, así tu compañero del backend también los tiene). Además necesitas:

```
.claude/agents/   ← los 7 agentes
design/           ← pantallas del diseño (PC + celular)
docs/             ← spec + mapa de botones (+ docs/auditorias/ que crea el auditor)
```

Abre Claude Code en el repo y escribe `/agents` para confirmar que aparecen los 7.

## Los agentes
| Agente | Qué hace | Modifica la app | Dónde escribe |
|---|---|---|---|
| `ga-auditor-supabase` | Audita RLS, triggers, funciones y migraciones de la base | No | `supabase/migrations/` (solo propuestas, sin aplicar), `docs/auditorias/` |
| `ga-diseno-a-codigo` | Pasa el diseño a páginas y componentes Next.js responsive | Sí (solo visual) | `app/`, `components/`, estilos |
| `ga-funcionalidad-botones` | Conecta botones y formularios (OTP Supabase, afiliación, Resend, sesión) | Sí (solo lógica) | `app/`, `lib/`, `proxy.ts` |
| `ga-escritor-tests` | Pruebas unitarias (Vitest) y de base de datos (pgTAP): validaciones, reglas del crédito, RLS | No | `tests/unit/`, `tests/integration/`, `supabase/tests/` |
| `ga-revisor-seguridad` | Revisa el código buscando fugas de datos, bypass de auth y montos manipulables | No, solo reporta | — |
| `ga-verificador-responsive` | Prueba de 320 a 1920 px y los patrones responsive | No, solo reporta | `tests/responsive/`, `test-results/` |
| `ga-verificador-qa` | Prueba de punta a punta botones, validaciones, privacidad y fidelidad al diseño | No, solo reporta | `tests/e2e/`, `test-results/` |

## Orden recomendado

La idea: **primero la base de datos, porque todo lo demás depende de ella; después cada pantalla con su propia verificación rápida; y al final la verificación completa antes de entregar.**

### Fase 0 — Base de datos (una vez, y cada vez que cambie el esquema)
1. `Usa ga-auditor-supabase para auditar la base y sincronizar las migraciones con el repo`
2. **Tú** revisas las migraciones propuestas y las aplicas (el agente nunca toca producción).
3. `Usa ga-escritor-tests para configurar Vitest y escribir las pruebas de RLS y triggers` → deja lista la base de pruebas.

> Mientras haces la fase 0 puedes correr en paralelo el paso 1 de la fase 1: el maquetador no toca la base.

### Fase 1 — Maquetar
1. `Usa ga-diseno-a-codigo para crear los tokens y los componentes UI` (una vez).
2. Luego pantalla por pantalla, en este orden: `/ingresar` → `/ingresar/codigo` → `/afiliacion` → `/afiliacion/enviada` → `/cuenta` → `/`.

### Fase 2 — Por cada pantalla (ciclo corto)
1. `Usa ga-funcionalidad-botones para implementar los botones de <pantalla>`
2. En paralelo:
   - `Usa ga-escritor-tests para probar la lógica de <pantalla>`
   - `Usa ga-revisor-seguridad para revisar los cambios de <pantalla>`
3. Corrige lo crítico y lo alto antes de pasar a la siguiente pantalla.

Empieza por `/ingresar` + `/ingresar/codigo` (login) y `/cuenta` + solicitud de crédito: son las pantallas que manejan datos personales y dinero.

### Fase 3 — Antes de entregar o desplegar
1. En paralelo: `Usa ga-verificador-responsive y ga-verificador-qa`
2. `Usa ga-revisor-seguridad para revisar todo el proyecto` (revisión completa, no solo el último cambio).
3. `Usa ga-auditor-supabase para una última auditoría` si hubo migraciones nuevas.

## Quién corrige qué
Cada reporte indica el agente que debe corregir. Pásale el hallazgo tal cual:

| Tipo de hallazgo | Lo reporta | Lo corrige |
|---|---|---|
| Visual, textos, responsive | responsive, QA | `ga-diseno-a-codigo` |
| Botón que no hace lo que dice la spec, validación en servidor, lógica | QA, seguridad, tests | `ga-funcionalidad-botones` |
| RLS, triggers, índices, migraciones | auditor, seguridad, tests | `ga-auditor-supabase` propone → **tú** aplicas |
| Código difícil de probar | tests | `ga-funcionalidad-botones` (extraer a `lib/`) |
| Secretos, variables de Vercel/Supabase | seguridad | **Tú** |

Después de cada corrección, vuelve a correr **solo** el agente que encontró el problema.

## Qué se puede correr en paralelo
- ✅ Los que solo reportan o escriben en carpetas de pruebas distintas: seguridad + tests, responsive + QA, auditor + maquetador.
- ❌ `ga-diseno-a-codigo` y `ga-funcionalidad-botones` sobre la misma pantalla: tocan los mismos archivos.
- ❌ `ga-escritor-tests` y `ga-verificador-qa` la **primera vez**: los dos instalan dependencias en `package.json`. Después de la primera instalación ya pueden ir juntos.

## Antes de empezar
- Revisa `docs/mapa-de-botones.md`: marca como **Definido** o **Pendiente** lo que cambie. Es la lista que siguen el agente de funcionalidades y el de QA.
- Copia los logos a `public/logos/`.
- Instala Supabase CLI + Docker y corre `supabase start`: lo usan `ga-escritor-tests` (pgTAP) y `ga-verificador-qa` (login y afiliación). Ningún agente toca el proyecto de producción.
- Conecta el MCP de Supabase en Claude Code con el nombre `supabase` para que el auditor pueda leer la base remota.
- Regla del crédito confirmada (2026-09-23): tasa de interés mensual por grado y porcentaje (se muestra, no se calcula cuota), monto mínimo 100.000. Ver la migración `20260923160000_blindar_solicitudes_y_revisiones.sql`.
