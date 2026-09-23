# Green Alliance — esqueleto del proyecto

Login funcionando + dashboard protegido, conectado a Supabase. Punto de partida
para que Claude Code continue con el flujo de solicitud de credito y el panel
de administracion.

## 1. Crear la base de datos

El esquema vive en `supabase/migrations/` (en orden). No lo ejecutes a mano en
el SQL Editor.

- **Local:** `npx supabase start` y luego `npx supabase db reset`.
- **Producción:** `npx supabase link --project-ref <ref>` y luego
  `npx supabase db push`.

Crea las tablas `perfiles`, `grados_credito` (con los topes y tasas de interés
reales), `solicitudes_credito`, `convenios` y `solicitudes_afiliacion`, con RLS
activado. Las pruebas de la base se corren con `npm run test:db`.

## 2. Conectar las variables de entorno

1. Copia `.env.example` como `.env.local`.
2. En Supabase: **Settings > API**, copia la "Project URL" y la "anon public
   key" y pegalas en `.env.local`.

## 3. Correr el proyecto localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## 4. Crear el primer usuario admin (tu mismo, para probar)

Como el registro publico todavia no esta construido, crea tu primer usuario
manualmente:

1. En Supabase: **Authentication > Users > Add user**. Usa como correo
   `TUCEDULA@asociados.greenallianceco.com` y una contrasena.
2. El perfil se crea solo. En el **SQL Editor**, hazlo admin:
   `update public.perfiles set rol = 'admin' where id = '<id del usuario>';`
3. Ya puedes entrar en `/login` con esa cedula y contrasena.

## 5. Desplegar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En Vercel: **Add New Project**, importa el repositorio.
3. Agrega las mismas variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en la configuracion del proyecto en
   Vercel.
4. Conecta el dominio `greenallianceco.com` desde **Settings > Domains**.

## Que falta (siguiente con Claude Code)

- Formulario de solicitud de credito (`/dashboard/solicitar`): elegir 50/100,
  monto segun tope, envio.
- Notificacion por correo via Resend cuando se crea o resuelve una solicitud.
- Panel de administracion (`/admin`): listado de solicitudes, aprobar/rechazar.
- Registro publico de nuevos asociados.
- Seccion de convenios.
