import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /**
   * `md` = 52 px / 17 px (formulario de afiliación).
   * `lg` = 56 px / 20 px con espaciado de letras (cédula en /ingresar).
   */
  tamano?: "md" | "lg";
};

/** Campo de texto. Borde rojo automático con `aria-invalid="true"`. */
export function Input({ tamano = "md", className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cx(
        "w-full min-w-0 rounded-12 border-1.5 border-ga-borde bg-white px-3.5 text-ga-texto",
        "placeholder:text-ga-texto-3 aria-[invalid=true]:border-ga-error",
        tamano === "lg" ? "h-14 text-20 tracking-cedula lg:px-4" : "h-13 text-17",
        className,
      )}
      {...props}
    />
  );
}
