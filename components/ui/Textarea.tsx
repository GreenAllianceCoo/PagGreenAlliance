import type { TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

/** Área de texto (16 px, sin redimensionar). Mismo lenguaje de foco/error/deshabilitado que Input (pieza 3a). */
export function Textarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cx(
        "w-full min-w-0 resize-none rounded-12 border-1.5 border-ga-borde-input bg-white px-3.5 py-3 text-16 text-ga-texto",
        "transition-[border-color,box-shadow] duration-150",
        "placeholder:text-ga-texto-3",
        "focus:border-ga-verde focus:outline-none focus:shadow-[0_0_0_3px_rgba(30,102,82,0.15)]",
        "aria-[invalid=true]:border-ga-error",
        "disabled:cursor-not-allowed disabled:border-ga-linea disabled:bg-ga-fondo-suave disabled:text-ga-deshabilitado-texto",
        className,
      )}
      {...props}
    />
  );
}
