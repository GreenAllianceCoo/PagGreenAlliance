/**
 * Íconos SVG del diseño (trazo, 24×24). Todos son decorativos (aria-hidden).
 * El color se hereda con `currentColor`: se controla con clases `text-*`.
 */
import type { SVGProps } from "react";

type IconoProps = SVGProps<SVGSVGElement> & { tamano?: number; grosor?: number };

function Base({ tamano = 24, grosor = 2, children, ...props }: IconoProps) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconoCheck(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M5 12l4 4 10-10" />
    </Base>
  );
}

export function IconoVolver(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Base>
  );
}

export function IconoInfo(props: IconoProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Base>
  );
}

export function IconoMas(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Base>
  );
}

export function IconoConvenios(props: IconoProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </Base>
  );
}

/** Hoja con renglones: estado vacío de «Tu solicitud» en /cuenta (no está en el diseño). */
export function IconoDocumento(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M5 3h9l5 5v13H5z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </Base>
  );
}

export function IconoSalir(props: IconoProps) {
  return (
    <Base {...props}>
      <path d="M15 4h4v16h-4" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h10" />
    </Base>
  );
}
