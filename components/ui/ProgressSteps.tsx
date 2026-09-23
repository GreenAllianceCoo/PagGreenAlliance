import type { ReactNode } from "react";

type ProgressStepsProps = {
  pasoActual: number;
  totalPasos: number;
  /** Contenido a la derecha de «Paso X de Y» (p. ej. «Cambiar cédula»). */
  accion?: ReactNode;
};

/**
 * Barras de progreso + «Paso X de Y». Devuelve dos elementos hermanos para que
 * el espacio entre ellos lo ponga el `gap` del formulario, como en el diseño.
 */
export function ProgressSteps({ pasoActual, totalPasos, accion }: ProgressStepsProps) {
  return (
    <>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: totalPasos }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] grow rounded-3 ${i < pasoActual ? "bg-ga-verde" : "bg-ga-linea"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-14 font-bold text-ga-verde">
          Paso {pasoActual} de {totalPasos}
        </span>
        {accion}
      </div>
    </>
  );
}
