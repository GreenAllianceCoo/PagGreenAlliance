# Requerimientos de la cooperativa (Ricardo Varón) · 29-sep-2026

Fuentes: «REQUERIMIENTO DE PAGINA WEB 2.pdf» (Ricardo) y «presentacion de negocio green alliance 3.pdf». Las decisiones de Sebas van marcadas **[Sebas]**. Las suposiciones que tomó la sesión principal, que Sebas aún debe confirmar, van marcadas **[Supuesto]** y el código las deja con `TODO(confirmar: R-xx)`.

Rama de trabajo: `requerimientos-ricardo`, que sale de `develop`.

Reglas que siguen vigentes:
- el asociado nunca ve la tasa de interés;
- nada de migraciones en la base remota;
- no se toca producción;
- mensajes en español;
- `security definer` con `search_path=''`;
- las pruebas e2e buscan textos y roles.

## 0. Cifras de la presentación (fuente de verdad del negocio)

**Crédito:** plazo de 3 meses. `grados_credito` ya coincide con estas cifras; no se cambian.

| Grupo | Capacidad 50 % | Capacidad 100 % |
|---|---|---|
| PP | 1.000.000 | 2.100.000 |
| PT | 1.300.000 | 2.700.000 |
| SI | 1.500.000 | 3.000.000 |
| IT | 2.000.000 | 4.000.000 |
| OF | 2.150.000 | 4.200.000 |

**Embargo solidario:**
- dura 36 meses ininterrumpidos, contados desde el primer descuento;
- la penalidad por terminación anticipada es de **$10.000.000**;
- la cuota litis es de $2.500.000, que se reparten en $2.000.000 de radicación y $500.000 de comisión del embajador.

**Comisiones de los embajadores (= asesores):**
- **$500.000** por cada ingreso nuevo;
- **$100.000 al mes** por cada embargo operativo;
- bono de $1.000.000 al llegar a 50 embargos (una sola vez);
- viaje a San Andrés al llegar a 100 embargos (una sola vez).
- **[Sebas]** El corte es el **15 de cada mes**.

**Sorteo mensual:** el ganador no paga el descuento del 30 % y solo paga el cheque, de $120.000. Esto ya existe.

Ninguna cifra ni texto que se muestre en la página puede contradecir la presentación.

## 1. Grados e instituciones

Hay 17 grados, con este nombre completo:

| Código | Nombre |
|---|---|
| PP | Patrullero de Policía |
| PT | Patrullero |
| SI | Subintendente |
| IT | Intendente |
| IJ | Intendente Jefe |
| SLP | Soldado Profesional |
| C3 | Cabo Tercero |
| CS | Cabo Segundo |
| CP | Cabo Primero |
| SS | Sargento Segundo |
| SV | Sargento Viceprimero |
| SP | Sargento Primero |
| ST | Subteniente |
| TE | Teniente |
| CT | Capitán |
| MY | Mayor |
| TC | Teniente Coronel |

**Qué grados ve cada institución [Sebas]:**
- Solo Policía Nacional: PP, PT, SI, IT, IJ.
- Solo Ejército Nacional: C3, CS, CP, SS, SV, SP.
- Ambas instituciones: ST, TE, CT, MY, TC.
- SLP queda fuera de los dos rangos que dio Sebas. **[Supuesto R-01]** Lo dejamos solo para el Ejército, porque es «Soldado Profesional».

El selector de grado se filtra según la institución que se elija. Si la persona cambia la institución y el grado ya no es válido, el selector se limpia.

**Cupo de crédito por grado.** Solo hay cifras para PP, PT, SI, IT y OF.
- **[Supuesto R-02]** ST, TE, CT, MY y TC usan las cifras de OF, porque la presentación pone «OF · Subteniente».
- IJ y los grados militares (SLP a SP) todavía no tienen cifras: pueden afiliarse, pero **no pueden pedir crédito**. Verán el aviso «Tu grado todavía no tiene cupo de crédito configurado; tu asesor te contactará».
- Nunca se inventan montos.
- Se recomienda un catálogo `grados` (código, nombre, policía, ejército, `grupo_credito` que puede ser null) en lugar de ampliar el enum `grado_policial`. La decisión es del auditor.

## 2. «Quiero afiliarme» (/afiliacion)

Estos campos ya existen: nombres, apellidos, cédula, institución, Nequi, asesor y las 3 fotos. Cambios:

1. Nombres y apellidos van separados (ya lo están).
2. Cédula (sin cambios).
3. Institución: Policía Nacional o Ejército Nacional.
4. Grado: el filtro de la sección 1.
5. Número de Nequi (sin cambios).
6. **«Cuenta de nómina» [Sebas]**, en lugar de «cuenta de banco». Funciona en cascada:
   1. Un **desplegable «Entidad bancaria»** con todos los bancos de Colombia y las billeteras digitales. Tiene búsqueda y la opción «Otra, ¿cuál?».
      - Bancos: Bancolombia, Banco de Bogotá, Davivienda, BBVA Colombia, Banco de Occidente, Banco Popular, Banco AV Villas, Banco Caja Social, Scotiabank Colpatria, Banco Agrario, Banco GNB Sudameris, Itaú, Banco Falabella, Banco Pichincha, Bancoomeva, Banco Finandina, Banco Serfinanza, Banco W, Bancamía, Banco Mundo Mujer, Banco Coopcentral, Banco Santander, Banco Contactar, Banco Unión, Mibanco, Ban100 y Lulo Bank.
      - Billeteras y neobancos: Nequi, Daviplata, Nu Colombia, RappiPay, Movii, Dale!, Ualá y Powwi.
   2. Después aparece el **tipo de cuenta**: Ahorros o Corriente.
   3. Después aparece el **número de cuenta**: de 6 a 20 dígitos.
   - **[Supuesto R-03]** Si se elige una billetera, no se pregunta el tipo: se guarda como `deposito_electronico` y se pide el número, que es el celular (10 dígitos que empiezan por 3).
7. Celular (sin cambios).
8. **Dos correos obligatorios:**
   - «Correo institucional».
   - «Correo personal».
   - Los dos deben ser distintos y de cualquier dominio; no se revisa el dominio del institucional. **[Supuesto R-04]**
   - **El ingreso con código queda anclado al correo personal**: el correo del usuario en Auth es el personal.
9. **Asesor [Sebas]:** un desplegable con Ricardo Varón, Miguel Rueda, Nany Barón y Rafael González, además de «No tengo asesor».
   - Se arma desde la base con los perfiles que atienden asociados; los nombres no se escriben fijos.
   - **Ricardo sigue siendo admin** y además aparece como asesor. Hace falta una columna tipo `perfiles.atiende_asociados`.
   - El trigger `validar_perfil_asesor_id` debe aceptar un rol asesor, o un admin con `atiende_asociados`.
10. Las tres fotos (cédula frente, cédula reverso y selfie):
    - **Que no se vean borrosas.** Hoy `CampoFoto` comprime a 1600 px y 300 KB, y por eso se ven borrosas. La solución es subirlas directo del navegador al bucket privado con *signed upload URLs* (`createSignedUploadUrl` en el servidor y `uploadToSignedUrl` en el cliente), sin pasar por la Server Action y su límite de 4,5 MB en Vercel. Así se puede apuntar a unos 2400 px, calidad 0,85 y como máximo unos 1,5 MB por foto. La Server Action solo recibe las rutas, y valida que existan y que sean del prefijo de esa solicitud.
    - **Verificador de foto:** revisa en el navegador, sin pagar nada:
      - nitidez, con la varianza del laplaciano en un canvas reducido;
      - luz, con el brillo medio;
      - tamaño mínimo.
      Si la foto está borrosa u oscura, sale el aviso «La foto se ve borrosa u oscura, tómala de nuevo» y se puede repetir. Es un aviso que se puede ignorar, no un bloqueo, para no dejar por fuera a quien tenga un celular malo.
    - **Selfie en el momento:** la cámara se abre dentro de la página con `getUserMedia` (cámara frontal) y un botón «Tomar selfie». No se puede elegir una foto de la galería. Si el navegador no da permiso de cámara, se usa el `input capture="user"` de siempre. Las opciones de pago para detectar que es una persona viva (liveness) quedan para después; ver la sección 7.
11. **«¿Algo que debamos saber?»**: el campo de mensaje, opcional y de hasta 500 caracteres.
12. Al aprobar una afiliación, los datos nuevos que correspondan pasan al perfil: institución, grado, correos, cuenta de nómina y asesor.

## 3. Panel del asociado (/cuenta, «Perfil»)

El perfil muestra:
1. Nombres y apellidos.
2. Asesor.
3. **Conteo regresivo de 36 meses.**
4. Grado.
5. Entidad, es decir, la institución.
6. **Estado del proceso ejecutivo.** Tiene 8 pasos, en este orden:
   1. Reparto
   2. Admitido
   3. Notificación
   4. Sentencia
   5. Liquidación
   6. Entrega de títulos
   7. Operando
   8. Terminado

   Se muestra como una línea de pasos. **Solo el admin lo cambia**, desde el detalle del asociado en /admin. Cada cambio queda en un historial con la fecha y el admin que lo hizo. **El asociado no puede escribirlo**: hay que protegerlo en `proteger_campos_perfil`, o mejor en una tabla aparte.
7. **Cuándo empieza el conteo de 36 meses:** cuando el estado pasa a **«Operando»**.
   - Se guarda `fecha_inicio_embargo`. El admin puede ajustarla, y por defecto es la fecha del cambio.
   - Se muestran los meses y días que faltan.
   - Antes de «Operando» se lee «Tu conteo de 36 meses empieza cuando tu proceso esté operando».
8. **Botón «Retiro anticipado»:**
   - No muestra ninguna suma.
   - Al tocarlo se abre una **ventana encima** (un modal accesible) que explica que la terminación anticipada tiene un **cobro por desconexión del servicio de $10.000.000**, según la cláusula del contrato.
   - La ventana tiene el botón **«Avisar al administrador»**, que crea una alerta para el admin (en la base y con un correo a los admins) y muestra «Listo, el administrador te contactará».
   - No se puede repetir mientras haya una alerta pendiente.
   - **[Supuesto R-05]** El botón se ve desde que el estado es «Operando» y mientras el conteo esté activo.
9. **Botón «Renovar los 36 meses»:**
   - Se ve siempre que exista un conteo, pero **solo se activa cuando pasan 24 meses** desde `fecha_inicio_embargo`.
   - Mientras está desactivado, dice cuánto falta.
   - Al tocarlo: una confirmación y luego una alerta al admin, con el mismo mecanismo del retiro. **[Supuesto R-06]**
10. **Solicitud de crédito:**
    - 50 % o 100 %;
    - el grado;
    - plazo de 3 meses con **conteo regresivo de 3 meses**. **[Supuesto R-07]** El conteo va desde la aprobación del crédito, mientras no exista la fecha de desembolso (P-47).
    - Sigue sin mostrarse la tasa.
11. **Registro al sorteo mensual:** ya existe. Hay que verificar que se vea en el perfil.

## 4. Convenios

Los 5 convenios tienen su descripción, sus servicios en viñetas, el botón de WhatsApp y el NIT (este sale de la presentación).

| Convenio | NIT | WhatsApp | Sedes |
|---|---|---|---|
| AMB Movil S.A.S | 902.038.118-7 | 3214612714 | — |
| Locos por los Viajes S.A.S | 901.865.816-3 | 3103397949 | — |
| Dr. Ribero Dental Group | 1.090.464.475-4 | 3144612829 | Calle 140 # 11-45, Torre HHC, consultorio 313, Bogotá; y Carrera 29 # 45-45, Metropolitan Business Park, consultorio 1609, Bucaramanga |
| Racing Tours Villa de Leyva | 1.054.095.149-3 | 3138008830 | Villa de Leyva, Boyacá |
| Dream & Go Visas | 52.953.735-3 | 3192544799 | — |

Los textos van **literales** de «REQUERIMIENTO DE PAGINA WEB 2.pdf», páginas 3 y 4. Hay que corregir la ortografía de las mayúsculas en los servicios de Racing Tours: «Tour en cuatrimoto», etc.

- **Cómo se ve:** al tocar el nombre de la marca se abre el detalle, en un modal o una hoja inferior en celular, con la descripción, las viñetas, las sedes y el botón «Escribir por WhatsApp» (`wa.me/57…` con un mensaje prellenado).
- **Qué hay que agregar a la tabla `convenios`:**
  - columnas `servicios text[]` y `sedes text[]`;
  - el WhatsApp va en `telefono_contacto`.
- **Los datos:** van en `seed.sql` y en una migración de datos propuesta, que no se aplica.

## 5. Panel del asesor (/asesor) · «embajadores de la marca» = asesores [Sebas]

1. Nombre y apellido.
2. Cuántos afiliados tiene a su nombre.
3. **Simulador de crédito:** igual al de un asociado, para enseñar y capacitar. Ya existe `/asesor/demo`; hay que integrarlo o enlazarlo.
4. **Comisiones, con corte el 15 de cada mes [Sebas].** El periodo va del día 16 de un mes al día 15 del siguiente, en hora de Colombia.
   1. **Ingresos nuevos:** $500.000 cada uno, por los clientes del periodo. **[Supuesto R-08]** Un «ingreso nuevo» es un asociado suyo cuyo proceso llegó a «Operando» dentro del periodo, porque la presentación paga la comisión cuando el embargo ya descuenta.
   2. **Clientes operativos:** $100.000 cada uno, por los clientes en «Operando» al corte.
   3. **«Acumulado ganado a la fecha»:** es un **botón con la cifra oculta**. Muestra «•••••» hasta que se toca, y al tocarlo se revela.
      - La cifra es la suma de los **pagos de comisión que registra el admin**. Hace falta una tabla nueva, por ejemplo `pagos_comision` (asesor, periodo, concepto, monto, quién lo registró y cuándo), y un formulario simple en /admin para registrar pagos. **[Supuesto R-09]**
      - **Contador [Sebas]:** cada vez que el asesor revela la cifra, se suma 1 a un contador por persona. **Solo se ve desde la base de datos**: ni el asesor ni el admin lo ven en la app. Se implementa con una tabla o columna sin políticas de lectura para `authenticated`, más una RPC `security definer` que solo incrementa.
   - Se puede mostrar el avance hacia los bonos de 50 y 100 embargos. Es opcional; el diseñador decide.
5. **Buscar clientes por cédula.** Solo sus propios clientes (se mantiene la regla F2-03). Muestra:
   - la información del cliente, con la cédula enmascarada en las listas;
   - el estado del proceso ejecutivo;
   - la **capacidad de endeudamiento**, es decir, los cupos de 50 % y 100 % de su grado según la sección 0, o «sin cupo configurado».

## 6. Admin

- El detalle del asociado tiene un selector para el estado del proceso ejecutivo, la fecha de inicio del embargo y el historial.
- Una bandeja de **alertas**, de retiro anticipado y de renovación, con la opción de marcar «atendida».
- El registro de **pagos de comisión** por asesor.
- La columna o el interruptor «Atiende asociados» en /admin/asesores, para poder poner a Ricardo.
- **Asesores nuevos:** los crea Sebas en /admin/asesores. Los agentes no crean nada en producción.

| Nombre | Cédula | Correo |
|---|---|---|
| Miguel Rueda | 1015436775 | migue.lucia03@gmail.com |
| Rafael González | 80833176 | rafaelgonzalez1408@icloud.com |
| Nany Barón | 36313345 | yubaron19@gmail.com |

Ricardo Varón (cédula 1124998852) sigue como admin y queda con `atiende_asociados = true`. Eso lo hace la migración propuesta, con un `update` por cédula que Sebas revisa.

## 7. Selfie en vivo: opciones (solo informativo)

| Opción | Costo | Qué da |
|---|---|---|
| A. `getUserMedia` + verificador de nitidez + detección de rostro con MediaPipe Face Detector, en el navegador | Gratis | Foto tomada en el momento, con una cara y nítida. No prueba que la persona esté viva frente a la cámara. |
| B. AWS Rekognition Face Liveness | ≈ USD 0,015 por verificación | Prueba de vida real. Requiere una cuenta de AWS y un backend. |
| C. Truora, MetaMap o Veriff (KYC completo, cédula contra Registraduría y rostro) | ≈ USD 0,5–2 por verificación, según contrato | Validación de identidad completa. |

Plan: implementar ya la opción A. La cara con MediaPipe es opcional, porque suma unos 3 MB de modelo: se puede dejar detrás de una bandera. B o C, más adelante, si hay fraude.

## 8. Respuestas de Sebas (30-sep)

- **Renovación con el proceso en «Terminado»:** no aplica. La renovación solo se permite en «Operando», como está hoy.
- **Pagos de comisión mal registrados:** el admin debe poder corregirlos, editando o anulando el pago, y **todo queda con registro (log) en la base de datos**. Ese registro guarda:
  - quién hizo el cambio;
  - cuándo;
  - los valores de antes y de después;
  - el motivo, que es obligatorio.

  El acumulado del asesor solo suma los pagos vigentes.
- **Tasa de interés:** se corrige. El asociado no puede leer `tasa_interes_mensual` ni por la API. La demo del asesor la obtiene en el servidor o con una función solo para asesores y admins.
- **Crédito para inactivos o antes de «Operando»:** no se permite, ni a un asociado inactivo ni a uno cuyo proceso no esté en «Operando».
  - La validación va en la base (trigger) y en el servidor.
  - La pantalla muestra: «Podrás pedir tu crédito cuando tu proceso esté operando».

## 9. Preguntas abiertas para la cooperativa

- **Q-01:** los bonos de 50 y 100 embargos, ¿se cuentan con los embargos que el asesor tiene operando hoy o con todos los que ha tenido?
- **Q-02:** cupos de crédito para IJ y los grados militares (SLP a SP).
- **Q-03:** confirmar los supuestos R-01 a R-09 de este documento.

## 10. Decisiones de Sebas sobre la revisión de seguridad (30-sep)

- **RS-02:** al correo institucional solo va un aviso **sin datos**: «Tienes una novedad en tu cuenta de Green Alliance; ingresa para verla». La cédula, los montos, el motivo de rechazo y el número del sorteo van **solo al correo personal**.
- **RS-03:** las fotos subidas que no terminen en una solicitud se **borran automáticamente a las 3 horas**, con una tarea programada. Si falta `CRON_SECRET`, la tarea no corre.
- **RS-16:** cuando Ricardo, o cualquier admin que atiende asociados, ve su propio acumulado desde /admin, eso **también suma al contador**. El contador **nadie lo ve desde la app**, tampoco el admin: solo en la base de datos.

## 11. Respuestas de la cooperativa (30-sep, vía Sebas)

- **R-01 confirmado:** SLP es solo del Ejército.
- **P-46 cerrado:** los nombres de los 17 grados de la §1 son correctos.
- **R-03 confirmado:** en una billetera basta el celular, y puede repetir el número del formulario.
- **Opción «Otra entidad»:** siempre pide ahorros o corriente. Es el comportamiento actual.
- **R-05 confirmado:** el retiro anticipado se habilita desde «Operando».
- **R-06 confirmado:** renovar solo avisa al admin por ahora. La cooperativa avisará si cambia.
- **R-08 confirmado:** un ingreso nuevo cuenta solo cuando el asociado llega a «Operando».
- **R-09 pendiente:** los pagos los registra Ricardo o Sebas; lo están definiendo. El admin que los registre no puede ser el mismo que cobra (RS-01).
- **P-16:** las fotos reales llegan pronto.
- **P-75 cerrado (certificado de la Cámara de Comercio, 8-sep-2026):**

| Dato | Valor |
|---|---|
| Razón social | COOPERATIVA GREEN ALLIANCE |
| Sigla | COOP GREEN |
| NIT | 902.103.335-7 |
| Domicilio y notificación judicial | Cr 78 No. 16 D 71, Bogotá D.C. |
| Correo | greenalliancecooperativa@gmail.com |
| Teléfono | 318 389 4034 |
| Representante legal (presidente) | Ricardo Varón Penagos |
| Representante legal suplente | Breinner Prieto Ortiz |
| Vigilancia | Superintendencia de la Economía Solidaria |

- **Siguen abiertas:**
  - Q-01 (bonos);
  - Q-02 (cupos de IJ y militares);
  - R-02 (ST–TC con las cifras de OF);
  - R-04 (dominio del correo institucional);
  - R-07 (conteo del crédito);
  - P-47, P-63, P-76, P-77, P-78, P-79, P-80, P-90, P-91, P-92, P-93 y P-97.
