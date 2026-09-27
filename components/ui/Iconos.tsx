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

export function IconoCheck({ trazo, ...props }: IconoProps & { trazo?: boolean }) {
  return (
    <Base {...props}>
      {/* `trazo`: el check se dibuja con stroke-dashoffset al entrar la pantalla
          (pieza 3c, comprobante de «Solicitud enviada»). 32 alcanza de sobra el
          largo real del trazo (≈20 en el sistema de coordenadas del viewBox). */}
      <path
        d="M5 12l4 4 10-10"
        className={trazo ? "motion-safe:animate-ga-trazo" : undefined}
        style={trazo ? { strokeDasharray: 32, strokeDashoffset: 0 } : undefined}
      />
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

/** Hoja con renglones: estado vacío de «Tu solicitud» en /cuenta (pieza 3d). */
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

/**
 * Glifo oficial de WhatsApp (relleno, sin trazo, SVG en línea): pieza 3e/3i,
 * botón «Escribir por WhatsApp» (D-08). El verde de marca (#25D366) va SOLO
 * en el ícono, nunca en el fondo del botón (decisión de 3i, para no competir
 * con «Aprobar»/«Rechazar»); en el estado deshabilitado se apaga a gris.
 */
export function IconoWhatsapp({ tamano = 17, apagado = false }: { tamano?: number; apagado?: boolean }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        fill={apagado ? "#9FB1BD" : "#25D366"}
        d="M16.004 3C9.377 3 4 8.373 4 15c0 2.339.646 4.523 1.77 6.393L4 29l7.84-1.735A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm0 21.818a9.77 9.77 0 0 1-4.98-1.36l-.357-.213-4.653 1.03 1.004-4.53-.232-.37A9.76 9.76 0 0 1 6.18 15c0-5.418 4.407-9.818 9.824-9.818 5.416 0 9.822 4.4 9.822 9.818 0 5.418-4.406 9.818-9.822 9.818zm5.4-7.35c-.297-.15-1.756-.867-2.028-.966-.272-.099-.47-.148-.669.15-.198.297-.767.965-.94 1.164-.173.198-.347.223-.644.074-.297-.148-1.254-.462-2.389-1.474-.883-.787-1.48-1.76-1.653-2.058-.173-.297-.018-.458.13-.606.134-.134.297-.347.446-.52.148-.174.198-.298.297-.496.099-.198.05-.372-.025-.52-.074-.149-.669-1.612-.916-2.208-.242-.581-.487-.502-.669-.512l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.48 0 1.463 1.065 2.877 1.213 3.075.148.198 2.098 3.203 5.084 4.49.71.306 1.264.489 1.696.626.712.226 1.36.194 1.872.118.571-.085 1.756-.718 2.004-1.412.248-.694.248-1.288.174-1.412-.074-.124-.272-.198-.57-.347z"
      />
    </svg>
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
