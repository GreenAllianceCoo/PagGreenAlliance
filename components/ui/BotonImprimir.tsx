"use client";

/** Abre el diálogo de impresión del navegador (allí se elige «Guardar como PDF»). */
export function BotonImprimir({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children}
    </button>
  );
}
