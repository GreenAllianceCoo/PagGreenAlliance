import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ConvenioCard } from "@/components/ui/ConvenioCard";
import { EspacioFoto, type FotoReal, type IlustracionFoto } from "@/components/ui/EspacioFoto";
import { Logo } from "@/components/ui/Logo";
import { PasosSolicitud } from "@/components/ui/PasosSolicitud";
import type { Convenio, Testimonio } from "@/lib/mock";

export type LandingProps = {
  estadisticas: {
    asociados: string;
    creditosAprobados: string;
    tiempoRespuesta: string;
    /** Versión corta para celular (opcional; si falta se usa `tiempoRespuesta`). */
    tiempoRespuestaCorto?: string;
  };
  testimonios: Testimonio[];
  convenios: Convenio[];
  whatsapp: string;
  correo: string;
  textoVigilancia: string;
};

// Pasos de muestra de la tarjeta del hero (ilustración, no son datos del usuario).
const PASOS_MUESTRA = [
  { etiqueta: "Enviada", estado: "hecho" as const },
  { etiqueta: "En revisión", estado: "actual" as const },
  { etiqueta: "Aprobada", estado: "pendiente" as const },
  { etiqueta: "Desembolso", estado: "pendiente" as const },
];

// TODO(pendiente-spec): foto real de asociados (con autorización de uso).
// Para ponerla: copiar el archivo a /public/fotos/ y cambiar `null` por
// { src: "/fotos/asociados.jpg", alt: "Descripción de la foto" }.
const FOTO_HERO: FotoReal | null = null;

// TODO(pendiente-spec): foto de cada apoyo. Igual que FOTO_HERO: reemplazar `foto: null`.
const APOYOS: Array<{
  titulo: string;
  texto: string;
  foto: FotoReal | null;
  ilustracion: IlustracionFoto;
  tono: "verde" | "navy" | "oscuro";
}> = [
  {
    titulo: "Microcréditos",
    texto: "Montos según tu grado, modalidad 50% o 100%, todo en línea.",
    foto: null,
    ilustracion: "credito",
    tono: "oscuro",
  },
  {
    titulo: "Orientación financiera",
    texto: "Una conversación para ordenar tus cuentas antes de endeudarte.",
    foto: null,
    ilustracion: "orientacion",
    tono: "verde",
  },
  {
    titulo: "Apoyo legal",
    texto: "Acompañamiento en trámites para ti y tu familia.",
    foto: null,
    ilustracion: "legal",
    tono: "navy",
  },
];

const ENLACE_NAV = "text-white no-underline hover:text-ga-verde-claro";

/** Landing (design/Main.dc.html + Landing-Movil.dc.html). */
export function Landing({
  estadisticas,
  testimonios,
  convenios,
  whatsapp,
  correo,
  textoVigilancia,
}: LandingProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Encabezado. Celular: la maqueta deja 48 px arriba para simular la barra de estado
          del teléfono; en el navegador se usa 24 px, como en las demás pantallas. */}
      <header className="flex items-center justify-between gap-3 bg-ga-verde px-5 pb-4 pt-6 text-white lg:h-19 lg:px-16 lg:py-0">
        <Link href="/" aria-label="Cooperativa Green Alliance, inicio" className="block h-11 w-logo min-w-0 shrink">
          <Logo tone="light" />
        </Link>
        <nav aria-label="Principal" className="flex shrink-0 items-center gap-7 text-16 font-semibold">
          <a href="#c-apoyos" className={`hidden lg:inline ${ENLACE_NAV}`}>
            Apoyos
          </a>
          <a href="#c-historias" className={`hidden lg:inline ${ENLACE_NAV}`}>
            Historias
          </a>
          <a href="#c-convenios" className={`hidden lg:inline ${ENLACE_NAV}`}>
            Convenios
          </a>
          <Link href="/afiliacion" className={`hidden lg:inline ${ENLACE_NAV}`}>
            Afíliate
          </Link>
          {/* Con sesión activa, proxy.ts redirige /ingresar → /cuenta. */}
          <Link
            href="/ingresar"
            className="inline-flex h-11 items-center rounded-10 bg-white px-4 text-15 font-extrabold text-ga-verde no-underline hover:bg-ga-verde-claro lg:px-5.5 lg:text-16"
          >
            <span className="lg:hidden">Ingresar</span>
            <span className="hidden lg:inline">Mi cuenta</span>
          </Link>
        </nav>
      </header>

      <main className="flex grow flex-col">
        {/* Hero */}
        <section className="flex flex-col lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:p-16">
          <div className="flex flex-col gap-4.5 px-5 pb-7 pt-8 lg:gap-5.5 lg:p-0">
            <h1 className="m-0 text-36 font-extrabold leading-108 tracking-titulo text-ga-navy lg:text-58 lg:leading-105">
              Crédito entre compañeros, con reglas claras.
            </h1>
            <p className="m-0 text-17 leading-155 text-ga-texto-2 lg:text-20">
              Somos una cooperativa hecha por y para la familia policial. Pides en línea, sabes tu
              tope desde el inicio y ves cada paso de tu solicitud.
            </p>
            <div className="flex flex-col gap-4.5 lg:flex-row lg:gap-3">
              {/* Con sesión activa, proxy.ts redirige /ingresar → /cuenta. */}
              <ButtonLink href="/ingresar" className="lg:inline-flex lg:rounded-10 lg:px-7">
                Solicitar crédito
              </ButtonLink>
              <ButtonLink href="/afiliacion" variante="secundario" className="lg:hidden">
                Quiero afiliarme
              </ButtonLink>
              <a
                href="#c-apoyos"
                className="hidden h-13.5 items-center rounded-10 border-1.5 border-ga-navy px-6 text-17 font-bold text-ga-navy no-underline hover:bg-ga-fondo-suave lg:inline-flex"
              >
                Conocer la cooperativa
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-8 lg:relative lg:block lg:h-[520px] lg:p-0">
            {/* TODO(pendiente-spec): foto real de asociados → ver FOTO_HERO arriba. */}
            <EspacioFoto
              foto={FOTO_HERO}
              ilustracion="asociados"
              tono="verde"
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="h-[230px] rounded-18 lg:absolute lg:inset-0 lg:bottom-15 lg:right-15 lg:h-auto lg:rounded-20"
            />
            <div
              className="flex flex-col gap-3 rounded-16 border border-ga-borde-tarjeta bg-white p-4.5 lg:absolute lg:bottom-0 lg:right-0 lg:w-tarjeta-hero lg:gap-3.5 lg:border-0 lg:p-5.5 lg:shadow-tarjeta"
            >
              <div className="flex items-center justify-between">
                <strong className="text-16">
                  <span className="lg:hidden">Así ves tu solicitud</span>
                  <span className="hidden lg:inline">Tu solicitud</span>
                </strong>
                <Badge>En revisión</Badge>
              </div>
              <PasosSolicitud pasos={PASOS_MUESTRA} variante="lista" />
            </div>
          </div>
        </section>

        {/* Cifras */}
        <section
          aria-label="La cooperativa en cifras"
          className="mx-5 grid grid-cols-3 gap-2.5 rounded-16 bg-ga-fondo-suave p-5 lg:mx-16 lg:gap-6 lg:px-10 lg:py-8"
        >
          {[
            { valor: estadisticas.asociados, texto: <>asociados activos</> },
            {
              valor: estadisticas.creditosAprobados,
              texto: (
                <>
                  créditos aprobados<span className="hidden lg:inline"> este año</span>
                </>
              ),
            },
            {
              valor: estadisticas.tiempoRespuestaCorto ? (
                <>
                  <span className="lg:hidden">{estadisticas.tiempoRespuestaCorto}</span>
                  <span className="hidden lg:inline">{estadisticas.tiempoRespuesta}</span>
                </>
              ) : (
                estadisticas.tiempoRespuesta
              ),
              texto: <>respuesta promedio</>,
            },
          ].map((cifra, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-0.5 break-words">
              <span className="text-26 font-extrabold text-ga-verde lg:text-40">{cifra.valor}</span>
              <span className="text-13 leading-130 text-ga-texto-2 lg:text-16 lg:leading-normal">
                {cifra.texto}
              </span>
            </div>
          ))}
        </section>

        {/* Apoyos */}
        <section
          id="c-apoyos"
          className="flex scroll-mt-4 flex-col gap-6 px-5 pb-10 pt-12 lg:gap-8 lg:px-16 lg:pb-16 lg:pt-22"
        >
          <h2 className="m-0 text-28 font-extrabold tracking-subtitulo text-ga-navy lg:text-40">
            Tres apoyos, una cooperativa
          </h2>
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
            {APOYOS.map((apoyo) => (
              <article key={apoyo.titulo} className="flex flex-col gap-2.5 lg:gap-3.5">
                {/* TODO(pendiente-spec): foto de cada apoyo → ver APOYOS arriba. */}
                <EspacioFoto
                  foto={apoyo.foto}
                  ilustracion={apoyo.ilustracion}
                  tono={apoyo.tono}
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="h-40 rounded-14 lg:h-[200px]"
                />
                <h3 className="m-0 text-20 font-extrabold lg:text-22">{apoyo.titulo}</h3>
                <p className="m-0 text-16 leading-150 text-ga-texto-2 lg:leading-155">{apoyo.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Historias */}
        <section
          id="c-historias"
          className="flex scroll-mt-4 flex-col gap-4.5 bg-ga-navy px-5 py-10 text-white lg:gap-8 lg:p-16"
        >
          <h2 className="m-0 text-28 font-extrabold tracking-subtitulo lg:text-40">
            Lo que hicieron con su crédito
          </h2>
          <div className="flex flex-col gap-4.5 lg:grid lg:grid-cols-2 lg:gap-6">
            {testimonios.map((testimonio, i) => (
              <figure
                key={i}
                className="m-0 flex flex-col gap-3 rounded-16 bg-ga-navy-claro p-5 lg:gap-4 lg:p-7"
              >
                <blockquote className="m-0 text-18 leading-150 lg:text-21">{testimonio.texto}</blockquote>
                <figcaption className="text-14 text-ga-navy-texto-suave lg:text-16">
                  {testimonio.autor}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Convenios */}
        <section
          id="c-convenios"
          className="flex grow scroll-mt-4 flex-col gap-4 bg-ga-fondo-suave px-5 py-11 lg:gap-7 lg:px-16 lg:py-20"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div className="flex max-w-texto-convenios flex-col gap-4 lg:gap-2.5">
              <h2 className="m-0 text-28 font-extrabold tracking-subtitulo text-ga-navy lg:text-40">
                Empresas en convenio
              </h2>
              <p className="m-0 mb-1 text-16 leading-150 text-ga-texto-2 lg:mb-0 lg:text-17 lg:leading-155">
                Condiciones preferenciales para asociados, con el respaldo de la cooperativa
                <span className="hidden lg:inline"> en cada compra o servicio</span>.
              </p>
            </div>
            {/* Con sesión activa, proxy.ts redirige /ingresar → /cuenta. */}
            <Link href="/ingresar" className="enlace hidden text-16 font-extrabold lg:inline">
              Ver beneficios en mi cuenta
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5">
            {convenios.map((convenio) => (
              <ConvenioCard key={convenio.nombre} convenio={convenio} />
            ))}
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="mt-auto flex flex-col items-center gap-3.5 border-t border-ga-linea bg-white px-5 pb-10 pt-9 text-center text-14 leading-150 text-ga-texto-2 lg:flex-row lg:justify-between lg:border-0 lg:bg-ga-fondo-suave lg:px-16 lg:py-10 lg:text-left lg:text-15 lg:leading-normal">
        <Logo variant="apilado" className="w-[170px] lg:w-[150px]" />
        <span className="flex flex-col gap-3.5 lg:block">
          {/* TODO(pendiente-spec): número de WhatsApp, correo y texto de vigilancia. */}
          <span>
            WhatsApp {whatsapp} · {correo}
          </span>
          <span className="hidden lg:inline"> · </span>
          <span>{textoVigilancia}</span>
        </span>
      </footer>
    </div>
  );
}
