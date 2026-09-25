import type { Convenio } from "@/lib/mock";

type ConvenioCardProps = {
  convenio: Convenio;
  /**
   * `tarjeta` (landing): fila en celular, tarjeta vertical en escritorio.
   * `enlace` (/cuenta): chip compacto con emoji + nombre corto.
   */
  variante?: "tarjeta" | "enlace";
  /** Destino del chip `enlace`. */
  href?: string;
};

export function ConvenioCard({ convenio, variante = "tarjeta", href = "#" }: ConvenioCardProps) {
  if (variante === "enlace") {
    return (
      <a
        href={href}
        className="flex items-center gap-2.5 rounded-12 border border-ga-borde-tarjeta p-3 text-14 font-bold text-ga-texto no-underline hover:bg-ga-fondo-suave"
      >
        <span aria-hidden="true" className="text-22">
          {convenio.emoji}
        </span>
        {convenio.nombreCorto}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3.5 rounded-14 border border-ga-borde-tarjeta bg-white p-3.5 lg:flex-col lg:items-start lg:gap-3 lg:p-5">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-12 bg-ga-verde-tint text-26 lg:h-13 lg:w-13 lg:rounded-14 lg:text-28"
      >
        {convenio.emoji}
      </span>
      <span className="flex flex-col gap-0.5 lg:contents">
        <strong className="text-16 font-extrabold text-ga-texto lg:text-17 lg:leading-125">
          {convenio.nombre}
        </strong>
        <span className="text-14 text-ga-texto-2">{convenio.especialidad}</span>
      </span>
    </div>
  );
}
