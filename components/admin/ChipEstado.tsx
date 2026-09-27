import { cx } from "@/components/ui/cx";

/**
 * Chip de estado del admin oscuro (pieza 2d, filas de la lista y encabezado
 * del detalle). Los 3 estados de crédito y los 4 de afiliación comparten
 * los mismos 4 tonos: ámbar (pendiente), neutro (contactado), menta
 * (aprobado/a) y rojo (rechazado/a).
 */
export type TonoChip = "ambar" | "neutro" | "verde" | "rojo";

const TONOS: Record<TonoChip, string> = {
  ambar: "bg-admin-ambar-fondo text-admin-ambar",
  neutro: "text-admin-texto-3 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]",
  verde: "bg-admin-verde-fondo text-admin-verde",
  rojo: "bg-admin-rojo-fondo text-admin-rojo-2",
};

/** Estados reales de `solicitudes_credito.estado` y `solicitudes_afiliacion.estado`. */
export type EstadoAdmin = "pendiente" | "contactado" | "aprobada" | "rechazada" | "aprobado" | "rechazado";

const TONO_POR_ESTADO: Record<EstadoAdmin, TonoChip> = {
  pendiente: "ambar",
  contactado: "neutro",
  aprobada: "verde",
  aprobado: "verde",
  rechazada: "rojo",
  rechazado: "rojo",
};

const ETIQUETA: Record<EstadoAdmin, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  aprobada: "Aprobada",
  aprobado: "Aprobado",
  rechazada: "Rechazada",
  rechazado: "Rechazado",
};

type Props = { estado: EstadoAdmin; tamano?: "sm" | "md"; className?: string };

/** Chip coloreado según el estado, con transición de color al cambiar (pieza 2d «MOVIMIENTO»). */
export function ChipEstado({ estado, tamano = "sm", className }: Props) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full font-extrabold transition-colors duration-300",
        tamano === "sm" ? "px-2.5 py-[5px] text-13" : "px-3 py-1.5 text-14",
        TONOS[TONO_POR_ESTADO[estado]],
        className,
      )}
    >
      {ETIQUETA[estado]}
    </span>
  );
}
