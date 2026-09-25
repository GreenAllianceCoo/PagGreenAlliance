import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Estados de la pieza 3a («Chips de estado»): las 4 de solicitud de crédito
 * (enviada/revision/aprobada/rechazada) y las 2 de afiliación que no
 * comparten color con crédito (pendiente = revision, contactado = enviada).
 */
export type EstadoBadge = "enviada" | "revision" | "aprobada" | "rechazada";

const ESTILOS: Record<EstadoBadge, string> = {
  enviada: "bg-ga-gris-azulado text-ga-navy",
  revision: "bg-ga-ambar-fondo text-ga-ambar-texto",
  aprobada: "bg-ga-verde-claro text-ga-verde-oscuro",
  rechazada: "bg-ga-error-fondo text-ga-error-texto",
};

type BadgeProps = {
  children: ReactNode;
  /** `sm` = 13 px (tarjetas); `md` = 13 px en celular y 14 px en escritorio (/cuenta). */
  tamano?: "sm" | "md";
  /** Color según el estado (pieza 3a). Por defecto «revision» (ámbar), como hasta ahora. */
  estado?: EstadoBadge;
};

/** Etiqueta de estado (chip de solicitud de crédito o de afiliación). */
export function Badge({ children, tamano = "sm", estado = "revision" }: BadgeProps) {
  return (
    <span
      className={cx(
        "rounded-full px-2.5 py-1 text-13 font-bold",
        ESTILOS[estado],
        tamano === "md" && "lg:px-3 lg:py-[5px] lg:text-14",
      )}
    >
      {children}
    </span>
  );
}
