# Auditoría · migración `20260923210000_limite_de_intentos.sql`

- Fecha: 2026-09-23 · Autor: ga-auditor-supabase (solo lectura)
- Proyecto: PagGreenAlliance (`sqpmxizxkqorccpvjwoz`), Postgres 17.6
- Fuentes: MCP de Supabase (`list_migrations`, `list_tables`, `get_advisors` security/performance, `select` sobre `pg_class`, `pg_proc`, `pg_default_acl`, `pg_extension`), la migración, `supabase/tests/06_limites_intentos.sql`, `lib/servidor/limite.ts`, `lib/supabase/admin.ts`, `lib/ingreso/servidor.ts`, `app/afiliacion/actions.ts`.
- No se ejecutó nada que cambie la base.

## Veredicto

**Se puede aplicar tal cual.** No hay hallazgos críticos ni altos. Los puntos medios y bajos se pueden corregir después, en la app o en una migración posterior, y ninguno bloquea.

## 1. Estado de producción antes de aplicar

| Qué | Resultado |
|---|---|
| Migraciones remotas | 11, la última es `20260923173355_blindar_solicitudes_y_revisiones`. Coinciden con el repo. Solo falta `20260923210000`. |
| `public.limites_intentos`, su índice o su secuencia | No existen. No hay choque de nombres. |
| `public.registrar_intento` (cualquier firma) | No existe. `create or replace` no choca con otra firma ni con otro tipo de retorno. |
| Extensiones | `pgcrypto` en `extensions`. **No hay `pg_cron`** y la migración no lo necesita. |
| Privilegios por defecto (`postgres` en `public`) | Tablas: `anon`/`authenticated` = `arwdm`. Funciones: `anon`/`authenticated` = `X`. Secuencias: `anon`/`authenticated` = `rwU`. La migración revoca los de la tabla y la función (ver M-3 para la secuencia). |
| Patrón existente | `correo_por_cedula` ya usa el mismo esquema: `security definer`, `search_path=""`, ACL solo `postgres` y `service_role`. Esta migración sigue igual. |

## 2. Seguridad

| Punto | Resultado |
|---|---|
| RLS | Habilitado y sin políticas: `anon` y `authenticated` quedan denegados. El aviso `rls_enabled_no_policy` (INFO) es esperado. |
| Grants de la tabla | `revoke all ... from public, anon, authenticated` quita también `MAINTAIN` (PG17). Quedan `postgres` y `service_role`. |
| Grants de la función | `revoke all ... from public, anon, authenticated` y `grant execute ... to service_role`. Así se evitan los avisos 0028/0029 (`*_security_definer_function_executable`). |
| `security definer` | Con `set search_path = ''`. Referencias calificadas (`public.limites_intentos`). Todas las funciones de sistema que usa (`now`, `make_interval`, `hashtextextended`, `pg_advisory_xact_lock`, `random`, `char_length`) están en `pg_catalog`, que siempre se busca. |
| Validación de entradas | Rechaza una clave vacía, nula o de más de 200 caracteres, y `p_maximo` o `p_ventana_segundos` menores que 1. |
| Datos personales | No se guardan en claro: la clave es `tipo:sha256(tipo:valor)[0..40]`. Sin embargo, es un hash **sin secreto** y se puede revertir (ver M-2). |
| pg_graphql / PostgREST | Sin grants para `anon` ni `authenticated`, la tabla no se ve en `/rest/v1` ni en GraphQL para ellos. |

Escenarios (no ejecutados):
- `anon` hace `POST /rest/v1/rpc/registrar_intento` → `42501 permission denied for function`. No tiene `EXECUTE`. Lo cubre la prueba pgTAP 06.
- Un asociado autenticado hace `select * from limites_intentos` → `42501`. No tiene grant, y aunque lo tuviera, RLS no tiene políticas.
- Un asociado autenticado hace `delete from limites_intentos` para reiniciar su contador → `42501`, por la misma razón.

## 3. Idempotencia

- `create table if not exists`, `create index if not exists`, `create or replace function`, `comment`, `revoke` y `grant` se pueden repetir sin error.
- Advertencia teórica: si algún día ya existiera una `limites_intentos` con otra forma, `if not exists` la dejaría igual sin avisar. Hoy no existe, así que no pasa nada.

## 4. Correctitud

- **Candado.** `pg_advisory_xact_lock(hashtextextended(p_clave, 0))` usa una llave de 64 bits por clave y se libera al terminar la transacción. PostgREST corre cada RPC en una transacción propia, y la función es `volatile` (por defecto), así que va por POST en modo lectura-escritura. Dos peticiones simultáneas con la misma clave se ponen en fila: la segunda cuenta después de que la primera hizo commit. En el repo no hay otros advisory locks, así que no hay colisiones con otros usos. Una colisión de hash entre dos claves solo las pondría en fila, sin error.
- **Ventana.** Es deslizante: `creado_at > now() - ventana`. `now()` es la hora de inicio de la transacción, y eso basta. Si se llega al máximo, **no se inserta** la fila, así que los intentos rechazados no alargan el bloqueo.
- **Si la RPC falla** (la base no está disponible, la migración no está aplicada, `PGRST202`, falta la service key): `dentroDelLimite` **deja pasar** (`return true`) y registra `limite_de_intentos_fallo`. Ver M-1.
- **Orden en `/ingresar`.** Primero `otp-ip` (20 cada 15 min), luego `otp-cedula-45s` (1 cada 45 s) y luego `otp-cedula` (5 cada 15 min), con corte en cuanto uno falla. Se consume el contador aunque la cédula no exista, y eso está bien: no revela si la cédula existe.
- **Orden en `/afiliacion`.** Primero la validación y luego `afiliacion-ip` (5/h) y `afiliacion-cedula` (3/día). Un formulario inválido no gasta intentos.

## 5. Crecimiento y rendimiento

- Solo se insertan los intentos **aceptados**, así que el tamaño tiene un tope práctico: claves distintas × máximo por ventana.
- **Limpieza dentro de la función:** en el 2 % de las llamadas se borran las filas de más de 2 días. La ventana más larga en uso es de 1 día (`afiliacion-cedula`), así que el margen alcanza. No hace falta `pg_cron`.
- El índice `(clave, creado_at desc)` cubre el `count(*)` por clave y fecha. El `delete ... where creado_at < ...` no tiene índice por `creado_at` y recorre la tabla completa. Con pocos miles de filas (más de 200 asociados, tráfico bajo) no importa (B-1).
- Si hay muy poco tráfico, la limpieza casi no corre, pero en ese caso la tabla también es pequeña.

## 6. Hallazgos

| ID | Severidad | Objeto | Problema | Escenario | Corrección | Migración |
|---|---|---|---|---|---|---|
| M-1 | Media | `lib/servidor/limite.ts` (`dentroDelLimite`) | Si falla la RPC, deja pasar. Si el código se despliega **antes** que la migración, los límites quedan apagados sin que nadie lo note, porque solo se escribe un log. | La RPC devuelve `PGRST202 function not found` en cada llamada. Un bot envía 500 afiliaciones por hora desde una IP. | Aplicar la migración **antes** de desplegar (paso 6.8 antes de 6.5). Poner una alerta en los logs de Vercel para `limite_de_intentos_fallo`. Opcional: en `/afiliacion`, bloquear si la RPC falla. En `/ingresar`, Supabase Auth tiene su propio límite de correos, que sirve de segunda barrera. | No (código) |
| M-2 | Media | Clave de `limites_intentos` (`claveHash`) | El SHA-256 no lleva secreto. Las cédulas (unos 10 dígitos) y las IPv4 (2^32) se pueden revertir por fuerza bruta en minutos. Son datos personales seudonimizados, no anónimos (Ley 1581). | Quien obtenga un volcado de la tabla, con service role o un backup, recupera las cédulas que intentaron entrar en los últimos 2 días. | Cambiar a `createHmac("sha256", <secreto del servidor>)`. Puede ser una variable nueva `LIMITE_HASH_SECRET` o una derivada de `INGRESO_COOKIE_SECRET`. No cambia la base: la clave sigue siendo texto de 1 a 200 caracteres. Al cambiarlo se reinician los contadores, sin más efecto. | No (código) |
| M-3 | Baja | Secuencia `limites_intentos_id_seq` | Por los privilegios por defecto de `postgres`, la secuencia de identidad hereda `anon=rwU` y `authenticated=rwU`. No se puede explotar por la API (PostgREST no expone `nextval`), pero le sobran privilegios. | No hay ruta práctica desde la API. | En una migración posterior: `revoke all on sequence public.limites_intentos_id_seq from public, anon, authenticated;` | Opcional, más adelante |
| B-1 | Baja | `delete` de limpieza | Recorre la tabla completa porque no hay índice por `creado_at`. | Solo importa si la tabla llega a cientos de miles de filas. | Si crece: `create index if not exists ix_limites_intentos_creado on public.limites_intentos (creado_at);` | Opcional |
| B-2 | Baja | `registrar_intento` | La limpieza de 2 días está fija. Si alguien usa una ventana de más de 2 días, el conteo sale menor sin avisar. | `dentroDelLimite(..., 7*24*3600)` cuenta como mucho 2 días. | Validar `p_ventana_segundos <= 172800` en la función, o documentarlo. | Opcional |
| B-3 | Baja | `ipDelCliente` | Toma el primer valor de `x-forwarded-for`. En Vercel está bien porque Vercel reescribe ese encabezado. Fuera de Vercel se podría falsificar. Si falta, todos comparten la clave `"desconocida"`. | Solo afecta si se despliega detrás de otro proxy. | Mantener el despliegue en Vercel o validar el origen del encabezado. | No |

Avisos de `get_advisors` que tienen que ver:
- Seguridad: hoy solo aparece `0029 authenticated_security_definer_function_executable` sobre `public.es_admin()`. Ya existía, es intencional (lo usan las políticas RLS) y no tiene que ver con esta migración. Después de aplicarla se espera solo un INFO `rls_enabled_no_policy` para `limites_intentos`, que es el comportamiento buscado.
- Rendimiento: índices sin uso en tablas vacías (INFO, normal sin tráfico) y `auth_db_connections_absolute` (INFO). Ninguno tiene que ver con esta migración.

## 7. Pasos para aplicarla (Sebas)

1. Confirmar que el repo local está en `develop` con el archivo `supabase/migrations/20260923210000_limite_de_intentos.sql` sin cambios.
2. `npx supabase link --project-ref sqpmxizxkqorccpvjwoz` (si no está enlazado).
3. `npx supabase db push --dry-run`. Debe listar **solo** `20260923210000_limite_de_intentos.sql`. Si aparece otra, detenerse.
4. `npx supabase db push`.
5. Verificar en el SQL Editor (solo lectura):
   ```sql
   select version, name from supabase_migrations.schema_migrations order by version desc limit 1;
   select relrowsecurity, relacl from pg_class where oid = 'public.limites_intentos'::regclass;
   select proacl, proconfig from pg_proc where oid = 'public.registrar_intento(text,integer,integer)'::regprocedure;
   ```
   Lo esperado: `20260923210000 / limite_de_intentos`, `relrowsecurity = true`, ACL de la tabla sin `anon` ni `authenticated`, ACL de la función `{postgres=X/postgres,service_role=X/postgres}` y `search_path=""`.
6. Volver a correr los avisos de seguridad en el dashboard. Solo debería aparecer el nuevo INFO `rls_enabled_no_policy` para `limites_intentos`.
7. Después desplegar la app (orden 6.8 → 6.5) y revisar que no salgan logs `limite_de_intentos_fallo`.

## 8. Pruebas sugeridas para ga-escritor-tests

- pgTAP: la función devuelve `false` y **no inserta** cuando se llega al límite (`count(*)` no cambia).
- pgTAP: `p_maximo = 0`, `p_ventana_segundos = 0` y una clave de 201 caracteres lanzan `P0001`.
- pgTAP: `authenticated` no puede ejecutar `registrar_intento`. Hoy solo se prueba `anon` en sesión; `authenticated` se prueba por privilegio, pero no llamándola.
- pgTAP: la ventana expira. Insertar como `postgres` una fila con `creado_at = now() - interval '2 minutes'` y comprobar que no cuenta en una ventana de 60 s.
- Vitest: `dentroDelLimite` devuelve `true` y registra `limite_de_intentos_fallo` cuando la RPC da error. Si se adopta M-2, la clave no contiene la cédula ni el hash simple.
