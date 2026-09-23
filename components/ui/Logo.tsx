import Image from "next/image";
import { cx } from "./cx";

type LogoProps = {
  /** `dark` = logo a color sobre fondo claro; `light` = blanco sobre verde/navy. */
  tone?: "light" | "dark";
  /** `horizontal` = isotipo + letras (240×44). `apilado` = logo completo con lema. */
  variant?: "horizontal" | "apilado";
  className?: string;
};

// Proporción del logo apilado (viewBox 4442×2900).
const APILADO_ANCHO = 4442;
const APILADO_ALTO = 2900;

// Letras «COOPERATIVA / GREEN ALLIANCE» recortadas del logo oficial
// (public/logos/*/green-alliance-wordmark*.svg, viewBox 4118×669).
// En el header ocupan el ancho que queda después del isotipo (240 − 44 − 10 = 186 px).
const LETRAS_ANCHO = 186;
const LETRAS_ALTO = 30; // 186 × 669 / 4118 ≈ 30,2

/**
 * Logo de la cooperativa (design/Logo.dc.html).
 * - Horizontal: isotipo 44 px + letras del logo oficial (SVG, no texto HTML), para
 *   que se vea igual al archivo de marca. El nombre accesible es
 *   «Cooperativa Green Alliance» (alt de las letras).
 * - Apilado: archivo completo «Escudo y protección». El ancho se controla con
 *   `className` (p. ej. `w-[200px]`); el alto se ajusta solo.
 */
export function Logo({ tone = "dark", variant = "horizontal", className }: LogoProps) {
  const claro = tone === "light";

  if (variant === "apilado") {
    return (
      <Image
        src={
          claro
            ? "/logos/blanco/green-alliance-logo-blanco.svg"
            : "/logos/vector/green-alliance-logo.svg"
        }
        alt="Cooperativa Green Alliance · Escudo y protección"
        width={APILADO_ANCHO}
        height={APILADO_ALTO}
        className={cx("block h-auto", className)}
      />
    );
  }

  return (
    <span className={cx("flex h-11 w-logo max-w-full items-center gap-2.5", className)}>
      <Image
        src={
          claro
            ? "/logos/blanco/green-alliance-isotipo-blanco.svg"
            : "/logos/vector/green-alliance-isotipo.svg"
        }
        alt=""
        width={44}
        height={44}
        className="block h-11 w-11 shrink-0"
      />
      <Image
        src={
          claro
            ? "/logos/blanco/green-alliance-wordmark-blanco.svg"
            : "/logos/vector/green-alliance-wordmark.svg"
        }
        alt="Cooperativa Green Alliance"
        width={LETRAS_ANCHO}
        height={LETRAS_ALTO}
        className="block h-auto min-w-0 flex-1"
      />
    </span>
  );
}
