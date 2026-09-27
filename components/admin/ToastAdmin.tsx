"use client";

import { useEffect } from "react";
import { IconoCheck } from "@/components/ui/Iconos";

type Props = {
  mensaje: string | null;
  /** Se llama a los 3 s para que quien use este componente limpie `mensaje` (pieza 2d «MOVIMIENTO»). */
  onCerrar: () => void;
};

/**
 * Aviso flotante de «Aprobado»/«Rechazado» (pieza 2d): entra desde abajo con
 * un fundido y se retira solo a los 3 s. `prefers-reduced-motion` ya deja la
 * animación de entrada en su estado final (regla global de app/globals.css).
 */
export function ToastAdmin({ mensaje, onCerrar }: Props) {
  useEffect(() => {
    if (!mensaje) return;
    const id = setTimeout(onCerrar, 3000);
    return () => clearTimeout(id);
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-7 right-7 z-30 flex animate-ga-toast items-center gap-3 rounded-16 bg-admin-texto px-4.5 py-3.5 font-bold text-admin-fondo shadow-modal-toast"
    >
      <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ga-verde text-white">
        <IconoCheck tamano={14} grosor={2.5} />
      </span>
      {mensaje}
    </div>
  );
}
