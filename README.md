# Green Alliance · Plataforma de asociados

Plataforma web de la **Cooperativa Green Alliance**, cooperativa de microcrédito para miembros de la Policía Nacional y del Ejército de Colombia.

Sitio en producción: **https://www.greenallianceco.com**

## Qué hace

**Página pública**
- Presentación de la cooperativa, beneficios, convenios con empresas aliadas (videos y material descargable) y contacto por WhatsApp.
- Formulario de afiliación con institución, grado, datos de nómina, fotos del documento y selfie.
- Política de tratamiento de datos personales (`/politica-de-datos`).
- Verificación pública del carné de un asociado mediante código QR (`/verificar/<código>`), sin datos sensibles.

**Asociado (`/cuenta`)**
- Ingreso con cédula y código de un solo uso enviado al correo; no hay contraseñas.
- Estado de su proceso, solicitud de microcrédito al 50 % o al 100 % del cupo de su grado, y seguimiento de solicitudes.
- Carné virtual «Afiliado Titular» con QR de verificación, descargable en PDF.
- Inscripción al sorteo mensual, perfil, retiro y renovación.

**Asesor (`/asesor`)**
- Resumen con sus cifras, lista de clientes con datos protegidos y comisiones (con corte el día 15).
- Premios por cantidad de asociados: bono de $1.000.000 al primer asesor que llegue a 50 y viaje a San Andrés al primero que llegue a 100.

**Administración (`/admin`)**
- Tablero con métricas, afiliaciones, asociados (estado del proceso, baja, habilitar crédito), créditos y desembolsos.
- Asesores y comisiones, sorteo mensual con inscritos y ganador, alertas y convenios administrables (logos, orden y visibilidad).

## Seguridad y privacidad

- Todas las tablas usan Row Level Security en Supabase. Cada rol (asociado, asesor y administrador) solo ve lo que le corresponde.
- La tasa de interés no se le muestra al asociado. El asesor ve las cédulas enmascaradas y no tiene acceso a contacto, nómina ni fotos.
- Las fotos se suben con URL firmada a un almacenamiento privado, y las que quedan huérfanas se borran cada hora.
- Hay límite de intentos en el ingreso y en los formularios, y las respuestas no permiten averiguar si una cédula está registrada.
- Al correo institucional solo se envía un aviso, sin datos personales.
- Las acciones administrativas quedan registradas en historial.

## Tecnología

| Capa | Herramienta |
|---|---|
| Aplicación | Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS |
| Datos y autenticación | Supabase (Postgres, Auth con OTP por correo, Storage) |
| Correos | Resend |
| Hosting | Vercel (tarea programada cada hora) |
| Pruebas | Vitest (unitarias), pgTAP (base de datos), Playwright (punta a punta, escritorio y celular) |

## Desarrollo local

Requisitos: Node.js 20 o superior, Docker y Supabase CLI.

```bash
npm install
cp .env.example .env.local   # completar las variables
npx supabase start
npx supabase db reset        # aplica las migraciones y el seed
npm run dev                  # http://localhost:3000
```

### Variables de entorno

Las variables están en `.env.example`:
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, que solo se usa en el servidor.
- **Seguridad:** `INGRESO_COOKIE_SECRET`, `LIMITE_HMAC_SECRET` y `CRON_SECRET`.
- **Correo:** `RESEND_API_KEY`, `EMAIL_FROM` y las plantillas `RESEND_TEMPLATE_*`. Si falta una plantilla, el correo se envía como texto plano.
- **Sitio:** `SITIO_URL` y `NEXT_PUBLIC_WHATSAPP`.

Nunca subas `.env.local` al repositorio.

## Pruebas

```bash
npm run lint
npx tsc --noEmit
npm run test:unit                                              # Vitest
npm run test:db                                                # pgTAP (requiere Supabase local)
npx playwright test -c tests/e2e/playwright.config.ts          # punta a punta
```

## Base de datos y despliegue

- El esquema completo vive en `supabase/migrations/`, en orden cronológico, y nunca se edita a mano en el panel de Supabase.
- Las ramas son `develop` (integración) y `main` (producción). Vercel despliega `main` automáticamente.
- Antes de fusionar `develop` en `main`, aplica las migraciones nuevas en producción:
  ```bash
  npx supabase db push --linked
  ```
- Las variables de producción se configuran en Vercel, en **Settings → Environment Variables**.

## Estructura

```
app/            Rutas: pública, /afiliacion, /ingresar, /cuenta, /asesor, /admin, /verificar, /api/cron
components/     Pantallas y componentes de interfaz
lib/            Lógica de negocio, validaciones (zod), correo, clientes de Supabase
supabase/       Migraciones, seed y pruebas pgTAP
tests/          Pruebas unitarias y e2e
docs/           Especificaciones, diseño, auditorías, verificaciones y avances del proyecto
```

## Documentación

- `docs/spec-requerimientos-ricardo-2026-09-29.md`: requerimientos vigentes de la cooperativa.
- `docs/mapa-de-botones.md`: qué hace cada botón y formulario.
- `docs/resend-plantillas.md`: correos y plantillas.
- `docs/avances/`: plan y avances del proyecto.

---

© Cooperativa Green Alliance. Uso interno; todos los derechos reservados.
