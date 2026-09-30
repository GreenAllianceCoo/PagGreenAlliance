import type { SelectHTMLAttributes } from "react";
import { cx } from "./cx";

/** Lista desplegable nativa (52 px / 17 px). Mismo lenguaje de foco/error/deshabilitado que Input (pieza 3a). */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-13 w-full min-w-0 rounded-12 border-1.5 border-ga-borde-input bg-white px-3 text-17 text-ga-texto",
        "transition-[border-color,box-shadow] duration-150",
        "focus:border-ga-verde focus:outline-none focus:shadow-[0_0_0_3px_rgba(30,102,82,0.15)]",
        "aria-[invalid=true]:border-ga-error",
        "disabled:cursor-not-allowed disabled:border-ga-linea disabled:bg-ga-fondo-suave disabled:text-ga-deshabilitado-texto",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
