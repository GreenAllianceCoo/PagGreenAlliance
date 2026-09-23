import type { ReactNode } from "react";
import { cx } from "./cx";

/** Atributos de accesibilidad que Field entrega al control. */
export type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FieldProps = {
  id: string;
  label: ReactNode;
  /** Agrega «(opcional)» después del label. */
  opcional?: boolean;
  /** Texto de ayuda bajo el control. */
  ayuda?: ReactNode;
  /** Clases extra de la ayuda (p. ej. `lg:hidden` si solo va en celular). */
  ayudaClassName?: string;
  /** Mensaje de error (en español). Pone el control en estado inválido. */
  error?: string;
  /** `md` = label 15 px (afiliación). `lg` = label 16 px (ingreso). */
  tamano?: "md" | "lg";
  className?: string;
  /** Recibe los atributos a poner en el control (`{...control}`). */
  children: (control: ControlProps) => ReactNode;
};

/** Label + control + ayuda + error, enlazados con `aria-describedby`. */
export function Field({
  id,
  label,
  opcional,
  ayuda,
  ayudaClassName,
  error,
  tamano = "md",
  className,
  children,
}: FieldProps) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idAyuda, idError].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cx("font-bold", tamano === "lg" ? "text-16" : "text-15")}>
        {label}
        {opcional ? <span className="font-normal text-ga-texto-3"> (opcional)</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {ayuda ? (
        <span id={idAyuda} className={cx("text-13 text-ga-texto-3", ayudaClassName)}>
          {ayuda}
        </span>
      ) : null}
      {error ? (
        <span id={idError} className="text-14 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
