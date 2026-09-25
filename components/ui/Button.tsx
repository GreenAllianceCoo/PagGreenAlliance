import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cx } from "./cx";

export type VarianteBoton = "primario" | "secundario" | "terciario";

// Rediseño C+ (pieza 3a, docs/Green Alliance C+.dc.html): los botones pasan
// de esquina de 12 px a píldora completa (radio 999px, «radios --ga-radius-*»).
// El estado deshabilitado usa opacity .4 (antes .6) y el estado «cargando» se ve
// distinto (opacity .85 + aro girando), tal como muestra la fila «Botón» del
// design system.
const BASE =
  "relative flex items-center justify-center rounded-full font-extrabold no-underline transition-colors duration-200 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde " +
  "disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

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

/** Aro girando del estado «cargando» (Enviando…, Entrando…), 14 px, hereda el color del texto. */
function AroCargando() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
  /** Estado de carga: deshabilita el botón, baja la opacidad a .85 y agrega el aro girando. */
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
      className={cx(clasesBoton(variante, className), cargando && "gap-2 opacity-85 disabled:opacity-85")}
      {...props}
    >
      {cargando ? <AroCargando /> : null}
      {cargando && textoCargando ? textoCargando : children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variante?: VarianteBoton };

/** Enlace con apariencia de botón (navegación, no acciones). */
export function ButtonLink({ variante = "primario", className, ...props }: ButtonLinkProps) {
  return <Link className={clasesBoton(variante, className)} {...props} />;
}
