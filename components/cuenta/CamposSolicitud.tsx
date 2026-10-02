import { MONTO_MINIMO } from "@/lib/credito";

/** Un paquete de crédito (50 % / 100 %) del grado. Nunca lleva la tasa: el asociado no la ve. */
export type PaqueteCampos = {
  porcentaje: "50" | "100";
  capacidad_maxima: number;
  plazo_meses: number;
};

/** Paso del deslizador de monto (COP). */
export const PASO_MONTO = 50000;

export function formatoCOP(valor: number) {
  return `$${Math.round(valor).toLocaleString("es-CO")}`;
}

type CamposSolicitudProps = {
  paquetes: PaqueteCampos[];
  gradoNombre: string;
  /** "" = todavía no eligió (pieza 3t). */
  porcentaje: "" | "50" | "100";
  monto: number;
  onPorcentaje: (p: PaqueteCampos) => void;
  onMonto: (monto: number) => void;
  /** Errores por campo (solo la solicitud real los usa). */
  errorPorcentaje?: string;
  errorMonto?: string;
};

/**
 * Campos de «Solicita tu crédito» (pieza 3t): cupo del grado, porcentaje, monto y plazo.
 * Compartido por /cuenta/solicitar (real, con Server Action) y la cuenta de demostración
 * (/admin/demo y /asesor/demo), para que se vean idénticos. Solo presentación: el estado
 * y el envío los pone quien lo usa. Sin tasa, cuota ni total.
 */
export function CamposSolicitud({
  paquetes,
  gradoNombre,
  porcentaje,
  monto,
  onPorcentaje,
  onMonto,
  errorPorcentaje,
  errorMonto,
}: CamposSolicitudProps) {
  const paquete = paquetes.find((p) => p.porcentaje === porcentaje) ?? paquetes[0];
  const montoMinimo = Math.min(MONTO_MINIMO, paquete.capacidad_maxima);
  // Solo para dibujar el relleno verde debajo del slider (pieza 3d).
  const rangoMonto = paquete.capacidad_maxima - montoMinimo;
  const porcentajeMonto = rangoMonto > 0 ? ((monto - montoMinimo) / rangoMonto) * 100 : 100;

  return (
    <>
      {/* Cupo del grado a la vista antes de elegir (3t). */}
      <div className="flex flex-col gap-0.5 rounded-16 bg-ga-verde-tint p-4">
        <span className="text-14 font-bold text-ga-verde-oscuro">Tu cupo · {gradoNombre}</span>
        <span className="text-15 text-ga-texto">
          {paquetes.map((p, i) => (
            <span key={p.porcentaje}>
              {i === 0 ? "Hasta " : " o "}
              <strong>{formatoCOP(p.capacidad_maxima)}</strong> al {p.porcentaje} %
            </span>
          ))}
        </span>
      </div>

      <fieldset
        className="m-0 flex flex-col gap-1.5 border-0 p-0"
        aria-describedby={errorPorcentaje ? "porcentaje-error" : undefined}
      >
        <legend className="mb-1.5 p-0 text-15 font-bold">¿Qué porcentaje de tu cupo quieres?</legend>
        <div className="grid grid-cols-2 gap-3">
          {paquetes.map((p) => (
            <label key={p.porcentaje} className="cursor-pointer">
              <input
                type="radio"
                name="porcentaje"
                value={p.porcentaje}
                checked={porcentaje === p.porcentaje}
                onChange={() => onPorcentaje(p)}
                // aria-invalid no aplica a radios: el error se enlaza desde el fieldset.
                aria-describedby={errorPorcentaje ? "porcentaje-error" : undefined}
                className="peer sr-only"
              />
              <span className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-12 border-1.5 border-ga-borde bg-white px-3 py-2 text-center text-16 font-extrabold leading-tight text-ga-texto transition-colors peer-checked:border-ga-verde peer-checked:bg-ga-verde-tint peer-checked:text-ga-verde peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ga-verde">
                <span>{p.porcentaje} %</span>
                <span className="text-13 font-semibold text-ga-texto-3">
                  Hasta {formatoCOP(p.capacidad_maxima)}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errorPorcentaje ? (
          <span id="porcentaje-error" className="text-14 font-semibold text-ga-error">
            {errorPorcentaje}
          </span>
        ) : null}
      </fieldset>

      {porcentaje === "" ? (
        <p className="m-0 text-14 text-ga-texto-3">Elige un porcentaje para escoger el monto.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="monto" className="text-15 font-bold">
              Monto a desembolsar
            </label>
            <output htmlFor="monto" className="font-display text-26 font-extrabold tracking-cifra text-ga-navy">
              {formatoCOP(monto)}
            </output>
          </div>
          {/* Pista + relleno verde: solo dibujo; encima va el <input type="range"> real
              con su pista nativa oculta por .ga-deslizador (app/globals.css). */}
          <div className="relative flex h-11 items-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-2.5 overflow-hidden rounded-full bg-ga-verde-claro"
            >
              <div className="h-full rounded-full bg-ga-verde" style={{ width: `${porcentajeMonto}%` }} />
            </div>
            <input
              id="monto"
              name="monto"
              type="range"
              min={montoMinimo}
              max={paquete.capacidad_maxima}
              step={PASO_MONTO}
              value={monto}
              onChange={(e) => onMonto(Number(e.target.value))}
              aria-valuetext={formatoCOP(monto)}
              aria-invalid={errorMonto ? true : undefined}
              aria-describedby={["monto-ayuda", errorMonto ? "monto-error" : null].filter(Boolean).join(" ")}
              // h-11: área de toque de al menos 44 px de alto (el track visual sigue delgado).
              className="ga-deslizador relative h-11 w-full"
            />
          </div>
          <div id="monto-ayuda" className="flex justify-between text-13 text-ga-texto-3">
            <span>Mínimo {formatoCOP(montoMinimo)}</span>
            <span>Tope {formatoCOP(paquete.capacidad_maxima)}</span>
          </div>
          {errorMonto ? (
            <span id="monto-error" className="text-14 font-semibold text-ga-error">
              {errorMonto}
            </span>
          ) : null}
        </div>
      )}

      {/* Mismos cuadros grises que «Mis datos» en /cuenta. Sin tasa (25-sep); la cuota no se calcula. */}
      {porcentaje !== "" ? (
        <dl className="m-0 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
            <dt className="text-14 text-ga-texto-3">Plazo</dt>
            <dd className="m-0 text-16 font-bold text-ga-texto">{paquete.plazo_meses} meses</dd>
          </div>
        </dl>
      ) : null}
    </>
  );
}
