"use client";

import { cx } from "@/components/ui/cx";
import {
  CATEGORIAS_AFILIACION,
  etiquetaCategoriaAfiliacion,
  type CategoriaAfiliacion,
} from "@/lib/asesor/resumen";

type ResumenClientesProps = {
  /** Cuántos clientes hay en cada categoría (lib/asesor/resumen.ts, contarPorCategoriaAfiliacion). */
  conteos: Record<CategoriaAfiliacion, number>;
  categoriaActiva: CategoriaAfiliacion | "todos";
  onCambiar: (categoria: CategoriaAfiliacion | "todos") => void;
};

// Colores por categoría (pieza 2c): mismos tonos que Badge (aprobada/verde,
// rechazada/rojo, pendiente/ámbar) más el tono «enviada» para «Contactado».
const ESTILOS: Record<CategoriaAfiliacion, { fondo: string; texto: string; anillo: string }> = {
  pendiente: { fondo: "bg-ga-ambar-fondo", texto: "text-ga-ambar-texto", anillo: "ring-ga-ambar-texto" },
  contactado: { fondo: "bg-ga-gris-azulado", texto: "text-ga-navy", anillo: "ring-ga-navy" },
  aprobada: { fondo: "bg-ga-verde-claro", texto: "text-ga-verde-oscuro", anillo: "ring-ga-verde-oscuro" },
  rechazada: { fondo: "bg-ga-error-fondo", texto: "text-ga-error-texto", anillo: "ring-ga-error-texto" },
};

/**
 * Tarjetas de resumen de «Mis clientes» (pieza 2c): 4 categorías de
 * afiliación que TAMBIÉN filtran la tabla (DECISIONES: «menos controles»).
 * Tocar la tarjeta activa la vuelve a poner en «Todos» (como los chips).
 * MOVIMIENTO: los números entran escalonados (70 ms entre cada uno);
 * `motion-safe:` respeta prefers-reduced-motion sin JS.
 */
export function ResumenClientes({ conteos, categoriaActiva, onCambiar }: ResumenClientesProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
      {CATEGORIAS_AFILIACION.map((categoria, indice) => {
        const activa = categoriaActiva === categoria;
        const estilo = ESTILOS[categoria];
        return (
          <button
            key={categoria}
            type="button"
            onClick={() => onCambiar(activa ? "todos" : categoria)}
            aria-pressed={activa}
            className={cx(
              "motion-safe:animate-ga-entrada relative flex flex-col gap-0.5 overflow-hidden rounded-20 p-3.5 text-left transition-shadow duration-200 lg:gap-1.5 lg:rounded-26 lg:p-5.5",
              estilo.fondo,
              activa ? cx("ring-[2.5px] ring-inset", estilo.anillo) : "ring-[2.5px] ring-inset ring-transparent",
            )}
            style={{ animationDelay: `${indice * 70}ms` }}
          >
            <span
              className={cx(
                "font-display text-36 font-extrabold leading-none tracking-cifra-grande lg:text-60",
                estilo.texto,
              )}
            >
              {conteos[categoria]}
            </span>
            <span className={cx("text-14 font-bold lg:text-16", estilo.texto)}>
              {etiquetaCategoriaAfiliacion(categoria)}
            </span>
            <span className="hidden text-13 text-ga-texto-2 lg:inline">afiliación</span>
          </button>
        );
      })}
    </div>
  );
}
