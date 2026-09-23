# Auditoría Supabase — Green Alliance (2026-09-23)

- **Agente:** ga-auditor-supabase (Fase 0, paso 1 de `docs/agentes.md`)
- **Proyecto:** PagGreenAlliance, ref `sqpmxizxkqorccpvjwoz` (PRODUCCIÓN)
- **Acceso a la base remota:** SÍ. Se leyó con el MCP de Supabase: `list_tables`, `list_migrations`, `list_extensions`, `get_advisors` (security y performance) y `execute_sql` solo con `select` sobre catálogos (`pg_policies`, `pg_proc`, `pg_trigger`, `pg_constraint`, `pg_indexes`, `information_schema.role_table_grants`, `supabase_migrations.schema_migrations`) y `count(*)`. No se leyeron filas de datos personales. No se modificó nada en la base.
- **Repo:** antes de esta auditoría no existía `supabase/` (ni `migrations/` ni `config.toml`). Solo estaba `supabase_schema.sql`.

---

## 1. Inventario

### Tablas (`public`)

| Tabla | RLS | Filas | Políticas | Triggers | Notas |
|---|---|---|---|---|---|
| `perfiles` | Sí | 1 | 5: `perfiles_select_propio`, `perfiles_select_admin` (select); `perfiles_update_propio`, `perfiles_update_admin` (update); `perfiles_insert_admin` (insert). Sin delete. | `tr_proteger_campos_perfil` (before update) | `cedula` unique. FK a `auth.users` on delete cascade. 0 admins. |
| `grados_credito` | Sí | 10 | 2: `grados_select_autenticado` (select, true); `grados_admin_todo` (all) | — | PK (grado, porcentaje). |
| `solicitudes_credito` | Sí | 0 | 3: `solicitudes_select_propio`; `solicitudes_insert_propio`; `solicitudes_admin_todo` (all) | `chk_monto_solicitud` (before insert/update of monto, porcentaje, asociado_id); `tr_sellar_revision` (before update) | Índice único parcial `ux_solicitud_pendiente_por_asociado`. |
| `convenios` | Sí | 0 | 2: `convenios_select_activos`; `convenios_admin_todo` (all) | — | Faltan `emoji` y `especialidad` (spec). |
| `solicitudes_afiliacion` | — | — | — | — | **No existe** (la spec la pide). |

Todas las políticas están declaradas `to authenticated`. Ninguna para `anon`.

### Trigger en `auth.users`
- `tr_on_auth_user_created` → `public.handle_new_user()` (after insert).

### Funciones (`public`), todas `security definer`, todas con `search_path = public, pg_temp`

| Función | Uso | EXECUTE para |
|---|---|---|
| `es_admin()` | Políticas RLS (evita recursión en `perfiles`) | authenticated, service_role |
| `handle_new_user()` | Trigger en `auth.users` | service_role |
| `proteger_campos_perfil()` | Impide que un asociado cambie `rol`, `grado`, `cedula` | service_role |
| `validar_monto_solicitud()` | Tope + recálculo de cuota/plazo (regla provisional) | service_role |
| `sellar_revision_solicitud()` | Sella `revisado_por`/`fecha_respuesta`; bloquea cambio de estado de resueltas | service_role |

### Extensiones instaladas
`pgcrypto`, `uuid-ossp`, `pg_stat_statements` (schema `extensions`), `supabase_vault`, `plpgsql`. `pg_graphql` no está instalada.

### Migraciones: remoto vs repo

| Versión | Nombre | Remoto | Repo antes | Repo ahora |
|---|---|---|---|---|
| — | esquema inicial (`supabase_schema.sql`, ejecutado a mano) | no registrada | solo `supabase_schema.sql` | `20260922000000_esquema_inicial.sql` (línea base) |
| 20260922210921 | fix_rls_y_reglas_negocio | aplicada | **no** | `20260922210921_fix_rls_y_reglas_negocio.sql` (copia textual) |
| 20260922211050 | fix_mensaje_porcentaje_validar_monto | aplicada | **no** | `20260922211050_fix_mensaje_porcentaje_validar_monto.sql` (copia textual) |

Diferencias `supabase_schema.sql` ↔ esquema real: tablas, enums, llaves y datos de `grados_credito` coinciden. Lo que difiere es todo lo que cambiaron las dos migraciones remotas (políticas nuevas, `es_admin`, triggers nuevos, índice único parcial, `handle_new_user`). `supabase_schema.sql` ya **no** sirve para montar un entorno igual a producción: usar `supabase/migrations/`.

### Avisos de `get_advisors`
- Security: `authenticated_security_definer_function_executable` (`es_admin`), `auth_leaked_password_protection`.
- Performance: `auth_rls_initplan` (4), `multiple_permissive_policies` (6), `unindexed_foreign_keys` (`revisado_por`), `auth_db_connections_absolute`.

---

## 2. Hallazgos

| ID | Severidad | Objeto | Problema | Escenario | Corrección | Migración propuesta |
|---|---|---|---|---|---|---|
| H-01 | **Crítica** | `handle_new_user()` (trigger en `auth.users`) | Toma `grado` y `cedula` de `raw_user_meta_data`, que controla quien se registra. | Con la anon key pública: `POST /auth/v1/signup { email, password, data: { grado: 'OF', cedula: '<cédula de otro policía>' } }`. El trigger crea el perfil con grado OF (tope 4.200.000 en lugar de, por ejemplo, 1.000.000 de un PP) y la cédula ajena. El `rol` no se toma de metadatos (bien), pero el grado define cuánto puede pedir, y la cédula define a quién le llega el código del login. Pasa si "Allow new users to sign up" está activo en Auth (no se puede leer por SQL; hay que revisarlo en el panel). | Leer cédula y grado solo de `raw_app_meta_data` (solo lo escribe el servidor con service role), validar formato y enum. Además desactivar el registro público en Auth. | `20260923100000_handle_new_user_sin_metadatos_del_cliente.sql` |
| H-13 | **Alta** | Migraciones | Las 2 migraciones aplicadas en producción y el esquema inicial no estaban en el repo. Un entorno nuevo (el backend, una rama, local) tendría una base distinta y sin las correcciones de RLS. | `supabase db reset` en local con solo `supabase_schema.sql` → políticas viejas con recursión y trigger sin `search_path`. | Se crearon los 3 archivos (línea base + 2 copias textuales). Marcar la línea base como aplicada antes de cualquier `db push`. | `20260922000000_esquema_inicial.sql`, `20260922210921_…`, `20260922211050_…` |
| H-02 | **Alta** | `solicitudes_credito` / `sellar_revision_solicitud()` | Una solicitud ya aprobada o rechazada solo tiene bloqueado el `estado`; se pueden cambiar monto, porcentaje, motivo, revisor, fechas, e incluso moverla a otro `asociado_id`. | Un admin (o un error del panel) ejecuta `update solicitudes_credito set monto_solicitado = 4000000 where id = '<aprobada>'` → pasa RLS (`solicitudes_admin_todo`), el trigger de monto recalcula la cuota y la solicitud aprobada queda con otro monto sin rastro. Un asociado **no** puede hacerlo: no tiene política de update. | Congelar las solicitudes resueltas y prohibir cambio de asociado en el trigger; `fecha_solicitud` inmutable. | `20260923100200_integridad_checks_indices_y_bloqueo_resueltas.sql` |
| H-03 | Media | `perfiles.cedula`, `nombre_completo` | La cédula no tiene `check` de formato (el login depende de ella). | `cedula = ' 1234 '` o `'abc'` entraría por el service role o por un admin. Hoy 0 filas violan el formato. | `check` dígitos 6–10 o `PENDIENTE-xxxxxxxx`; largo del nombre. | `20260923100200_…` |
| H-04 | Media | `solicitudes_credito`, `grados_credito` | Sin `check` de valores positivos ni de coherencia estado ↔ revisión (solo el trigger valida monto > 0). | Un admin inserta `estado='aprobado'` sin `fecha_respuesta`, o pone `capacidad_maxima = 0` en `grados_credito` → división por cero en el trigger. | `check` de positivos y de coherencia de estado. | `20260923100200_…` |
| H-05 | Media | 4 políticas (`perfiles_*_propio`, `solicitudes_*_propio`) | `auth.uid()` sin `(select …)` (advisor `auth_rls_initplan`). `es_admin()` tampoco va envuelto. | Con 200+ asociados y miles de solicitudes, el panel del admin evalúa la función por fila. | Envolver en `(select …)`. | `20260923100100_rls_optimizada_y_privilegios.sql` |
| H-10 | Media | `solicitudes_afiliacion` | No existe; la spec la pide con insert solo por servidor y sin acceso público. | El formulario «Deseo afiliarme» no tendría dónde guardar; riesgo de que alguien la cree con una política pública para "hacerla funcionar". | Crear tabla con checks de la spec, RLS solo admin (select/update), sin insert por API, índice único de pendiente por cédula, trigger que solo deja cambiar el estado. | `20260923100300_solicitudes_afiliacion.sql` |
| H-12 | Media (preventivo) | Login por cédula | `perfiles` no tiene correo (está en `auth.users`) y anon no puede leer `perfiles` (correcto). | La tentación de abrir `perfiles` a anon o duplicar el correo en una columna legible → cualquiera enumera cédulas y correos. | Función `correo_por_cedula()` ejecutable solo por `service_role`. | `20260923100500_funcion_correo_por_cedula.sql` |
| H-14 | Media | Regla de prorrateo (provisional) | La regla está **aislada en la base** en un solo lugar (`validar_monto_solicitud`, comentario `REGLA PROVISIONAL`), lo cual está bien, pero la app la **duplica** en `app/dashboard/solicitar/actions.ts` con otro redondeo (a miles) y manda `cuota_mensual`/`plazo_meses`, que el trigger sobrescribe (redondeo a pesos). Además, en las 10 filas de `grados_credito`, `total_credito ≠ cuota_mensual × plazo_meses` (ej. PP 50%: 79.000 × 3 = 237.000 vs 1.239.000), así que la premisa del prorrateo es dudosa. | Asociado pide 500.000 como PP/50%: la app calcula 40.000 (39.500 redondeado a miles); la base guarda 39.500. La pantalla puede mostrar un valor distinto al guardado. | Quitar el cálculo de la app (mostrar lo que devuelve la base) — `ga-funcionalidad-botones`. Confirmar la regla con la cooperativa (P-01, P-02). | — (código de la app) |
| H-16 | Media | `grados_credito` ↔ solicitudes pendientes | Si el admin baja un tope o cambia el grado de un asociado, las solicitudes pendientes conservan monto y cuota calculados con el tope viejo; al aprobarlas no se revalida. | Tope PP/100% baja de 2.100.000 a 1.800.000; queda pendiente una de 2.000.000 y el admin la aprueba. | Decidir con la cooperativa (P-03). Si deben revalidarse, agregar la validación al aprobar. | — (pendiente de decisión) |
| H-06 | Baja | 6 pares de políticas permisivas | Advisor `multiple_permissive_policies` (políticas `_propio` + `_admin`/`for all` para la misma acción). | Rendimiento. | Una política por acción con `or`. Misma semántica. | `20260923100100_…` |
| H-07 | Baja | 5 funciones `security definer` | `search_path = public, pg_temp` es fijo (aceptable), pero la práctica recomendada es `''` con nombres calificados (ya lo están). | — | `alter function … set search_path = ''`. | `20260923100100_…` |
| H-08 | Baja | Privilegios de tabla | `anon` y `authenticated` tienen `TRUNCATE`, `REFERENCES`, `TRIGGER`; `anon` tiene insert/update/delete en todo. RLS lo bloquea, pero `TRUNCATE` no pasa por RLS. | Hoy no es explotable por la API REST; defensa en profundidad. | Revocar. | `20260923100100_…` |
| H-09 | Baja | `solicitudes_credito` | FK `revisado_por` sin índice (advisor); `asociado_id` solo cubierto por el índice parcial de pendientes. | Consulta "última solicitud del asociado" y borrado de perfiles. | Índices `revisado_por` y `(asociado_id, fecha_solicitud desc)`. | `20260923100200_…` |
| H-15 | Baja | `solicitudes_insert_propio` | No limita `fecha_solicitud`. | `insert … fecha_solicitud = '2020-01-01'` → la solicitud aparece primera en la cola. | Trigger que fija la fecha en servidor. | `20260923100600_fecha_solicitud_en_servidor.sql` |
| H-11 | Baja | `convenios` | Faltan `emoji` y `especialidad`; la landing (pública) no puede leerlos (solo `authenticated`). | — | Agregar columnas; acceso de la landing por servidor (P-07). | `20260923100400_convenios_emoji_especialidad.sql` |
| H-18 | Baja (aceptado) | `es_admin()` | Advisor: ejecutable por `authenticated` vía `/rest/v1/rpc/es_admin`. | Un asociado solo puede saber si **él** es admin. Es necesario para que RLS la use. | Ninguna. Documentado. | — |
| H-19 | Baja | Auth | Protección de contraseñas filtradas desactivada. Hoy `app/login/page.tsx` usa `signInWithPassword`. | Contraseñas débiles/filtradas. | Activarla en el panel mientras exista login con contraseña (o pasar a OTP como dice la spec). | — (panel de Supabase) |
| H-17 | Info | `perfiles` | **0 administradores** en producción (1 usuario, 1 perfil). Nadie puede aprobar solicitudes ni gestionar topes/convenios desde la app. | — | Sebas promueve al admin desde el SQL Editor (service role; el trigger de protección no aplica sin `auth.uid()`). | — (dato, no migración) |
| H-20 | Info | Auth | Advisor `auth_db_connections_absolute` (10 conexiones fijas). | Solo importa si se sube de instancia. | Cambiar a porcentaje en el panel. | — |

### Escenarios de RLS verificados (no se ejecutaron)

| Escenario (asociado autenticado A) | Resultado | Por qué |
|---|---|---|
| `select * from perfiles` | Solo su fila | `perfiles_select_propio` (`auth.uid() = id`); `es_admin()` = false. |
| `update perfiles set rol='admin' where id = auth.uid()` | Falla | Pasa RLS, pero `tr_proteger_campos_perfil` lanza «No puede modificar su propio rol». |
| `update perfiles set grado='OF' where id = auth.uid()` | Falla | Mismo trigger. (Pero ver H-01: al **registrarse** sí puede fijarlo.) |
| `update perfiles set telefono='…' where id = '<B>'` | 0 filas | `using (auth.uid() = id)`. |
| `insert into perfiles …` | Falla | Solo `perfiles_insert_admin`. |
| `select * from solicitudes_credito` | Solo las suyas | `solicitudes_select_propio`. |
| `insert into solicitudes_credito (asociado_id = '<B>', …)` | Falla | `with check (auth.uid() = asociado_id …)`. |
| `insert … estado='aprobado'` | Falla | `with check` exige `estado='pendiente'` y campos de revisión nulos. |
| `insert … monto_solicitado = 99000000` | Falla | `chk_monto_solicitud`: grado leído de `perfiles`, no del cliente. |
| `insert … cuota_mensual = 1` | Se guarda la cuota calculada por el trigger | El trigger sobrescribe `cuota_mensual` y `plazo_meses`. |
| Segunda solicitud pendiente | Falla | `ux_solicitud_pendiente_por_asociado`. |
| `update solicitudes_credito set estado='aprobado' where id = '<propia>'` | 0 filas | No hay política de update para el asociado. |
| `delete from solicitudes_credito where id = '<propia>'` | 0 filas | No hay política de delete para el asociado. |
| `update grados_credito set capacidad_maxima = 10000000` | 0 filas | Solo `grados_admin_todo`. |
| anon: cualquier `select`/`insert` en `public` | Negado | Ninguna política `to anon`. |

«Es admin» depende de `perfiles.rol`, que el asociado no puede cambiar (trigger) ni fijar al registrarse (`handle_new_user` no lee `rol`). Sin recursión: las políticas usan `es_admin()` `security definer`.

---

## 3. Migraciones

### Sincronización (ya aplicadas en producción; solo versionar)
1. `supabase/migrations/20260922000000_esquema_inicial.sql` — línea base (el esquema que se ejecutó a mano).
2. `supabase/migrations/20260922210921_fix_rls_y_reglas_negocio.sql` — copia textual del remoto.
3. `supabase/migrations/20260922211050_fix_mensaje_porcentaje_validar_monto.sql` — copia textual del remoto.

### Propuestas (NO aplicadas), en este orden
4. `supabase/migrations/20260923100000_handle_new_user_sin_metadatos_del_cliente.sql` — **H-01, crítica. Aplicar primero.**
5. `supabase/migrations/20260923100100_rls_optimizada_y_privilegios.sql` — H-05, H-06, H-07, H-08.
6. `supabase/migrations/20260923100200_integridad_checks_indices_y_bloqueo_resueltas.sql` — H-02, H-03, H-04, H-09.
7. `supabase/migrations/20260923100300_solicitudes_afiliacion.sql` — H-10 (revisar la decisión sobre `grado`).
8. `supabase/migrations/20260923100400_convenios_emoji_especialidad.sql` — H-11.
9. `supabase/migrations/20260923100500_funcion_correo_por_cedula.sql` — H-12 (cuando se implemente el login OTP).
10. `supabase/migrations/20260923100600_fecha_solicitud_en_servidor.sql` — H-15.

### Cómo aplicarlas (lo hace Sebas, no el agente)
1. Si se va a usar la CLI: `supabase init` (el repo no tiene `supabase/config.toml`) y `supabase link --project-ref sqpmxizxkqorccpvjwoz`.
2. **Antes de cualquier `db push`:** `supabase migration repair --status applied 20260922000000 --linked`. Si no, la CLI intentará crear de nuevo tipos y tablas en producción (fallará en `create type`).
3. `supabase migration list --linked` debe mostrar 20260922000000, 20260922210921 y 20260922211050 como aplicadas en local y remoto.
4. Probar primero en local o en una rama (`supabase db reset` aplica 1→10 en limpio) y correr las pruebas de `ga-escritor-tests`.
5. Aplicar 4→10 en ese orden. Tras aplicarlas, volver a correr `get_advisors`.
6. En el panel de Supabase (no es SQL): desactivar "Allow new users to sign up" (H-01), activar protección de contraseñas filtradas (H-19), promover al admin (H-17).

---

## 4. Preguntas abiertas para la cooperativa

- **P-01 (regla de prorrateo, provisional):** ¿La cuota se calcula en proporción al tope (`cuota_tabla × monto / tope`)? ¿O el asociado solo puede escoger entre paquetes fijos (el tope completo)?
- **P-02:** En la tabla de la presentación, `total_credito` no es `cuota × 3` en ningún grado (PP 50%: 79.000 × 3 = 237.000, total 1.239.000). ¿Qué es `cuota_mensual` (interés, cuota de otro plazo, descuento por nómina)? ¿El plazo es realmente 3 meses?
- **P-03:** Si cambian los topes o el grado de un asociado con una solicitud pendiente, ¿se respeta lo pedido o hay que recalcular/rechazar?
- **P-04:** ¿Cómo se crean las cuentas de los 200+ asociados (importación masiva, el admin una por una, al aprobar la afiliación)? Define de dónde sale la cédula/grado (`app_metadata`, H-01).
- **P-05:** ¿El admin puede borrar solicitudes o deben conservarse siempre (auditoría)? Hoy puede borrarlas.
- **P-06:** ¿Es obligatorio el motivo al rechazar?
- **P-07:** ¿La landing pública muestra convenios? (Afecta si hace falta acceso sin sesión; recomendado vía servidor, sin NIT ni teléfono.)
- **P-08:** Afiliación: ¿el formulario pide el grado con los mismos 5 valores (PP, PT, SI, IT, OF)? ¿Se crea el perfil automáticamente al aprobar?

---

## 5. Sugerencias para `ga-escritor-tests` (pgTAP en `supabase/tests/`)

RLS (con `set local role authenticated` + `request.jwt.claims` de dos asociados A y B y un admin):
1. A solo ve su perfil; admin ve todos; anon no ve nada.
2. A no puede cambiar `rol`, `grado`, `cedula` (error del trigger); sí `telefono`/`nombre_completo`.
3. A no puede insertar perfiles ni borrar el suyo.
4. A no puede insertar solicitud a nombre de B, ni con `estado <> 'pendiente'`, ni con `revisado_por`/`fecha_respuesta`.
5. A no puede actualizar ni borrar sus solicitudes (0 filas).
6. A no puede tener dos solicitudes pendientes (violación de índice único).
7. A no puede escribir en `grados_credito`/`convenios`; ve solo convenios activos; admin ve inactivos.
8. anon no puede leer ni insertar en `solicitudes_afiliacion`; admin sí lee y cambia estado; admin no puede cambiar la cédula de la afiliación.
9. `correo_por_cedula()` no es ejecutable por anon ni authenticated.

Triggers:
10. `chk_monto_solicitud`: monto 0, negativo, > tope → error; perfil sin grado → error; cuota/plazo enviados por el cliente se sobrescriben; cuota = `round(cuota_tabla × monto / tope)` (marcar como regla provisional en el test).
11. `tr_sellar_revision`: al aprobar se llenan `revisado_por = admin` y `fecha_respuesta`; una resuelta no cambia de estado; (tras migración 6) no cambia monto ni asociado.
12. `handle_new_user` (tras migración 4): `user_metadata.grado='OF'` → perfil con grado null; `user_metadata.rol='admin'` → rol asociado; `app_metadata.cedula` válida → se usa; cédula inválida → `PENDIENTE-…`.
13. `fecha_solicitud` enviada por el cliente se ignora (tras migración 10).

Vitest (unitario): extraer el cálculo de cuota (si se mantiene en la app) a `lib/` y verificar que coincide con el de la base, o mejor quitarlo y probar que la UI muestra el valor devuelto por la base (H-14).

---

## Respuestas de la cooperativa y cambios (2026-09-23, tarde)

Aplicado en `supabase/migrations/20260923160000_blindar_solicitudes_y_revisiones.sql` y `app/dashboard/`.

| Pregunta | Respuesta | Qué se hizo |
|---|---|---|
| P-01 | Mínimo 100.000. | Monto entero entre 100.000 y el tope (base y app). |
| P-02 | Cada rango tiene su porcentaje de interés; la app no calcula la cuota. | Columna `grados_credito.tasa_interes_mensual` = `cuota_mensual / capacidad_maxima`. Se muestra en su propio cuadro al pedir el crédito y en el dashboard. `solicitudes_credito.cuota_mensual` queda en null. |
| P-03 | Primero en llegar, primero en salir. No se baja el tope con pendientes. | La solicitud guarda el grado y la tasa, y no cambian. Trigger `tr_proteger_topes` impide bajar o borrar un tope con pendientes. |
| P-04 | Las cuentas no se crean por registro; si hay importación será por Excel. | Sin cambios. Registro público desactivado en el panel. |
| P-05 | Conservar las solicitudes. | Se quitó la política `solicitudes_delete_admin`. |
| P-06 | Motivo obligatorio al rechazar. | Constraint `solicitudes_motivo_rechazo_chk`. |
| P-07 | Convenios fijos en la landing por ahora. | Sin cambios. |
| P-08 | No se crea el perfil al aprobar la afiliación; la solicitud queda registrada. | Sin cambios. |
| P-09 | Nadie resuelve su propia solicitud. | `sellar_revision_solicitud()` lo impide. |
| P-10 | Sin respuesta. | — |

**Tasas por rango** (interés mensual de la tabla de la presentación ÷ tope):

| Grado | 50 % | 100 % |
|---|---|---|
| PP | 7,90 % | 6,00 % |
| PT | 5,08 % (0,05076923) | 3,74 % (0,03740741) |
| SI | 8,20 % | 8,20 % |
| IT | 5,05 % | 5,05 % |
| OF | 5,40 % (0,05395349) | 6,33 % (0,06333333) |


`supabase_schema.sql` se borró (H-26): el esquema vive solo en `supabase/migrations/`.
