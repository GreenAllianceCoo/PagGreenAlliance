import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cx } from "./cx";

export type VarianteBoton = "primario" | "secundario" | "terciario";

const BASE =
  "flex items-center justify-center rounded-12 font-extrabold no-underline transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const VARIANTES: Record<VarianteBoton, string> = {
  // Verde relleno: acción principal (54 px).
  primario:
    "h-13.5 bg-ga-verde text-17 text-white hover:bg-ga-verde-oscuro hover:text-white",
  // Borde navy: acción secundaria (54 px).
  secundario:
    "h-13.5 border-1.5 border-ga-navy text-16 text-ga-navy hover:bg-ga-fondo-suave hover:text-ga-navy",
  // Borde verde: «Hablar con la cooperativa» (52 px).
  terciario:
    "h-13 border-1.5 border-ga-verde text-16 text-ga-verde hover:bg-ga-verde-tint hover:text-ga-verde",
};

/** Clases de botón para reutilizar en <button> y en enlaces. */
export function clasesBoton(variante: VarianteBoton = "primario", className?: string) {
  return cx(BASE, VARIANTES[variante], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
  /** Estado de carga: deshabilita el botón y muestra `textoCargando`. */
  cargando?: boolean;
  textoCargando?: string;
};

/** Botón de acción (submit por defecto). */
export function Button({
  variante = "primario",
  cargando = false,
  textoCargando,
  className,
  children,
  disabled,
  type = "submit",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={clasesBoton(variante, className)}
      {...props}
    >
      {cargando && textoCargando ? textoCargando : children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variante?: VarianteBoton };

/** Enlace con apariencia de botón (navegación, no acciones). */
export function ButtonLink({ variante = "primario", className, ...props }: ButtonLinkProps) {
  return <Link className={clasesBoton(variante, className)} {...props} />;
}
