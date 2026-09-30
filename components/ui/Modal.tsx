"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cx } from "./cx";

type ModalProps = {
  abierto: boolean;
  onCerrar: () => void;
  /** id del título (<h2 id=…>) que está dentro de `children`: da el nombre accesible del diálogo. */
  tituloId: string;
  /**
   * `adaptable` (piezas 3k y 3n): hoja inferior con «grip» en celular/tableta y modal
   * centrado desde `lg`. `centrado`: siempre modal centrado.
   */
  variante?: "adaptable" | "centrado";
  /** Ancho máximo del modal centrado (clase de Tailwind). */
  anchoClassName?: string;
  className?: string;
  children: ReactNode;
};

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo accesible compartido (perfil del asociado, convenios): role="dialog"
 * aria-modal, foco atrapado, Escape y clic en el fondo lo cierran, el foco vuelve
 * al botón que lo abrió y la página de atrás no se desplaza.
 * Movimiento: fondo con fundido, panel con scale .96→1 (escritorio) o translateY
 * (hoja); arrastrar la hoja hacia abajo la cierra. Con prefers-reduced-motion
 * (app/globals.css) todo queda en fundidos instantáneos.
 */
export function Modal({
  abierto,
  onCerrar,
  tituloId,
  variante = "adaptable",
  anchoClassName = "lg:max-w-[640px]",
  className,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previoRef = useRef<HTMLElement | null>(null);
  const [arrastre, setArrastre] = useState<{ inicio: number; dy: number } | null>(null);

  useEffect(() => {
    if (!abierto) return;
    previoRef.current = document.activeElement as HTMLElement | null;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco inicial: el primer control del diálogo (o el propio panel).
    const primero = panelRef.current?.querySelector<HTMLElement>(FOCALIZABLES);
    (primero ?? panelRef.current)?.focus();
    return () => {
      document.body.style.overflow = anterior;
      previoRef.current?.focus();
    };
  }, [abierto]);

  if (!abierto) return null;

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      onCerrar();
      return;
    }
    if (evento.key !== "Tab") return;
    const focoables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCALIZABLES) ?? []);
    if (focoables.length === 0) {
      evento.preventDefault();
      return;
    }
    const primero = focoables[0];
    const ultimo = focoables[focoables.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  const esHoja = variante === "adaptable";

  // Arrastre del «grip» (solo celular): más de 80 px hacia abajo cierra la hoja.
  function alBajarGrip(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastre({ inicio: e.clientY, dy: 0 });
  }
  function alMoverGrip(e: PointerEvent<HTMLDivElement>) {
    if (arrastre) setArrastre({ ...arrastre, dy: Math.max(0, e.clientY - arrastre.inicio) });
  }
  function alSoltarGrip() {
    if (arrastre && arrastre.dy > 80) onCerrar();
    setArrastre(null);
  }

  return (
    <div
      className={cx(
        "fixed inset-0 z-50 flex justify-center",
        esHoja ? "items-end lg:items-center lg:p-10" : "items-center p-4",
      )}
      onKeyDown={alTeclear}
    >
      <div
        aria-hidden="true"
        onClick={onCerrar}
        className="motion-safe:animate-ga-aparecer absolute inset-0 bg-[rgba(20,33,43,0.45)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        style={arrastre ? { transform: `translateY(${arrastre.dy}px)` } : undefined}
        className={cx(
          "relative flex w-full flex-col overflow-auto bg-white outline-none",
          esHoja
            ? "max-h-[85dvh] rounded-t-26 px-5 pb-7 pt-3.5 shadow-[0_-20px_50px_-20px_rgba(20,33,43,0.5)] motion-safe:animate-ga-hoja lg:max-h-[80dvh] lg:rounded-28 lg:px-10 lg:py-9 lg:shadow-[0_40px_80px_-30px_rgba(20,33,43,0.5)] lg:motion-safe:animate-ga-modal"
            : "max-h-[85dvh] max-w-md rounded-22 p-6 shadow-[0_10px_30px_-10px_rgba(20,33,43,0.35)] motion-safe:animate-ga-modal",
          esHoja && anchoClassName,
          className,
        )}
      >
        {esHoja ? (
          <div
            aria-hidden="true"
            onPointerDown={alBajarGrip}
            onPointerMove={alMoverGrip}
            onPointerUp={alSoltarGrip}
            onPointerCancel={() => setArrastre(null)}
            className="mb-3 flex shrink-0 cursor-grab touch-none justify-center py-1 lg:hidden"
          >
            <span className="h-1.5 w-10 rounded-full bg-ga-linea" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-3.5 top-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-ga-fondo-suave text-15 text-ga-texto-3 hover:bg-ga-linea focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde lg:right-5 lg:top-5"
        >
          <span aria-hidden="true">✕</span>
        </button>
        {children}
      </div>
    </div>
  );
}
