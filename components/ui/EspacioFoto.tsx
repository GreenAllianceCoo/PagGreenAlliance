import Image from "next/image";
import { cx } from "./cx";

/** Foto real para el espacio (ruta en /public o remota permitida en next.config). */
export type FotoReal = { src: string; alt: string };

export type IlustracionFoto = "asociados" | "credito" | "orientacion" | "legal";

type EspacioFotoProps = {
  /**
   * Foto real. Mientras sea `null`/`undefined` se muestra el diseño decorativo de marca.
   * Para cambiarla basta con pasar `{ src: "/fotos/asociados.jpg", alt: "…" }`.
   */
  foto?: FotoReal | null;
  /** Dibujo simple que acompaña el diseño decorativo. */
  ilustracion: IlustracionFoto;
  /** Degradado de marca. */
  tono?: "verde" | "navy" | "oscuro";
  /** Valor `sizes` de next/image cuando hay foto real. */
  sizes?: string;
  /** Tamaño, radio y posición del espacio (lo define la pantalla). */
  className?: string;
};

// Degradados con los tokens de marca (verde / navy).
const DEGRADADOS = {
  verde: "from-ga-verde to-ga-navy",
  navy: "from-ga-navy to-ga-verde-oscuro",
  oscuro: "from-ga-verde-oscuro to-ga-verde",
} as const;

/**
 * Espacio reservado para una foto. Sin foto real muestra un degradado de marca con
 * patrón de puntos, el isotipo en marca de agua y una ilustración simple; todo es
 * decorativo (`aria-hidden`), así que no aporta texto a los lectores de pantalla.
 */
export function EspacioFoto({
  foto,
  ilustracion,
  tono = "verde",
  sizes = "(min-width: 1024px) 50vw, 100vw",
  className,
}: EspacioFotoProps) {
  if (foto) {
    return (
      <div className={cx("relative overflow-hidden", className)}>
        <Image src={foto.src} alt={foto.alt} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }

  const esHero = ilustracion === "asociados";

  return (
    <div
      aria-hidden="true"
      className={cx("relative overflow-hidden bg-gradient-to-br", DEGRADADOS[tono], className)}
    >
      <div className="patron-puntos absolute inset-0" />
      {/* Isotipo en marca de agua, recortado por el borde. */}
      <Image
        src="/logos/blanco/green-alliance-isotipo-blanco.svg"
        alt=""
        width={512}
        height={512}
        className={cx(
          "pointer-events-none absolute h-auto opacity-10",
          esHero
            ? "-left-10 -top-12 w-[260px] lg:-left-16 lg:-top-16 lg:w-[420px]"
            : "-bottom-10 -right-8 w-[170px] lg:w-[200px]",
        )}
      />
      <div
        className={cx(
          "absolute inset-0 flex items-center justify-center",
          // En escritorio la tarjeta «Tu solicitud» tapa la esquina inferior derecha del
          // hero: la ilustración se corre hacia arriba a la izquierda.
          esHero && "lg:items-start lg:justify-start lg:pl-[18%] lg:pt-[16%]",
        )}
      >
        <div
          className={cx(
            "flex items-center justify-center rounded-full bg-ga-marca-agua text-white",
            esHero ? "h-36 w-36 lg:h-56 lg:w-56" : "h-22 w-22 lg:h-24 lg:w-24",
          )}
        >
          <Ilustracion tipo={ilustracion} />
        </div>
      </div>
    </div>
  );
}

/** Dibujos de trazo simple en blanco (heredan `currentColor`). */
function Ilustracion({ tipo }: { tipo: IlustracionFoto }) {
  if (tipo === "asociados") {
    return (
      <svg viewBox="0 0 160 100" className="h-auto w-28 lg:w-44" fill="currentColor" focusable="false">
        <g opacity="0.55">
          <circle cx="40" cy="46" r="12" />
          <path d="M18 96c0-18 9-28 22-28s22 10 22 28z" />
          <circle cx="120" cy="46" r="12" />
          <path d="M98 96c0-18 9-28 22-28s22 10 22 28z" />
        </g>
        <circle cx="80" cy="34" r="16" />
        <path d="M52 96c0-24 12-36 28-36s28 12 28 36z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12 lg:h-14 lg:w-14"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {tipo === "credito" && (
        <>
          {/* Monedas apiladas + flecha de crecimiento */}
          <ellipse cx="24" cy="26" rx="14" ry="5" />
          <path d="M10 26v8c0 2.8 6.3 5 14 5s14-2.2 14-5v-8" />
          <path d="M10 34v8c0 2.8 6.3 5 14 5s14-2.2 14-5v-8" />
          <path d="M10 42v8c0 2.8 6.3 5 14 5s14-2.2 14-5v-8" />
          <path d="M44 34l12-14" />
          <path d="M48 19h8v8" />
        </>
      )}
      {tipo === "orientacion" && (
        <>
          {/* Conversación con gráfica de cuentas ordenadas */}
          <path d="M12 12h40a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H28l-10 8v-8h-6a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" />
          <path d="M20 38v-8" />
          <path d="M32 38V22" />
          <path d="M44 38v-12" />
        </>
      )}
      {tipo === "legal" && (
        <>
          {/* Balanza */}
          <path d="M32 12v42" />
          <path d="M22 54h20" />
          <path d="M12 18h40" />
          <circle cx="32" cy="10" r="2" />
          <path d="M12 18L5 34M12 18l7 16" />
          <path d="M3 34h18a9 6 0 0 1-18 0z" />
          <path d="M52 18l-7 16M52 18l7 16" />
          <path d="M43 34h18a9 6 0 0 1-18 0z" />
        </>
      )}
    </svg>
  );
}
