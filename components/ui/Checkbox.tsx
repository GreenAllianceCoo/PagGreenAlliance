import type { InputHTMLAttributes, ReactNode } from "react";
import { IconoCheck } from "./Iconos";
import { cx } from "./cx";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Texto de la casilla (puede incluir enlaces). */
  children: ReactNode;
  /** Clases del <label> contenedor. */
  className?: string;
  error?: string;
};

/**
 * Casilla de verificación con su texto (pieza 3a: 22 px, radio 6 px, relleno
 * verde con check blanco al marcar). El `<input>` real sigue siendo el
 * elemento interactivo (mismo `id`/`htmlFor` de siempre, para pruebas y
 * lectores de pantalla); el check se dibuja encima con un ícono que solo se
 * ve cuando el input está marcado (`peer-checked`), sin depender del estilo
 * nativo del navegador.
 */
export function Checkbox({ children, className, error, id, ...props }: CheckboxProps) {
  const idError = error && id ? `${id}-error` : undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-start gap-2.5 leading-150 text-ga-texto-2">
        <span className="relative mt-px flex h-5.5 w-5.5 shrink-0 items-center justify-center">
          <input
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={idError}
            className={cx(
              "peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-6 border-1.5 border-ga-borde-input bg-white",
              "transition-colors duration-150",
              "checked:border-ga-verde checked:bg-ga-verde",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde",
              "aria-[invalid=true]:border-ga-error",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            {...props}
          />
          <IconoCheck
            tamano={13}
            grosor={3}
            className="pointer-events-none relative text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
          />
        </span>
        <span>{children}</span>
      </label>
      {error ? (
        <span id={idError} className="text-13 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
