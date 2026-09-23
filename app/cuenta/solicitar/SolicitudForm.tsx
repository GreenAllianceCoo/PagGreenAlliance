"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { crearSolicitud, type EstadoSolicitud } from "./actions";
import { formatTasa, MONTO_MINIMO } from "@/lib/credito";

type Paquete = {
  porcentaje: "50" | "100";
  capacidad_maxima: number;
  tasa_interes_mensual: number;
  plazo_meses: number;
};

const PASO = 50000;

function formatCOP(valor: number) {
  return `$${Math.round(valor).toLocaleString("es-CO")}`;
}

const initialState: EstadoSolicitud = {};

/**
 * Formulario de solicitud de crédito: porcentaje de devolución (50 / 100),
 * monto (mínimo $100.000, máximo el tope del grado) y la tasa mensual del grado.
 * La acción vuelve a validar todo en el servidor.
 */
export default function SolicitudForm({ paquetes }: { paquetes: Paquete[] }) {
  const [porcentaje, setPorcentaje] = useState<"50" | "100">(paquetes[0].porcentaje);
  const paquete = paquetes.find((p) => p.porcentaje === porcentaje) ?? paquetes[0];
  const [monto, setMonto] = useState(paquete.capacidad_maxima);
  const [state, formAction, pending] = useActionState(crearSolicitud, initialState);
  const refErrorGeneral = useRef<HTMLParagraphElement>(null);

  const montoMinimo = Math.min(MONTO_MINIMO, paquete.capacidad_maxima);
  const errorPorcentaje = state.campo === "porcentaje" ? state.error : undefined;
  const errorMonto = state.campo === "monto" ? state.error : undefined;
  const errorGeneral = state.error && !state.campo ? state.error : undefined;

  // Foco al campo con error (o al mensaje general) después de cada respuesta.
  useEffect(() => {
    if (!state.error) return;
    if (state.campo === "porcentaje") {
      document.querySelector<HTMLInputElement>('input[name="porcentaje"]:checked, input[name="porcentaje"]')?.focus();
    } else if (state.campo === "monto") {
      document.getElementById("monto")?.focus();
    } else {
      refErrorGeneral.current?.focus();
    }
  }, [state]);

  function seleccionarPorcentaje(nuevo: Paquete) {
    setPorcentaje(nuevo.porcentaje);
    setMonto(nuevo.capacidad_maxima);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <fieldset
        className="m-0 flex flex-col gap-1.5 border-0 p-0"
        aria-describedby={errorPorcentaje ? "porcentaje-error" : undefined}
      >
        <legend className="mb-1.5 p-0 text-15 font-bold">Porcentaje de devolución</legend>
        <div className="grid grid-cols-2 gap-3">
          {paquetes.map((p) => (
            <label key={p.porcentaje} className="cursor-pointer">
              <input
                type="radio"
                name="porcentaje"
                value={p.porcentaje}
                checked={porcentaje === p.porcentaje}
                onChange={() => seleccionarPorcentaje(p)}
                // aria-invalid no aplica a radios: el error se enlaza desde el fieldset.
                aria-describedby={errorPorcentaje ? "porcentaje-error" : undefined}
                className="peer sr-only"
              />
              <span className="flex h-13.5 items-center justify-center rounded-12 border-1.5 border-ga-borde bg-white text-16 font-extrabold text-ga-texto transition-colors peer-checked:border-ga-verde peer-checked:bg-ga-verde-tint peer-checked:text-ga-verde peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ga-verde">
                {p.porcentaje}% de devolución
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="monto" className="text-15 font-bold">
            Monto a desembolsar
          </label>
          <output htmlFor="monto" className="text-24 font-extrabold text-ga-navy">
            {formatCOP(monto)}
          </output>
        </div>
        <input
          id="monto"
          name="monto"
          type="range"
          min={montoMinimo}
          max={paquete.capacidad_maxima}
          step={PASO}
          value={monto}
          onChange={(e) => setMonto(Number(e.target.value))}
          aria-valuetext={formatCOP(monto)}
          aria-invalid={errorMonto ? true : undefined}
          aria-describedby={["monto-ayuda", errorMonto ? "monto-error" : null].filter(Boolean).join(" ")}
          className="w-full accent-ga-verde"
        />
        <div id="monto-ayuda" className="flex justify-between text-13 text-ga-texto-3">
          <span>Mínimo {formatCOP(montoMinimo)}</span>
          <span>Tope {formatCOP(paquete.capacidad_maxima)}</span>
        </div>
        {errorMonto ? (
          <span id="monto-error" className="text-14 font-semibold text-ga-error">
            {errorMonto}
          </span>
        ) : null}
      </div>

      {/* Mismos cuadros grises que «Mis datos» en /cuenta. La cuota no se calcula. */}
      <dl className="m-0 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
          <dt className="text-14 text-ga-texto-3">Interés mensual</dt>
          <dd className="m-0 text-16 font-bold text-ga-texto">{formatTasa(paquete.tasa_interes_mensual)}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
          <dt className="text-14 text-ga-texto-3">Plazo</dt>
          <dd className="m-0 text-16 font-bold text-ga-texto">{paquete.plazo_meses} meses</dd>
        </div>
      </dl>

      {errorGeneral ? (
        <p
          ref={refErrorGeneral}
          tabIndex={-1}
          role="alert"
          className="m-0 text-14 font-semibold text-ga-error outline-none"
        >
          {errorGeneral}
        </p>
      ) : null}

      <Button cargando={pending} textoCargando="Enviando…" className="lg:self-start lg:px-9">
        Enviar solicitud
      </Button>
    </form>
  );
}
