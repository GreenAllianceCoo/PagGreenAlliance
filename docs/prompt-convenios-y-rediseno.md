# Green Alliance: módulo de convenios + rediseño

Trabajas en `green-alliance-app` (Next.js 16 App Router, Tailwind v3, Supabase `sqpmxizxkqorccpvjwoz`, Vercel, dominio www.greenallianceco.com). Lee `CLAUDE.md` y `AGENTS.md` antes de empezar.

## Decisiones cerradas (no reabrir)
- **Seguimos en Next.js + Supabase + Vercel.** Se evaluó migrar a Django y se descartó: no mejora lo visual, obliga a reescribir lo que ya funciona y a cambiar de hosting, y a este volumen no aporta escalabilidad. El Postgres actual no cambia.
- **Orden:** 1) módulo de convenios (se cobra por horas reales, estimado 52–68 h), ya con el estilo nuevo en sus pantallas; 2) rediseño del resto (no se cobra, ~25–35 h).
- Lleva un registro de horas reales por bloque en `docs/avances/horas-convenios.md` (fecha, bloque, horas, qué se hizo). El cliente paga según ese registro.
- Sigue el sistema de avances de `CLAUDE.md`: reporte en `docs/avances/buzon.md` al cerrar cada bloque y luego invocar a `ga-supervisor-avances` (agrega los bloques de la fase 1 a `docs/avances/plan.json`).

## Fase 1: rol "empresa convenio"

**Cuenta y acceso**
- Nuevo valor `convenio` en el enum `public.rol_usuario` (hoy: `asociado`, `admin`, `asesor`), con una migración nueva en `supabase/migrations/`.
- Una cuenta por convenio, vinculada a la fila de `public.convenios`. La crea el admin al crear o editar un convenio en Admin → Convenios (`app/admin/convenios/`), con dos campos nuevos: **NIT** (único, solo dígitos, sin dígito de verificación o con él normalizado; decide y documenta) y **correo de acceso**.
- Ingreso: el convenio escribe su NIT y recibe un **código de 6 dígitos al correo** (vence en 10 min). **Reutiliza el flujo actual de cédula** en `lib/ingreso/servidor.ts` (`correoDeCedula`, `enviarCodigo`, `signInWithOtp`, cookie `ga_ingreso`, límites de verificación) en lugar de duplicarlo. Sin contraseñas. Los correos salen por Resend como los actuales.
- Si el convenio se desactiva o elimina: no puede entrar y sus publicaciones se ocultan, sin borrarse.
- El convenio NO edita su perfil (logo, video, sedes, WhatsApp) en la v1; eso sigue en manos del admin.

**Publicaciones** (sin aprobación previa: se publican directo)
- **Promoción:** título, descripción, 1 imagen, beneficio opcional ("20% off"), fecha de inicio y de fin. Se oculta sola al vencer (filtrar por fecha en la consulta, sin cron).
- **Catálogo:** título, un PDF o varias imágenes, vigencia opcional.
- Límites por convenio: 10 promociones activas y 5 catálogos activos. Imágenes de hasta 5 MB (comprimir a webp en el servidor con sharp) y PDFs de hasta 15 MB. Bucket propio en Supabase Storage.
- El admin puede **ocultar** cualquier publicación con un motivo opcional. El convenio la ve como "Oculta por Green Alliance" con el motivo y no puede reactivarla.
- Estados que ve el convenio: Publicada · Programada · Vencida · Oculta por Green Alliance. Muéstralos con la línea de pasos (el detalle propio del diseño, ver abajo).
- Métricas simples por publicación, visibles para el convenio: vistas y clics en WhatsApp.

**Lo que ve el asociado**
- Nueva sección **"Beneficios"** dentro de la sesión del asociado: feed de todas las publicaciones activas, con filtros por aliado, categoría (`especialidad`) y ciudad (`sedes`), un visor de PDF y la etiqueta "Nuevo" para las de los últimos 7 días. Sin notificaciones en la v1.
- En el detalle de cada convenio, sus publicaciones activas.
- Nada de esto es visible sin iniciar sesión.

**Seguridad (RLS)**
- El convenio solo lee y escribe sus propias publicaciones y archivos.
- Los asociados con sesión leen solo las activas, de convenios activos y que no estén ocultas.
- El admin lo ve y lo oculta todo.
- Agrega pruebas pgTAP para cada política (las existentes requieren Docker; si no está disponible, dilo y deja las pruebas escritas).

**Cierre de la fase 1**
- Pruebas: unitarias, e2e de Playwright (convenio entra con NIT → publica → el asociado lo ve → el admin lo oculta) y responsive en 390 px.
- Actualiza `docs/entrega/manual-administracion.md` y crea `docs/entrega/guia-convenios.md` (cómo entra y publica un convenio).
- Trabaja en una rama desde `origin/main` y abre un PR por bloque grande; no hagas merge sin que el usuario lo pida.

## Fase 2: rediseño (pulido, conservando la marca)

Usa la skill `unslop` sobre cada pantalla: primero audita, presenta la auditoría y espera el visto bueno del usuario antes de editar. Prioridad: landing → login (`app/ingresar`, `app/verificar`) → panel del asociado (`app/cuenta`) → admin (solo pulido, sin rehacerlo). Las pantallas con sesión no se han auditado: entra con las cuentas de prueba de los tests e2e.

**Dirección (aprobada)**
- **Producto:** cooperativa de crédito, orientación financiera y apoyo legal para familias de la Policía y el Ejército, con beneficios de aliados.
- **Carácter:** firme, cercano, ordenado.
- **Mundo:** escudo y protección, hojas de servicio, trámites que avanzan paso a paso. Neutros con un leve tinte verde grisáceo, el verde de la marca como acento y el azul marino como tinta. Mantén el logo, la paleta y la tipografía actuales.
- **Momentos:** en la landing, la tarjeta "Tu solicitud" (4 pasos) como protagonista, renderizada con cuidado, más fotos reales de las sedes (`public/sedes/*.webp`) en lugar de la cuadrícula de círculos. En la sesión, el feed de Beneficios con los logos reales de los aliados.
- **Detalle propio:** la línea de pasos con checks (Enviada → En revisión → Aprobada → Desembolso), reutilizada en "3 años" (01–03), en el proceso de crédito y en los estados de las publicaciones. Solo ahí.
- No usar insignias oficiales de la Policía ni del Ejército.

**Hallazgos de la auditoría de la landing a corregir**
1. Cuadrícula de círculos y manchas decorativas en el hero: quitarlas y dejar la tarjeta de solicitud con fotos de las sedes.
2. "Aprobados en poco tiempo" suelto bajo los botones, sin dato: quitarlo o convertirlo en un dato real que confirme el usuario.
3. Manchas decorativas en Misión, Visión, Sedes y Horario: quitarlas.
4. Etiquetas en mayúsculas con letras separadas (NUESTRA MISIÓN, HORARIO DE ATENCIÓN, categorías de convenios): pasarlas a tipo oración.
5. Títulos muy gruesos y titulares que terminan en punto: bajar el peso (400–600) y quitar los puntos.
6. "Lo que encuentras": círculos de color en lugar de íconos y tres tarjetas iguales en colores distintos. Usar íconos lucide de un solo tamaño y trazo y darle ritmo a la cuadrícula. Lo mismo para los pasos 01–03.
7. Tarjetas de convenios: el nombre se repite (razón social y nombre comercial; mostrar solo el comercial), hay nombres en mayúsculas sostenidas y los logos tienen tamaños y fondos desiguales (usar una caja uniforme).
8. Bugs: en la 404 el texto del botón "Volver al inicio" se sale del botón; el footer se ve apretado; en celular el visual del hero queda después de "Aprobados".

## Eficiencia de tokens (obligatorio)
- Corre `graphify query "<pregunta>"` desde `C:\Users\Sebastian\Documents\Guishe` antes de buscar o leer código, y `graphify update .` después de cambiar código. Pon esta regla en el prompt de cada subagente que explore código.
- Usa los agentes del proyecto en `.claude/agents/` en lugar de crear subagentes genéricos: `ga-auditor-supabase` (migraciones y RLS), `ga-revisor-seguridad`, `ga-escritor-tests`, `ga-verificador-qa`, `ga-verificador-responsive`, `ga-revisor-diseno`, `ga-diseno-a-codigo`, `ga-correos`. Usa también las skills de Supabase de `.claude/skills/`.
- Antes de codificar, escribe una spec corta por bloque en `docs/spec-convenios.md` (máx. una página por bloque) y trabaja bloque por bloque, sin cargar todo a la vez.
- Para verificar pantallas usa Playwright (ya está instalado; lanzar con `executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'`) solo al cerrar cada pantalla, no en cada cambio.
- Usa el MCP de Supabase para las consultas y migraciones; no pegues datos grandes en el chat.
- Comandos en Git Bash. Rutas de sharp con `C:/...`, no `/c/...`. Push con `GIT_TERMINAL_PROMPT=0`. `gh` no está instalado: entrega la URL de compare para abrir el PR.

## Empieza por
1. Leer `CLAUDE.md` y `AGENTS.md`, y hacer consultas con graphify sobre `lib/ingreso/servidor.ts`, `app/admin/convenios/` y `lib/convenios.ts`.
2. Escribir `docs/spec-convenios.md` con el modelo de datos, las políticas RLS y las pantallas, y pedirme el visto bueno antes de crear migraciones.
