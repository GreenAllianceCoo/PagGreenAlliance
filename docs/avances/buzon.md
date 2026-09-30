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

## 2026-09-29 · ga-auditor-supabase
- Actividades: requerimientos de Ricardo (backend), trabajo nuevo sin ID en plan.json; resuelve P-46 (nombres oficiales de los grados)
- Estado: Hecho (solo en local; nada se aplicó en remoto)
- Qué se hizo: 8 migraciones propuestas 20260929100000..100700 (catálogo de 17 grados con grupo de crédito, atiende_asociados, nómina y 2 correos, proceso ejecutivo con historial, alertas de retiro y renovación, comisiones con contador oculto, convenios con servicios y sedes más sus datos, y Ricardo con atiende_asociados), seed ampliado y pgTAP 12–15 (328/329 en verde en local).
- Bloqueos o trabajo nuevo: Sebas revisa y aplica en remoto, junto con las 5 propuestas 20260925200*. La lista blanca de supabase/tests/00 (test 14) está desactualizada. Falta el código de la app: lib/grados.ts, tope por grupo_credito, formulario de afiliación, /cuenta, /asesor y /admin. Hay preguntas para la cooperativa (R-01 a R-09 y las nuevas).

## 2026-09-30 · ga-disenador-lienzo
- Actividades: nueva: Lienzo C+ piezas 3j–3n (requerimientos de Ricardo, spec 29-sep)
- Estado: Hecho
- Qué se hizo: maquetadas en `docs/Green Alliance C+.dc.html` (t3) las piezas 3j (afiliación v3), 3k (perfil del asociado), 3l (asesor: comisiones y búsqueda por cédula), 3m (admin: asociados, alertas, pagos de comisión, «Atiende asociados») y 3n (detalle de convenios con textos literales de la migración); índice y pedidos D-10 a D-14 actualizados; script y balance de etiquetas validados.
- Bloqueos o trabajo nuevo: pasar 3j–3n a código con `ga-diseno-a-codigo`; el backend de todo lo nuevo (grados, cuenta de nómina, alertas, pagos_comision, proceso ejecutivo) está en las migraciones propuestas, sin aplicar.

## 2026-09-30 · ga-auditor-supabase
- Actividades: requerimientos de Ricardo (respuestas de Sebas, spec §8), trabajo nuevo sin ID en plan.json
- Estado: Hecho (solo en local; nada se aplicó en remoto)
- Qué se hizo: 3 migraciones propuestas nuevas: 20260930100000 (pagos de comisión que el admin corrige o anula con motivo, con bitácora inmutable; el acumulado solo suma los pagos vigentes), 20260930100100 (la tasa y sus derivados no se leen por la API; tabla_credito_con_tasa() para asesor y admin) y 20260930100200 (crédito solo con el asociado activo y el proceso en «operando»). También: seed con los asociados 1 y 2 en «operando», lista blanca de la prueba 00 al día, fixtures en 01/03/07/12 y pgTAP 16. En local: 364/364 en verde.
- Bloqueos o trabajo nuevo: Sebas aplica en remoto (antes, dar proceso «operando» a los asociados que ya piden crédito). Código: cargarPaquetesDemo pasa a rpc("tabla_credito_con_tasa"); /cuenta/solicitar valida y muestra «Podrás pedir tu crédito cuando tu proceso esté operando»; /admin de pagos usa las RPC de edición y anulación. Pendiente de decidir: ocultar solicitudes_credito.tasa_interes_mensual al asociado (afecta /admin/creditos, la prueba 03 y la e2e i-despliegue).

## 2026-09-30 · ga-auditor-supabase (2)
- Actividades: requerimientos de Ricardo (spec §8: el asociado nunca lee la tasa), trabajo nuevo sin ID en plan.json
- Estado: Hecho (solo en local; nada se aplicó en remoto)
- Qué se hizo: migración propuesta 20260930100300. authenticated ya no lee solicitudes_credito.tasa_interes_mensual (permisos por columna; Realtime lo respeta), y el admin la obtiene con admin_tasas_solicitudes(uuid[]). Se ajustaron las pruebas 03, 01 (una línea), 00, 15 y 16. pgTAP en local: 371/371 en verde.
- Bloqueos o trabajo nuevo: ga-funcionalidad-botones debe cambiar app/admin/creditos/page.tsx (tasa por RPC) y lib/asesor/cargarPaquetesDemo.ts (rpc tabla_credito_con_tasa). ga-verificador-qa debe cambiar tests/e2e/i-despliegue.spec.ts (~394–438: Prefer return=minimal). Sebas aplica en remoto las 4 migraciones 20260930* junto con las anteriores.

## 2026-09-30 · ga-funcionalidad-botones
- Actividades: requerimientos de Ricardo (capa de lógica y datos de 3j–3n, spec §1–§8), trabajo nuevo sin ID en plan.json
- Estado: Hecho (lógica y datos; la parte visual la hace ga-diseno-a-codigo)
- Qué se hizo: catálogo de grados con tope por grupo de crédito; afiliación v3 (esquema zod, nómina en cascada, dos correos, asesor de la lista, fotos por URL firmada con ticket y verificación, compresión a 2400 px y verificador de foto); aprobación que copia los datos nuevos al perfil; avisos al correo personal e institucional; /cuenta con proceso ejecutivo, conteos de 36 meses y del crédito, retiro y renovación, y la regla «solo con el proceso operando»; /asesor con comisiones, acumulado y búsqueda por cédula (también para admins que atienden); /admin con acciones y loaders de proceso, alertas, pagos (registrar, corregir, anular, bitácora) y «Atiende asociados»; convenios desde la base con wa.me; la tasa ya no se lee por la API (demo y /admin/creditos por RPC). tsc, lint y build limpios; vitest 465/465.
- Bloqueos o trabajo nuevo: ga-diseno-a-codigo pasa 3j–3n a pantallas con el contrato del reporte; pedidos de diseño D-15 (corregir/anular pago y bitácora) y D-16 (crédito bloqueado hasta «Operando»); ga-verificador-qa ajusta e2e (afiliación v3, cédula enmascarada en /asesor, crédito solo con proceso operando); Sebas aplica las migraciones 20260929* y 20260930* en remoto junto con el código.

## 2026-09-30 · ga-revisor-seguridad
- Actividades: revisión de seguridad de los requerimientos de Ricardo (migraciones 20260929100*/20260930100* y capa de lógica), trabajo nuevo sin ID en plan.json
- Estado: Hecho
- Qué se hizo: auditoría en `docs/auditorias/2026-09-30-seguridad-requerimientos-ricardo.md`: 0 críticos, 2 altos (RS-01, admin que atiende puede pagarse comisiones a sí mismo; RS-02, correo institucional sin verificar recibe cédula, montos y boleta), 6 medios (fotos huérfanas, oráculo de tiempo en S-06, `es_admin` ignora `activo`, Realtime y permisos por columna sin probar, next 16.3.5 con aviso crítico, tasa real en el JS de la demo) y 8 bajos o informativos.
- Bloqueos o trabajo nuevo: ga-auditor-supabase: RS-01, RS-05, RS-06, RS-09, RS-10, RS-11 y RS-12. ga-funcionalidad-botones: RS-02 (tras decisión de Sebas), RS-03, RS-04, RS-05, RS-08 y RS-13. Sebas: subir next a 16.3.8 (RS-07) y decidir RS-02, RS-15 y RS-16. Pruebas locales de RS-06 y RS-14.

## 2026-09-30 · ga-diseno-a-codigo
- Actividades: piezas 3j, 3k, 3l, 3m, 3n (requerimientos de Ricardo) + D-15 y D-16 (sin maqueta)
- Estado: Hecho
- Qué se hizo: Maquetadas y conectadas a la lógica existente: /afiliacion v3 (institución→grado, cuenta de nómina en cascada, dos correos, verificador de foto, selfie con cámara), pestaña «Perfil» de /cuenta (8 pasos, conteo de 36 meses, retiro/renovación con modal, crédito de 3 meses, D-16), /asesor con «Comisiones» y búsqueda por cédula, /admin/asociados, /admin/alertas, interruptor «Atiende asociados», pagos de comisión con corregir/anular/bitácora (D-15) y detalle de convenios (modal/hoja inferior). tsc, lint, vitest (465) y build en verde.
- Bloqueos o trabajo nuevo: D-15 y D-16 siguen sin maqueta oficial (TODO(diseno: D-15/D-16)): invocar a ga-disenador-lienzo. Falta QA e2e/responsive de lo nuevo.

## 2026-09-30 · ga-auditor-supabase (3)
- Actividades: revisión de seguridad de los requerimientos de Ricardo (RS-01, 05, 06, 09, 10, 11, 12, 14), trabajo nuevo sin ID en plan.json
- Estado: Hecho (solo en local; nada se aplicó en remoto)
- Qué se hizo: migración propuesta 20260930100400. Nadie registra, corrige ni anula sus propias comisiones, ni cambia el proceso de sus clientes o el suyo; es_admin() exige activo; cuota_mensual oculta al asociado; un pago nace vigente y tiene tope de 10.000.000; service_role no escribe bitácora ni historiales; resumen_clientes_asesor devuelve la cédula enmascarada. Se ajustó la prueba 07 (3 filtros) y se agregó la pgTAP 17: 396/396 en verde. Prueba de servicios en local: Realtime no manda tasa ni cuota y el admin sigue recibiendo eventos (RS-06 ok); una foto subida no se puede reemplazar con x-upsert (RS-14 ok).
- Bloqueos o trabajo nuevo: ga-funcionalidad-botones: exigirAdmin con activo, mensajes RS-01, tope en zod, no volver a enmascarar la cédula en /asesor, filtro por cédula en resumen.ts y upsert:false explícito en createSignedUploadUrl. ga-verificador-qa: revisar k-roles:197 (cédula enmascarada en /asesor). Sebas aplica en remoto.

## 2026-09-30 · ga-disenador-lienzo
- Actividades: nueva: maquetas D-15 (3o) y D-16 (3p) + revisión de fidelidad 3j–3n
- Estado: Hecho
- Qué se hizo: Maquetadas en el lienzo 3o (corregir/anular pago de comisión con motivo obligatorio y bitácora antes/después, admin 1440 y celular, todos los estados) y 3p (crédito bloqueado hasta «Operando» en /cuenta y /cuenta/solicitar, más los otros 4 motivos); D-15 y D-16 cerrados en pedidos.md y lienzo-indice.md; script y balance sc-* validados. Revisión de 3j–3n contra el código en docs/verificaciones/2026-09-30-revision-diseno-3j-3n.md (aprobada con cambios: 3 altas, 6 medias, 13 bajas).
- Bloqueos o trabajo nuevo: ga-funcionalidad-botones/ga-diseno-a-codigo: ajustes de 3o a PagosComision.tsx (botones 44 px, tachado, Historial por pago, chips por acción) y a AvisoCreditoBloqueado (aviso también con solicitud en curso); decisión de Sebas sobre «Perfil» como pestaña vs sección (A1) y sobre la etiqueta «Correo institucional» (A2).

## 2026-09-30 · ga-funcionalidad-botones (2)
- Actividades: correcciones de código de la revisión de seguridad (RS-01 mensajes, RS-02, RS-03, RS-04, RS-05, RS-07, RS-08, RS-10 zod, RS-12 app, RS-13, RS-14, RS-16), trabajo nuevo sin ID en plan.json
- Estado: Hecho (falta configurar CRON_SECRET en Vercel y confirmar el plan para la frecuencia del cron)
- Qué se hizo: avisos con datos solo al correo personal y aviso genérico sin datos al institucional; tarea programada /api/cron/limpiar-fotos (CRON_SECRET, 401 si falta) que borra prefijos huérfanos de más de 3 h; limpieza de la afiliación duplicada con after(); exigirAdmin exige activo; tasa fuera del JS del navegador (la demo falla con error si la RPC falla); límite de 30 por hora en revelarAcumulado y buscarCliente; el acumulado propio del admin que atiende va oculto y se revela con revelarAcumulado; mensajes de RS-01 y tope de 10.000.000 en los formularios; cédula ya enmascarada desde la base en /asesor; next 16.3.8 (npm audit sin vulnerabilidades en producción). tsc, lint y build limpios; vitest 496/496.
- Bloqueos o trabajo nuevo: Sebas agrega CRON_SECRET en Vercel (y cambia el cron a cada hora si el plan es Pro); ga-verificador-qa revisa e2e (selector de proceso deshabilitado, acumulado propio en /admin/asesores, demo con error) y el pedido de diseño del texto de error/aviso de los estados nuevos.

## 2026-09-30 · ga-diseno-a-codigo
- Actividades: revisión de diseño 3j–3n y piezas 3o/3p (A1–A3, medias y bajas de la sección B/C), trabajo nuevo sin ID en plan.json
- Estado: Hecho (falta actualizar las e2e que buscan «Mis datos» en /cuenta y revisión visual en el navegador)
- Qué se hizo: «Perfil» es ahora pantalla propia en /cuenta/perfil (h1 «Tu perfil», absorbe «Mis datos» con el mismo `section[aria-labelledby="mis-datos-titulo"]`, «Celular» y «Guardar»; sin sorteo repetido; barra inferior de 4 pestañas y nav de escritorio con «Perfil»); placeholder neutro del correo institucional; aviso de crédito bloqueado también con solicitud en curso y mosaico con aria-describedby, texto apagado #7C8B96; PagosComision con botones de 44 px, «Historial» por pago, chips por acción, antes→después con tachado y contador n / 300; áreas táctiles ≥44 px, h1 con el nombre en celular en el detalle de asociado, aviso al limpiar el grado, estado «abriendo cámara» en la selfie y detalles menores. tsc, lint, vitest 496/496 y build limpios.
- Bloqueos o trabajo nuevo: ga-escritor-tests/ga-verificador-qa deben actualizar las e2e que leen «Mis datos», «Nombre/Cédula/Grado» y la barra inferior en /cuenta (ahora viven en /cuenta/perfil; la barra trae «Perfil» en vez de «Mis datos»); backend: el chip «Afiliación: Aprobada» (B2) necesita que buscar_cliente_asesor devuelva el estado de la afiliación.

## 2026-09-30 · ga-revisor-seguridad (2)
- Actividades: 6.2 (segunda pasada de la revisión de seguridad de los requerimientos de Ricardo: RS-01 a RS-16 y pantallas 3j–3n), trabajo nuevo sin ID en plan.json
- Estado: Hecho
- Qué se hizo: RS-01, 02, 04, 05, 07, 08, 09, 10, 11, 12 y 14 corregidos; RS-06 y RS-14 los confirmó en local ga-auditor-supabase. Quedan residuos en RS-03, RS-13 y RS-16. Las pantallas nuevas no mandan al navegador la nómina, los correos, la cédula completa de terceros, la tasa, el acumulado antes del clic ni el contador. npm audit --omit=dev: 0 vulnerabilidades (next 16.3.8). Hallazgos nuevos: 0 críticos, 0 altos, 2 medios (un admin puede cambiar asesor_id y saltarse RS-01; la limpieza del cron deja de revisar prefijos cuando pasan de 500) y 4 bajos.
- Bloqueos o trabajo nuevo: ga-auditor-supabase: RS-17 (bloquear asesor_id propio en proteger_campos_perfil), RS-18 (RPC que liste los huérfanos desde storage.objects) y RS-20 (RLS de pagos propios). ga-funcionalidad-botones: RS-18 (usar esa RPC), RS-21 y RS-22. Sebas: CRON_SECRET en Vercel y frecuencia del cron (RS-19: con Hobby, las fotos duran hasta unas 27 h, no 3 h).

## 2026-09-30 · sesión principal (Sebas)
- Actividades: P-104 (PR develop→main del rediseño C+), asesores nuevos, P-46, P-75 y las tareas de Carlos Pardo (P-69 y las demás asignadas a él)
- Estado: Hecho
- Qué se hizo:
  - Sebas aprobó y fusionó el PR develop→main del rediseño C+.
  - Creó en producción los asesores Miguel Rueda, Rafael González y Nany Barón.
  - Ricardo sigue como admin y atiende asociados.
  - La cooperativa respondió R-01, R-03, R-05, R-06, R-08 y P-46 (nombres de los grados). P-75 se cerró con el certificado de la Cámara de Comercio: NIT 902.103.335-7, Cr 78 No. 16 D 71, Bogotá (ver la spec de Ricardo, §11).
  - Vercel es Pro: el cron de limpieza de fotos corre cada hora.
  - **Carlos Pardo no hace más trabajo**: se le pagan 150.000 COP. Sus tareas pendientes pasan a los agentes o a Sebas.
  - Agentes nuevos: ga-revisor-diseno, ga-correos y ga-enlace-cooperativa.
- Bloqueos o trabajo nuevo:
  - Sebas y Ricardo definen hoy quién registra los pagos de comisión (R-09).
  - Hay que subir pronto la rama requerimientos-ricardo; Sebas ya la revisó y le gusta. Sus migraciones se aplican en remoto en el mismo despliegue.
  - Las fotos reales de la landing están por llegar.

## 2026-09-30 · ga-correos
- Actividades: RS-02 (aviso sin datos al correo institucional como plantilla de Resend), trabajo nuevo sin ID en plan.json
- Estado: Hecho (falta que Sebas publique la plantilla y cree la variable en Vercel)
- Qué se hizo: plantilla `ga-aviso-institucional` preparada (`docs/resend/aviso-institucional.html` y `.txt`, una sola variable `URL_INGRESO`, documentada en `docs/resend-plantillas.md` §5); `lib/correo/institucional.ts` la usa con `RESEND_TEMPLATE_AVISO_INSTITUCIONAL` y, si falta o falla, cae a texto plano con el mismo texto y registra sin datos personales (los correos se quitan de los mensajes de error). Pruebas nuevas en `tests/unit/correo-institucional.test.ts`; tsc, lint y vitest 501/501 limpios. Se arregló además `docs/resend-plantillas.md`, que tenía la sección 3 duplicada por un pegado.
- Bloqueos o trabajo nuevo: Sebas publica la plantilla en Resend y agrega `RESEND_TEMPLATE_AVISO_INSTITUCIONAL` en Vercel; confirma el plan de Resend (con ~500 asociados el plan gratis se queda corto, sobre todo por el tope de 100 al día); ga-funcionalidad-botones: en `aprobarAfiliacion` el aviso institucional solo sale si existe la plantilla de ingreso aceptado (está dentro de ese `if`), conviene sacarlo.

## 2026-09-30 · ga-funcionalidad-botones
- Actividades: P-xx (segunda pasada de seguridad: RS-17, RS-18, RS-21, RS-22 y aviso institucional)
- Estado: Hecho
- Qué se hizo: limpieza de fotos por la RPC `fotos_huerfanas_afiliacion` (lotes de 100, valida ruta), CRON_SECRET de 32+ caracteres, asignarAsesor muestra el error de RS-17 y el selector excluye al admin en sesión, y el aviso institucional de aprobarAfiliacion sale siempre. tsc, lint, vitest (503) y build en verde.
- Bloqueos o trabajo nuevo: depende de que la migración del auditor cree la RPC `fotos_huerfanas_afiliacion(p_limite)` y el trigger RS-17; Sebas debe poner un CRON_SECRET de 32+ caracteres en Vercel.

## 2026-09-30 · ga-auditor-supabase
- Actividades: P-xx (segunda pasada de seguridad: RS-17, RS-18, RS-20, RS-21)
- Estado: Hecho
- Qué se hizo: migración `20260930100500_seguridad_segunda_pasada.sql`: el admin no se asigna ni se quita clientes (RS-17) y los ingresos nuevos se pagan al asesor que tenía el cliente al pasar a operando (nueva columna `historial_proceso_ejecutivo.asesor_id`); RPC `fotos_huerfanas_afiliacion(p_limite)` solo para service_role (RS-18); el admin que atiende no lee por RLS sus pagos ni su bitácora (RS-20); el contador de revelaciones suma como máximo 1 por minuto (RS-21). pgTAP `18_seguridad_segunda_pasada.sql` (20 pruebas) y suite completa en verde (19 archivos, 416 pruebas); la migración es idempotente (probado aplicándola 2 veces).
- Bloqueos o trabajo nuevo: Sebas revisa y aplica la migración en producción (no aplicada) ANTES de desplegar el código que llama a `fotos_huerfanas_afiliacion`; RS-19 y RS-22 no son de base de datos.
