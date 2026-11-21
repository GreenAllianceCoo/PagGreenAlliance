# Spec · Módulo de convenios (fase 1)

Estado: **aprobada** (2026-11-21). B1 escrito: `supabase/migrations/20261121000000_convenios_publicaciones.sql` y `supabase/tests/10_convenios_publicaciones.sql` (aplicada en producción el 2026-11-21; pgTAP 48/48 ok).
Fuente: `docs/prompt-convenios-y-rediseno.md`. Esquema real consultado en producción
(`sqpmxizxkqorccpvjwoz`): enum `rol_usuario` = `asociado, admin, asesor, secretario`;
`convenios.nit` es texto con formato (`902.038.118-7`); 8 convenios, todos visibles;
`handle_new_user` crea un `perfiles` con rol `asociado` para todo usuario de Auth.

Se trabaja en 6 bloques, en orden. Cada bloque cierra con reporte en el buzón y fila en
`docs/avances/horas-convenios.md`.

---

## B1 · Modelo de datos y RLS (una migración + pgTAP)

**Enum.** `alter type public.rol_usuario add value 'convenio'` en su propia migración
(un valor nuevo de enum no se puede usar en la misma transacción).

**`convenios`: columnas nuevas**
| columna | tipo | nota |
|---|---|---|
| `nit_base` | text, **generada** | `regexp_replace(split_part(nit,'-',1),'\D','','g')`. Índice único parcial (`where nit_base <> ''`). |
| `correo_acceso` | citext null | Correo al que llega el código. Único. |
| `usuario_id` | uuid null → `auth.users` `on delete set null` | Único. La cuenta del convenio. |

**Decisión NIT (para documentar):** se guarda y se compara **sin dígito de verificación**.
El convenio puede escribir `902038118`, `902.038.118-7` o `9020381187`: se quitan puntos y
espacios; si trae guion se toma lo de antes; si no trae guion y los dígitos tienen un
carácter de más, se acepta solo si el último coincide con el DV calculado (algoritmo DIAN)
sobre el resto. El admin sigue escribiendo el NIT como hoy (con formato); `nit_base` sale solo.

**`perfiles` del convenio.** El trigger existente le crea el perfil con rol `asociado` y
cédula `PENDIENTE-xxxx`; la acción del admin (service role) lo cambia a rol `convenio` y
cédula `CONVENIO-xxxxxxxx`. Las pantallas de asociados ya filtran `rol = 'asociado'`;
hay que revisar contadores y métricas del admin que no filtran (lo hace `ga-auditor-supabase`).

**Tabla `convenio_publicaciones`** (una sola tabla para promociones y catálogos, así el
feed es una consulta)
| columna | tipo | regla |
|---|---|---|
| `id` | uuid pk | |
| `convenio_id` | uuid → `convenios` `on delete restrict` | |
| `tipo` | enum `tipo_publicacion` (`promocion`, `catalogo`) | |
| `titulo` | text | 3–80 caracteres |
| `descripcion` | text null | ≤ 600; obligatoria en promoción |
| `beneficio` | text null | ≤ 30 («20% off»); solo promoción |
| `imagenes` | text[] | rutas del bucket. Promoción: exactamente 1. Catálogo: 0–10 |
| `pdf_path` | text null | solo catálogo; catálogo = PDF **o** imágenes, no ambos |
| `inicia_el` / `termina_el` | date | promoción: ambas obligatorias, fin ≥ inicio, máx. 1 año. Catálogo: opcionales |
| `oculta_en`, `oculta_por`, `oculta_motivo` | timestamptz / uuid / text ≤ 200 | solo admin |
| `creada_en`, `actualizada_en` | timestamptz | |

**Activa** = convenio visible, `oculta_en is null`, `inicia_el ≤ hoy` (o null) y
`termina_el ≥ hoy` (o null), con *hoy* en `America/Bogota`. Se filtra en la consulta, sin cron.
Se expone como función `public.publicacion_activa(p)` (stable) para reutilizarla en RLS y en el código.

**Estado que ve el convenio** (calculado, no guardado): Oculta por Green Alliance >
Vencida (`termina_el < hoy`) > Programada (`inicia_el > hoy`) > Publicada.

**Límites** (trigger `before insert or update`, con `pg_advisory_xact_lock` por convenio):
máx. 10 promociones y 5 catálogos **no vencidos y no ocultos** (publicadas + programadas).
Mensaje claro al pasarse.

**Métricas.** Tabla `convenio_publicacion_eventos (publicacion_id, tipo 'vista'|'whatsapp',
asociado_id, dia)` con único `(publicacion_id, tipo, asociado_id, dia)`: una vista por
asociado y día. Se escribe solo por RPC `registrar_evento_publicacion(id, tipo)`
(security definer, solo asociados, solo si la publicación está activa). El convenio lee
los totales con `metricas_mis_publicaciones()`; no ve quién fue.

**Funciones auxiliares** (security definer, `search_path = ''`, sin `execute` para anon):
`convenio_del_usuario()` → uuid del convenio de `auth.uid()` si tiene rol convenio y el
convenio está visible; si no, null. `correo_por_nit(text)` → solo `service_role`, igual que
`correo_por_cedula` (devuelve correo solo si el convenio está visible y tiene cuenta).

**RLS `convenio_publicaciones`**
- Convenio: `select/insert/update/delete` donde `convenio_id = convenio_del_usuario()`.
  `update/delete` solo si `oculta_en is null`. Un trigger impide que alguien que no sea admin
  cambie `oculta_*` o `convenio_id`.
- Asociado (rol `asociado`, activo, no eliminado): `select` donde `publicacion_activa`.
- Admin y secretario (`es_admin()`): `select` y `update` de todo (ocultar/mostrar). No borran.
- anon: nada.

**Storage.** Bucket privado `convenios-publicaciones`, ruta
`<convenio_id>/<publicacion_id>/<archivo>`. Límite del bucket 15 MB; tipos
`image/webp` y `application/pdf` (las imágenes llegan ya convertidas a webp por sharp en el
servidor, máximo 5 MB de entrada). Escribe y borra el convenio en su carpeta; lee el dueño, el
admin y el asociado cuando el archivo pertenece a una publicación activa. El asociado recibe
URLs firmadas de 1 h que genera el servidor con su propia sesión.

**pgTAP** (`supabase/tests/`): una prueba por política: el convenio A no ve ni escribe lo
de B; el convenio no puede quitar un ocultamiento; el asociado no ve ocultas, vencidas,
programadas ni de convenios no visibles; anon no ve nada; el límite 10/5; `correo_por_nit`
no se puede llamar como anon o authenticated. Si Docker no está disponible, quedan escritas
y se avisa.

---

## B2 · Cuenta y acceso

**Admin → Convenios** (`app/admin/convenios/`): el formulario gana dos campos, **NIT** (ya
existe; se valida que dé un `nit_base` de 6 a 10 dígitos y que no se repita) y **correo de
acceso**. Al guardar con correo nuevo o cambiado, la acción (service role):
1. crea el usuario de Auth con `email_confirm: true` (o cambia su correo), sin contraseña;
2. pone el perfil en rol `convenio`;
3. guarda `usuario_id` y `correo_acceso`;
4. envía por Resend el correo «Ya puedes publicar en Green Alliance» con el enlace a `/ingresar/convenio`.

El correo no puede ser el de un asociado, asesor o admin (si existe en Auth con otro rol,
error de campo). En la tabla del admin, una columna «Acceso»: Sin cuenta · Activa · Desactivada.

**Desactivar / eliminar.** Desactivar = `visible = false` (como hoy): no puede entrar,
`convenio_del_usuario()` devuelve null y sus publicaciones dejan de ser activas, sin borrarse.
**Cambio propuesto:** «Eliminar» un convenio que tiene cuenta o publicaciones pasa a ser
desactivar + quitar del listado (columna `eliminado_en`), porque la FK `restrict` no deja
borrar la fila. Los convenios sin cuenta ni publicaciones se siguen borrando como hoy.

**Ingreso con NIT.** `/ingresar` gana un enlace «¿Eres empresa en convenio? Entra con tu NIT»
→ `/ingresar/convenio` (un campo: NIT). Se reutiliza `lib/ingreso/servidor.ts` sin duplicar:
- `DatosIngreso` gana `t: "cedula" | "nit"` (sin `t` = cédula, para que las cookies vivas sigan sirviendo).
- `enviarCodigo(id, tipo)` y una función `correoDe(tipo, id)` que llama a `correo_por_cedula`
  o a `correo_por_nit`. Los límites usan las mismas claves con el prefijo del tipo.
- El paso 2 sigue siendo `/ingresar/codigo` (mismos textos, con «NIT» en lugar de «cédula»).
- `verificarCodigoIngreso` redirige rol `convenio` → `/convenio`.

El layout de `/convenio` exige rol `convenio` y convenio visible en cada petición; si no, cierra
la sesión y manda a `/ingresar?cuenta=inactiva`. `/cuenta`, `/admin` y `/asesor` rechazan el rol convenio.

---

## B3 · Panel del convenio (`/convenio`)

- **Inicio:** logo y nombre comercial del convenio; dos contadores («3 de 10 promociones»,
  «1 de 5 catálogos»); lista de publicaciones con su **línea de pasos**
  (Programada → Publicada → Vencida; «Oculta por Green Alliance» rompe la línea y muestra el
  motivo), vistas y clics en WhatsApp.
- **Nueva promoción / Nuevo catálogo** (`/convenio/nueva?tipo=…`): formulario con vista
  previa de cómo la verá el asociado. Imágenes ≤ 5 MB → webp con sharp (máx. 1600 px);
  PDF ≤ 15 MB, se valida la firma `%PDF`. Se publica al guardar, sin aprobación.
- **Editar** (`/convenio/[id]`): mismos campos; no se puede editar una oculta. **Retirar**
  borra la publicación y sus archivos (solo si no está oculta).
- El convenio no edita su perfil (logo, video, sedes, WhatsApp) en la v1.
- Estilo nuevo desde el inicio (dirección aprobada); 390 px como referencia.

## B4 · Admin: publicaciones

`/admin/convenios/publicaciones`: tabla de todas, con filtro por convenio, tipo y estado.
Acciones **Ocultar** (motivo opcional, ≤ 200) y **Volver a mostrar**. Queda en el historial
del admin quién ocultó y cuándo. Enlace desde cada convenio a sus publicaciones.

## B5 · Beneficios para el asociado

- `/cuenta/beneficios`: feed de publicaciones activas, primero las más recientes; filtros por
  aliado, categoría (`especialidad`) y ciudad (sacada de `sedes`; los convenios sin sedes
  salen en «Todo el país»). Etiqueta **Nuevo** si `creada_en` es de los últimos 7 días. Logos
  reales de los aliados. Entrada en el menú de `/cuenta`.
- `/cuenta/beneficios/[id]`: imagen o galería, visor de PDF (`<iframe>` con la URL firmada y
  enlace de descarga como respaldo en celular) y botón de WhatsApp del convenio (reusa
  `enlaceWhatsappConvenio`). Registra la vista al abrir y el clic antes de salir a wa.me.
- El detalle de cada convenio en `/cuenta` muestra sus publicaciones activas.
- Nada es visible sin sesión: la landing no cambia.

## B6 · Cierre

Pruebas unitarias (normalización del NIT y del DV, estados, validaciones, límites), e2e de
Playwright (convenio entra con NIT → publica → el asociado la ve → el admin la oculta → el
convenio la ve oculta) y responsive en 390 px. Actualizar `docs/entrega/manual-administracion.md`
y crear `docs/entrega/guia-convenios.md`. Rama desde `origin/main` y un PR por bloque grande.

---

## Decisiones (2026-11-21)

1. NIT sin dígito de verificación, aceptando las tres formas de escribirlo. **Sí.**
2. Eliminar = desactivar (`eliminado_en`) para convenios con cuenta o publicaciones. **Sí.**
3. Métricas: **las dos**. Vistas y clics totales (tope de 20 por asociado y día, para que recargar no infle) y únicos (asociados distintos).
4. El secretario también oculta y vuelve a mostrar publicaciones. **Sí** (`es_admin_o_secretario()`).
5. El convenio puede retirar (borrar) sus publicaciones, salvo las ocultas. **Sí.**

## Ajustes al escribir B1

- La cuenta va en una tabla aparte, `convenio_cuentas (convenio_id, usuario_id, correo_acceso)`, que solo lee el admin, en lugar de columnas en `convenios`, porque `convenios` la leen todos los autenticados.
- `vincular_cuenta_convenio(convenio, usuario, correo)` (solo service role) pone el rol `convenio` y la cédula `CONVENIO-xxxxxxxx`, y se niega a convertir a un asociado real (solo perfiles `PENDIENTE-…` recién creados).
- Rol comparado como texto en toda la migración (mismo patrón que la del secretario) para poder agregar el valor del enum en el mismo archivo.
- Las rutas de los archivos se validan en la tabla: `<convenio_id>/<publicacion_id>/<archivo>`.
- Los pgTAP corren dentro de una transacción con `rollback`; Docker no está instalado en este equipo.
