import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /**
   * `md` = 52 px / 17 px (formulario de afiliación).
   * `lg` = 56 px / 20 px con espaciado de letras (cédula en /ingresar).
   */
  tamano?: "md" | "lg";
};

// Rediseño C+ (pieza 3a): borde `--ga-borde-input` (#D5DCE0, antes #B9C3CA),
// foco con borde verde + halo de 3 px (rgba(30,102,82,.15)) y estado
// deshabilitado (fondo suave, borde y texto apagados). Solo transform/opacity
// quedan fuera de esta transición porque el color de borde no está en la
// lista de propiedades animables de MOVIMIENTO; se anima igual porque un
// cambio de color no dispara reflow ni depende de prefers-reduced-motion.
const BASE =
  "w-full min-w-0 rounded-12 border-1.5 border-ga-borde-input bg-white px-3.5 text-ga-texto " +
  // «Foco animado» (tarea de /ingresar y /afiliacion): el halo verde entra junto con el borde.
  "transition-[border-color,box-shadow] duration-150 " +
  "placeholder:text-ga-texto-3 " +
  "focus:border-ga-verde focus:outline-none focus:shadow-[0_0_0_3px_rgba(30,102,82,0.15)] " +
  "aria-[invalid=true]:border-ga-error aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgba(179,38,30,0.12)] " +
  "disabled:cursor-not-allowed disabled:border-ga-linea disabled:bg-ga-fondo-suave disabled:text-ga-deshabilitado-texto disabled:placeholder:text-ga-deshabilitado-texto";

/** Campo de texto. Borde rojo automático con `aria-invalid="true"`. */
export function Input({ tamano = "md", className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cx(
        BASE,
        tamano === "lg" ? "h-14 text-20 tracking-cedula lg:px-4" : "h-13 text-17",
        className,
      )}
      {...props}
    />
  );
}
