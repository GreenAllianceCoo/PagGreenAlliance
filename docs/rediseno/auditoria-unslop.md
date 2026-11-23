# Auditoría de diseño (fase 2 · unslop) — 2026-11-22

Capturas de la versión en producción (www.greenallianceco.com) a 1440 y 390 px,
más revisión del código. Las pantallas con sesión se auditaron solo por código:
las cuentas de prueba de los e2e viven en el Supabase local y Docker no arranca
en este equipo.

## Veredicto

**Diseño leve con restos de plantilla.** Ya hay una dirección propia (la «C+»: verde
institucional, navy, comprobante vivo, Manrope + Bricolage) y no aparece lo peor:
no hay degradados de color, brillos, emojis en la navegación, `transition-all`,
`hover:scale` ni animaciones en bucle. Por eso se propone **modo pulido**: se
conservan la paleta, las tipografías, el orden de las secciones y el comprobante.
Solo se corrige lo que sale abajo.

## Dirección

- **Producto:** cooperativa de crédito y apoyo para la familia policial y militar.
  Pides el crédito en línea, conoces tu tope desde el inicio y sigues cada paso.
- **Carácter:** firme, cercana, ordenada.
- **Mundo:** los papeles de la institución: el comprobante sellado, el carné y el
  sello redondo de la cooperativa. El verde institucional y el navy del uniforme.
- **Momentos:** en la landing, el comprobante vivo de la solicitud: es lo único
  con color fuerte y todo lo demás se calma. En la cuenta, el carné virtual y el
  seguimiento de la solicitud.
- **Firma:** los 4 pasos con sello (Enviada → En revisión → Aprobada →
  Desembolso). Se usan solo donde se sigue un trámite.

## Landing (`components/pantallas/Landing.tsx`)

**Tipografía**
1. Todos los títulos, cifras y botones están en `font-extrabold` (800); hay unas
   21 apariciones en la landing. Propuesta: títulos en 600 y texto de botones en
   600. La jerarquía la dan el tamaño y el color.
2. Etiquetas en mayúsculas con espaciado ancho: «NUESTRA MISIÓN», «NUESTRA VISIÓN»,
   «HORARIO DE ATENCIÓN» y las categorías de cada convenio («TECNOLOGÍA»,
   `ListaConvenios.tsx:93,226`). Pasan a minúscula normal.
3. Títulos que terminan en punto: «…reglas claras.», «…Ejército Nacional.»,
   «…arraigo institucional.» y «…empezamos de nuevo.». Se quita el punto.

**Copy**
4. Cifra del hero «Aprobados / en poco tiempo»: es una palabra puesta en el lugar
   de una cifra. Quedó así cuando se quitó «+200 asociados» (§12.8) y suena a
   relleno. Propuesta: quitarla, o poner un dato real que ya está en la página,
   por ejemplo «5 sedes».
5. La píldora sobre el titular («Policía Nacional · Ejército Nacional») es un dato
   real del público. Se queda, pero como texto discreto y no como píldora.
6. El botón del encabezado dice «Ingresar» en celular y «Mi cuenta» en
   escritorio. Propuesta: unificarlo en «Ingresar».

**Color y componentes**
7. El botón «Escríbenos por WhatsApp» del bloque de horario es verde relleno. La
   regla de la casa es fondo blanco con borde navy y el verde solo en el ícono.
8. «Lo que encuentras»: 3 tarjetas iguales, cada una con un punto de color, un
   fondo de otro tono y una mancha. Es el patrón de tarjeta de plantilla.
   Propuesta: un solo fondo, sin el punto de color (o con un ícono de línea del
   set de la casa) y sin manchas.
9. Hay manchas orgánicas decorativas en misión, visión, servicios, sedes y
   horario: es un visual en cada sección. Propuesta: dejarlas solo en el hero,
   detrás del comprobante.
10. Hero: la matriz de 9 círculos de colores compite con el comprobante, que es
    el elemento que de verdad cuenta algo. Propuesta: la matriz baja de tamaño y
    contraste, o se quita, y el comprobante queda como el elemento protagonista.
11. Convenios sin logo: se muestra un emoji grande como imagen
    (`ListaConvenios.tsx:35,65`). Propuesta: las iniciales de la empresa en un
    cuadro neutro.

**Espaciado**
12. Valores fuera de la cuadrícula de 4 px: `p-4.5` y `gap-5.5` (18 y 22 px),
    `rounded-22`, `lg:h-[58px]`, `lg:pb-[72px]` y `text-[104px]`. Pasan al paso
    de 4 más cercano.
13. Los botones del hero miden 56–58 px y los del resto del sitio 54 px.
    Propuesta: un solo alto.

**Movimiento**
14. La entrada usa una curva con rebote (`cubic-bezier(.34,1.3,.64,1)`, en
    `tailwind.config.ts:181,290`, usada en 7 sitios). Propuesta: la misma curva sin
    rebote, `cubic-bezier(.2,.7,.2,1)`. La duración se queda igual.

**Por verificar**
15. En la captura de página completa, los logos de los convenios salen como
    cuadros grises vacíos. Lo más probable es que sea `loading="lazy"` sin hacer
    scroll; lo reviso en pantalla al pulir.

## Ingreso (`IngresoCedula`, `IngresoCodigo`, `IngresoNit`, `components/ingreso/PanelIngreso.tsx`)

Está bastante limpio: un solo botón principal, campos claros y textos de ayuda
concretos.
1. El título «Hola de nuevo» es un saludo. Propuesta: «Tu cuenta en Green
   Alliance» o «Entra a tu cuenta».
2. Los pesos son 800, igual que en la landing.
3. La mancha decorativa de abajo del panel verde: se puede dejar (es pequeña) o
   quitar.

## Panel del asociado (`app/cuenta`, `components/pantallas/Cuenta.tsx`), solo por código

1. El título es el saludo «Hola, {nombre}» (`Cuenta.tsx:279`). Propuesta: el
   nombre solo como título, sin «Hola».
2. Hay etiquetas en mayúsculas: «AVISO DE LA COOPERATIVA»
   (`AvisosAlEntrar.tsx:31`) y la categoría en el detalle de Beneficios.
3. Los convenios sin logo usan el emoji (punto 11 de la landing).
4. Los pesos son 800.

Hay que verlo en pantalla antes de cerrarlo. Lo hago con la cuenta de demostración
(`/admin/demo`) si me das una sesión de admin, o con capturas tuyas.

## Admin (solo pulido)

1. Unas 28 etiquetas en mayúsculas con espaciado ancho (`CLASE_ETIQUETA` en
   historial, cambios y publicaciones, `CamposAdmin.tsx:31` y los encabezados de
   las tablas). Pasan a minúscula normal.
2. El borde `--ga-admin-borde` está al 14 % de opacidad. Propuesta: 10 %, para que
   se lea como una línea fina y no como un marco.
3. Los pesos son 800 en los títulos.

## No se toca

La paleta y los tokens `--ga-*`, el logo, Manrope + Bricolage, el orden de las
secciones, el comprobante vivo, el carné, el modo oscuro del admin y los textos
legales.

---
Proceso: skill unslop de Damir Sokolovsky (@heydamir), CC BY 4.0.
