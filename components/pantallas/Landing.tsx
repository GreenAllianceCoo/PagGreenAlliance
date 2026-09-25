import Link from "next/link";
import { ComprobanteSolicitud } from "@/components/pantallas/landing/ComprobanteSolicitud";
import { MatrizCirculos } from "@/components/pantallas/landing/MatrizCirculos";
import { Logo } from "@/components/ui/Logo";
import type { Convenio, Testimonio } from "@/lib/mock";

/**
 * Landing (rediseño C+, pieza 2a de docs/Green Alliance C+.dc.html: hero con
 * comprobante vivo, 1280 y 390). Reemplaza la maqueta anterior
 * (design/Main.dc.html + Landing-Movil.dc.html): esta pantalla ya sigue la
 * dirección «C+» (formas orgánicas + sello/comprobante + cifras grandes).
 *
 * Mobile-first: la base es la versión de 390 px; `lg:` (1024 px) aplica la
 * de 1280. Entre esos dos anchos, el mismo marcado se acomoda solo.
 */

export type LandingProps = {
  estadisticas: {
    asociados: string;
    creditosAprobados: string;
    tiempoRespuesta: string;
    tiempoRespuestaCorto?: string;
  };
  testimonios: Testimonio[];
  convenios: Convenio[];
  whatsapp: string;
  correo: string;
  textoVigilancia: string;
};

// Clases de los botones «píldora» del hero, propias de esta pantalla (altura
// 56/58 px, no las 54 px de components/ui/Button). Desde la tanda 2 del
// rediseño C+, components/ui/Button también usa radio 100% (pieza 3a); estos
// botones locales se quedan porque su altura y su tamaño de letra son
// distintos a los del resto del sitio.
const PILDORA_BASE =
  "inline-flex h-14 items-center justify-center whitespace-nowrap rounded-full px-7 text-17 font-extrabold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde lg:h-[58px] lg:px-8";
const PILDORA_PRIMARIA = `${PILDORA_BASE} bg-ga-verde text-white hover:bg-ga-verde-oscuro`;
const PILDORA_SECUNDARIA = `${PILDORA_BASE} bg-white text-ga-navy shadow-[inset_0_0_0_1.5px_var(--ga-navy)] hover:bg-ga-fondo-suave`;

const ENLACE_NAV_DESKTOP =
  "hidden text-16 font-bold text-ga-navy no-underline hover:text-ga-verde lg:inline";

// Apoyos de «Lo que encuentras en Green Alliance» (pieza 2a). Los textos son
// los del lienzo; los colores ya están tokenizados arriba.
const SERVICIOS: Array<{ titulo: string; texto: string; puntoBg: string; fondo: string; oscuro?: boolean }> = [
  {
    titulo: "Microcréditos",
    texto: "Pídelo en línea desde la plataforma, con modalidad del 50 % o 100 % y un tope claro según tu grado.",
    puntoBg: "bg-ga-verde",
    fondo: "bg-ga-verde-claro",
  },
  {
    titulo: "Orientación financiera",
    texto: "Una conversación estratégica para ordenar tus cuentas y decidir mejor antes de endeudarte.",
    puntoBg: "bg-ga-navy",
    fondo: "bg-ga-gris-azulado",
  },
  {
    titulo: "Apoyo legal",
    texto: "Acompañamiento jurídico integral en trámites para ti y tu familia.",
    puntoBg: "bg-ga-ambar",
    fondo: "bg-ga-ambar-fondo",
  },
  {
    titulo: "Embargo solidario a 36 meses",
    texto: "Un alivio financiero pensado para que, con el tiempo, recuperes tu vida comercial ante los bancos.",
    puntoBg: "bg-ga-menta",
    fondo: "bg-ga-navy",
    oscuro: true,
  },
];

// «Si hoy el banco te dice que no…» (pieza 2a): los 3 pasos del alivio de 3 años.
const PASOS_ALIVIO: Array<{ numero: string; fondo: string; numeroFg: string; titulo: string; texto: string }> = [
  {
    numero: "01",
    fondo: "bg-ga-fondo-suave",
    numeroFg: "text-ga-navy",
    titulo: "Te afilias",
    texto: "Revisamos tu caso y te explicamos cada paso con claridad.",
  },
  {
    numero: "02",
    fondo: "bg-ga-verde-claro",
    numeroFg: "text-ga-verde",
    titulo: "Recibes alivio",
    texto: "Embargo solidario, microcréditos y orientación mientras ordenas tus cuentas.",
  },
  {
    numero: "03",
    fondo: "bg-ga-ambar-fondo",
    numeroFg: "text-ga-ambar-texto",
    titulo: "Vuelves a empezar",
    texto: "Con tu vida crediticia en orden, de vuelta a los bancos tradicionales.",
  },
];

// Sedes (pieza 2a): Bogotá + 4 sucursales.
const SEDES = ["Bogotá · sede principal", "Valledupar, Cesar", "Bosconia, Cesar", "La Jagua de Ibirico, Cesar", "Hatonuevo, La Guajira"];

export function Landing({ estadisticas, testimonios, convenios, whatsapp, correo, textoVigilancia }: LandingProps) {
  const cifraRespuesta = estadisticas.tiempoRespuestaCorto ?? estadisticas.tiempoRespuesta;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-ga-fondo-suave">
      {/* Encabezado: píldora blanca flotante (pieza 2a). */}
      <header className="px-4 pb-0 pt-4 lg:px-10 lg:pt-4">
        <div className="mx-auto flex h-15 max-w-[1280px] items-center justify-between gap-3 rounded-full bg-white pl-3.5 pr-2 lg:h-[68px] lg:pl-5 lg:pr-3 lg:shadow-pildora">
          <Link href="/" aria-label="Cooperativa Green Alliance, inicio" className="block h-11 w-logo min-w-0 shrink">
            <Logo tone="dark" />
          </Link>
          <nav aria-label="Principal" className="flex shrink-0 items-center gap-7">
            <a href="#c-apoyos" className={ENLACE_NAV_DESKTOP}>
              Apoyos
            </a>
            <a href="#c-como-funciona" className={ENLACE_NAV_DESKTOP}>
              Cómo funciona
            </a>
            <a href="#c-convenios" className={ENLACE_NAV_DESKTOP}>
              Convenios
            </a>
            <Link href="/afiliacion" className={ENLACE_NAV_DESKTOP}>
              Afíliate
            </Link>
            {/* Con sesión activa, proxy.ts redirige /ingresar → /cuenta. */}
            <Link
              href="/ingresar"
              className="inline-flex h-11 items-center rounded-full bg-ga-verde px-5 text-15 font-extrabold text-white no-underline hover:bg-ga-verde-oscuro lg:h-12 lg:px-6 lg:text-16"
            >
              <span className="lg:hidden">Ingresar</span>
              <span className="hidden lg:inline">Mi cuenta</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex grow flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 pb-10 pt-8 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-16 lg:pb-[72px] lg:pt-14">
          <div className="flex flex-col gap-5 lg:gap-5.5">
            <span
              className="motion-safe:animate-ga-entrada self-start inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-13 font-bold text-ga-navy lg:text-14"
            >
              <span className="h-2 w-2 rounded-full bg-ga-verde" />
              <span className="lg:hidden">Policía · Ejército</span>
              <span className="hidden lg:inline">Policía Nacional · Ejército Nacional</span>
            </span>
            <h1 className="motion-safe:animate-ga-entrada m-0 [text-wrap:balance] font-display text-44 font-extrabold leading-102 tracking-hero text-ga-navy [animation-delay:70ms] lg:text-76 lg:leading-none">
              Crédito entre compañeros, con{" "}
              <span className="rounded-12 bg-ga-ambar-fondo-fuerte px-1.5 lg:rounded-20 lg:px-3">reglas claras.</span>
            </h1>
            <p className="motion-safe:animate-ga-entrada m-0 max-w-[520px] text-17 leading-155 text-ga-texto-2 [animation-delay:140ms] lg:text-20">
              Somos una cooperativa hecha por y para la familia policial y militar. Pides en línea, sabes tu tope
              desde el inicio y ves cada paso de tu solicitud.
            </p>
            <div className="motion-safe:animate-ga-entrada flex flex-col gap-3 [animation-delay:210ms] lg:flex-row">
              {/* Con sesión activa, proxy.ts redirige /ingresar → /cuenta. */}
              <Link href="/ingresar" className={PILDORA_PRIMARIA}>
                Solicitar crédito
              </Link>
              <Link href="/afiliacion" className={`${PILDORA_SECUNDARIA} lg:hidden`}>
                Quiero afiliarme
              </Link>
              <a href="#c-apoyos" className={`${PILDORA_SECUNDARIA} hidden lg:inline-flex`}>
                Conocer la cooperativa
              </a>
            </div>
            <div className="motion-safe:animate-ga-entrada mt-1 flex gap-8 [animation-delay:280ms] lg:gap-10">
              <div className="flex flex-col gap-1">
                <span className="font-display text-44 font-extrabold leading-none tracking-cifra text-ga-verde lg:text-64">
                  {estadisticas.asociados}
                </span>
                <span className="text-14 text-ga-texto-2 lg:text-15">asociados activos</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-display text-44 font-extrabold leading-none tracking-cifra text-ga-navy lg:text-64">
                  {cifraRespuesta}
                </span>
                <span className="text-14 text-ga-texto-2 lg:text-15">o menos de respuesta promedio</span>
              </div>
            </div>
          </div>

          {/* Ilustración: manchas orgánicas + matriz de círculos + comprobante vivo. Sin fotos de personas. */}
          <div className="relative flex flex-col gap-4 lg:block lg:h-[560px]">
            <div className="relative flex h-[210px] items-center justify-center overflow-hidden rounded-20 bg-transparent lg:absolute lg:inset-x-6 lg:top-0 lg:h-[380px] lg:overflow-visible">
              {/* Mancha navy: rectángulo redondeado en celular; forma orgánica en escritorio. */}
              <div className="absolute inset-0 rounded-20 bg-ga-navy lg:hidden" aria-hidden />
              <div
                className="absolute hidden lg:right-[4%] lg:top-0 lg:block lg:h-[380px] lg:w-[420px] lg:bg-ga-navy"
                style={{ borderRadius: "44% 56% 62% 38% / 52% 40% 60% 48%" }}
                aria-hidden
              />
              {/* Mancha verde claro, orgánica en las dos versiones. */}
              <div
                className="absolute inset-4 bg-ga-verde-claro lg:inset-auto lg:right-[-6%] lg:top-0 lg:h-[300px] lg:w-[380px]"
                style={{ borderRadius: "52% 48% 44% 56% / 55% 45% 55% 45%" }}
                aria-hidden
              />
              <div className="absolute left-4 top-4 h-6 w-6 rounded-full bg-ga-ambar-fondo-fuerte lg:left-[8%] lg:top-[6%] lg:h-16 lg:w-16" aria-hidden />
              <MatrizCirculos celda={44} espacio={7} className="relative z-10 lg:hidden" />
              <MatrizCirculos celda={72} espacio={10} className="relative z-10 hidden lg:block" />
            </div>
            <ComprobanteSolicitud variante="movil" className="lg:hidden" />
            <ComprobanteSolicitud
              variante="desktop"
              className="hidden lg:absolute lg:bottom-0 lg:right-0 lg:block lg:w-[400px]"
            />
          </div>
        </section>

        {/* Misión / visión */}
        <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 pb-8 lg:flex-row lg:gap-5 lg:px-16 lg:pb-0">
          <article className="relative flex flex-col gap-3 overflow-hidden rounded-24 bg-white p-6 lg:gap-3.5 lg:rounded-32 lg:p-9">
            <span
              aria-hidden
              className="absolute -right-8 -top-9 h-[130px] w-[150px] bg-ga-verde-claro lg:h-[180px] lg:w-[200px]"
              style={{ borderRadius: "58% 42% 55% 45% / 48% 58% 42% 52%" }}
            />
            <span className="relative text-13 font-extrabold uppercase tracking-etiqueta text-ga-verde">
              Nuestra misión
            </span>
            <p className="relative m-0 max-w-[500px] font-display text-26 font-extrabold leading-110 tracking-titular text-ga-navy lg:text-34">
              Ser escudo y lazo solidario para la familia policial.
            </p>
            <p className="relative m-0 text-16 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
              <span className="lg:hidden">
                Microcréditos de fácil acceso, orientación financiera y acompañamiento jurídico integral.
              </span>
              <span className="hidden lg:inline">
                Lo hacemos con microcréditos de fácil acceso, orientación financiera estratégica y acompañamiento
                jurídico integral, para que tu vocación de servicio también se traduzca en crecimiento económico.
              </span>
            </p>
          </article>
          <article className="relative flex flex-col gap-3 overflow-hidden rounded-24 bg-ga-navy p-6 text-white lg:gap-3.5 lg:rounded-32 lg:p-9">
            <span
              aria-hidden
              className="absolute -bottom-10 -right-6 h-[130px] w-[150px] bg-ga-navy-claro lg:h-[200px] lg:w-[220px]"
              style={{ borderRadius: "44% 56% 62% 38% / 52% 40% 60% 48%" }}
            />
            <span className="relative text-13 font-extrabold uppercase tracking-etiqueta text-ga-menta">
              Nuestra visión
            </span>
            <p className="relative m-0 font-display text-24 font-extrabold leading-110 lg:text-34">
              Liderar el cooperativismo colombiano por identidad y arraigo institucional.
            </p>
            <p className="relative m-0 hidden max-w-[500px] text-16 leading-150 text-ga-navy-texto-suave lg:block lg:text-17 lg:leading-155">
              Con una organización moderna y de proyección internacional, capaz de asegurar el bienestar financiero
              de nuestros hombres y mujeres.
            </p>
          </article>
        </section>

        {/* «Si hoy el banco te dice que no…» */}
        <section
          id="c-como-funciona"
          className="mx-4 mt-8 scroll-mt-4 rounded-28 bg-white p-6 lg:mx-16 lg:mt-12 lg:grid lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-12 lg:rounded-36 lg:p-12"
        >
          <div className="flex flex-col gap-3 lg:gap-4">
            <h2 className="m-0 font-display text-28 font-extrabold leading-110 tracking-titular text-ga-navy lg:text-44">
              Si hoy el banco te dice que no, aquí empezamos de nuevo.
            </h2>
            <p className="m-0 text-16 leading-150 text-ga-texto-2 lg:text-18 lg:leading-155">
              Muchos compañeros quedan atrapados en deudas que terminan afectando su tranquilidad y su familia. Te
              proponemos una alternativa pensada para tu caso y te acompañamos de principio a fin.
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-3.5 lg:mt-0">
            <div className="flex items-baseline gap-3">
              <span className="whitespace-nowrap font-display text-56 font-extrabold leading-90 tracking-cifra-grande text-ga-verde lg:text-88">
                3 años
              </span>
              <span className="text-15 font-bold text-ga-texto-2 lg:text-17">
                para volver al sistema financiero tradicional, sin rechazos
              </span>
            </div>
            <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
              {PASOS_ALIVIO.map((paso) => (
                <li key={paso.numero} className={`flex flex-col gap-1.5 rounded-22 p-4.5 ${paso.fondo}`}>
                  <span className={`font-display text-30 font-extrabold ${paso.numeroFg}`}>{paso.numero}</span>
                  <strong className="text-17">{paso.titulo}</strong>
                  <span className="text-15 leading-145 text-ga-texto-2">{paso.texto}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Lo que encuentras en Green Alliance (antes «Tres apoyos, una cooperativa») */}
        <section id="c-apoyos" className="mx-auto flex w-full scroll-mt-4 max-w-[1280px] flex-col gap-5 px-4 pb-10 pt-14 lg:gap-6 lg:px-16 lg:pb-16 lg:pt-22">
          <h2 className="m-0 font-display text-28 font-extrabold tracking-titular text-ga-navy lg:text-44">
            Lo que encuentras en Green Alliance
          </h2>
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-4 lg:gap-4">
            {SERVICIOS.map((s) => (
              <article
                key={s.titulo}
                className={`relative flex min-h-[180px] flex-col gap-2.5 overflow-hidden rounded-24 p-5 lg:min-h-[220px] lg:gap-2.5 lg:rounded-28 lg:p-6 ${s.fondo} ${s.oscuro ? "text-white" : ""}`}
              >
                <span
                  aria-hidden
                  className={`absolute -bottom-10 -right-8 h-[120px] w-[130px] ${s.oscuro ? "bg-blob-claro" : "bg-blob-oscuro"}`}
                  style={{ borderRadius: "58% 42% 55% 45% / 48% 58% 42% 52%" }}
                />
                <span className={`relative h-11 w-11 rounded-full ${s.puntoBg}`} />
                <strong className={`relative font-display text-22 font-extrabold leading-115 ${s.oscuro ? "text-white" : "text-ga-navy"}`}>
                  {s.titulo}
                </strong>
                <p className={`relative m-0 text-16 leading-150 ${s.oscuro ? "text-ga-navy-texto-suave" : "text-ga-texto-2"}`}>
                  {s.texto}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Historias: no está en la pieza 2a del lienzo C+, se conserva con el estilo nuevo
            (docs/diseno/pedidos.md no tiene pedido abierto para esto: es contenido que ya
            existía en la landing anterior y la regla del encargo pide conservarlo). */}
        <section
          id="c-historias"
          className="flex scroll-mt-4 flex-col gap-5 bg-ga-navy px-4 py-12 text-white lg:gap-8 lg:px-16 lg:py-16"
        >
          <h2 className="m-0 font-display text-28 font-extrabold tracking-titular lg:text-44">
            Lo que hicieron con su crédito
          </h2>
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
            {testimonios.map((testimonio, i) => (
              <figure key={i} className="m-0 flex flex-col gap-3 rounded-24 bg-ga-navy-claro p-5 lg:gap-4 lg:rounded-28 lg:p-7">
                <blockquote className="m-0 text-18 leading-150 lg:text-21">{testimonio.texto}</blockquote>
                <figcaption className="text-14 text-ga-navy-texto-suave lg:text-16">{testimonio.autor}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Empresas en convenio */}
        <section id="c-convenios" className="mx-auto flex w-full scroll-mt-4 max-w-[1280px] flex-col gap-5 px-4 py-11 lg:gap-6 lg:px-16 lg:py-20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div className="flex max-w-texto-convenios flex-col gap-2 lg:gap-2.5">
              <h2 className="m-0 font-display text-28 font-extrabold tracking-titular text-ga-navy lg:text-44">
                Empresas en convenio
              </h2>
              <p className="m-0 text-16 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
                Condiciones preferenciales y el respaldo de la cooperativa en cada compra o servicio.
              </p>
            </div>
            {/* Con sesión activa, proxy.ts redirige /ingresar → /cuenta. */}
            <Link
              href="/ingresar"
              className="hidden h-12 flex-none items-center whitespace-nowrap rounded-full bg-white px-5 text-16 font-extrabold text-ga-verde no-underline shadow-[inset_0_0_0_1.5px_var(--ga-verde)] hover:bg-ga-verde-tint lg:inline-flex"
            >
              Ver beneficios en mi cuenta
            </Link>
          </div>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-3.5">
            {convenios.map((convenio) => (
              <article key={convenio.nombre} className="flex flex-col gap-2.5 rounded-24 bg-white p-5">
                <span className="text-13 font-bold uppercase tracking-[0.04em] text-ga-verde">
                  {convenio.especialidad}
                </span>
                <strong className="font-display text-20 font-extrabold leading-115 text-ga-navy">
                  {convenio.nombre}
                </strong>
                <span className="flex items-center gap-2 text-15 text-ga-texto-2">
                  <span aria-hidden className="text-22">
                    {convenio.emoji}
                  </span>
                  {convenio.nombreCorto}
                </span>
              </article>
            ))}
          </div>
        </section>

        {/* Sedes */}
        <section className="mx-4 mb-8 lg:mx-16 lg:mb-16">
          <article className="relative flex flex-col gap-3.5 overflow-hidden rounded-28 bg-ga-navy p-6 text-white lg:gap-4 lg:rounded-36 lg:p-9">
            <span
              aria-hidden
              className="absolute -right-12 -top-14 h-[220px] w-[250px] bg-ga-navy-claro"
              style={{ borderRadius: "52% 48% 44% 56% / 55% 45% 55% 45%" }}
            />
            <div className="relative flex items-baseline gap-2.5">
              <span className="font-display text-56 font-extrabold leading-90 tracking-cifra-grande text-ga-menta lg:text-80">
                5
              </span>
              <span className="font-display text-22 font-extrabold lg:text-30">sedes para atenderte</span>
            </div>
            <p className="relative m-0 max-w-[560px] text-16 leading-150 text-ga-navy-texto-suave lg:text-17 lg:leading-155">
              Sede principal en Bogotá y cuatro sucursales en la región.
            </p>
            <div className="relative flex flex-wrap gap-2">
              {SEDES.map((sede, i) => (
                <span
                  key={sede}
                  className={
                    i === 0
                      ? "rounded-full bg-ga-menta px-3 py-1.5 text-14 font-bold text-ga-navy-chip-oscuro"
                      : "rounded-full bg-ga-blanco-chip px-3 py-1.5 text-14 font-bold text-white"
                  }
                >
                  {sede}
                </span>
              ))}
            </div>
          </article>
        </section>
      </main>

      {/* Pie de página: píldora blanca (pieza 2a). */}
      <footer className="px-4 pb-6 pt-2 lg:px-10 lg:pb-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-3 rounded-24 bg-white px-5 py-6 text-center text-14 leading-150 text-ga-texto-2 lg:flex-row lg:justify-between lg:rounded-full lg:px-8 lg:py-4.5 lg:text-left lg:text-15 lg:leading-normal">
          <Logo variant="apilado" className="w-[150px] lg:w-[130px]" />
          <span className="flex flex-col gap-2.5 lg:block">
            {/* TODO(pendiente-spec): número de WhatsApp y correo confirmados en lib/config.ts. */}
            <span>
              WhatsApp {whatsapp} · {correo}
            </span>
            <span className="hidden lg:inline"> · </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-ga-verde" aria-hidden />
              {textoVigilancia}
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
