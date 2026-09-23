import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Texto de la casilla (puede incluir enlaces). */
  children: ReactNode;
  /** Clases del <label> contenedor. */
  className?: string;
  error?: string;
};

/** Casilla de verificación con su texto (22 px, color verde). */
export function Checkbox({ children, className, error, id, ...props }: CheckboxProps) {
  const idError = error && id ? `${id}-error` : undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-start gap-2.5 leading-150 text-ga-texto-2">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={idError}
          className="m-0 h-5.5 w-5.5 shrink-0 accent-ga-verde"
          {...props}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <span id={idError} className="text-14 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
