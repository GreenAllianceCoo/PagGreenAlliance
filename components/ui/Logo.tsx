import Image from "next/image";
import { cx } from "./cx";

type LogoProps = {
  /** `dark` = logo a color sobre fondo claro; `light` = blanco sobre verde/navy. */
  tone?: "light" | "dark";
  /** `horizontal` = isotipo + texto (240×44). `apilado` = logo completo con lema. */
  variant?: "horizontal" | "apilado";
  className?: string;
};

// Proporción del logo apilado (viewBox 4442×2900).
const APILADO_ANCHO = 4442;
const APILADO_ALTO = 2900;

/**
 * Logo de la cooperativa (design/Logo.dc.html).
 * - Horizontal: isotipo 44 px + «COOPERATIVA / GREEN ALLIANCE» en Montserrat.
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
    <span className={cx("flex h-11 w-logo items-center gap-2.5 font-logo", className)}>
      <Image
        src={
          claro
            ? "/logos/blanco/green-alliance-isotipo-blanco.svg"
            : "/logos/vector/green-alliance-isotipo.svg"
        }
        alt=""
        width={44}
        height={44}
        className="block h-11 w-11"
      />
      <span
        className={cx(
          "flex flex-col leading-none",
          claro ? "text-white" : "text-ga-navy-logo",
        )}
      >
        <span className="text-10 font-bold tracking-logo-sup">COOPERATIVA</span>
        <span className="whitespace-nowrap text-18 font-extrabold tracking-logo">
          <span className={claro ? undefined : "text-ga-verde"}>GREEN</span> ALLIANCE
        </span>
      </span>
    </span>
  );
}
