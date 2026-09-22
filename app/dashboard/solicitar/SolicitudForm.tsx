"use client";

import { useActionState, useState } from "react";
import { crearSolicitud, type EstadoSolicitud } from "./actions";

type Paquete = {
  porcentaje: "50" | "100";
  capacidad_maxima: number;
  cuota_mensual: number;
  total_credito: number;
  plazo_meses: number;
};

const MONTO_MINIMO = 100000;
const PASO = 50000;

function formatCOP(valor: number) {
  return `$${Math.round(valor).toLocaleString("es-CO")}`;
}

const initialState: EstadoSolicitud = {};

export default function SolicitudForm({ paquetes }: { paquetes: Paquete[] }) {
  const [porcentaje, setPorcentaje] = useState<"50" | "100">(paquetes[0].porcentaje);
  const paquete = paquetes.find((p) => p.porcentaje === porcentaje) ?? paquetes[0];
  const [monto, setMonto] = useState(paquete.capacidad_maxima);
  const [state, formAction, pending] = useActionState(crearSolicitud, initialState);

  const montoMinimo = Math.min(MONTO_MINIMO, paquete.capacidad_maxima);

  function seleccionarPorcentaje(nuevo: Paquete) {
    setPorcentaje(nuevo.porcentaje);
    setMonto(nuevo.capacidad_maxima);
  }

  const proporcion = monto / paquete.capacidad_maxima;
  const cuotaEstimada = Math.round((proporcion * paquete.cuota_mensual) / 1000) * 1000;
  const totalEstimado = Math.round((proporcion * paquete.total_credito) / 1000) * 1000;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="porcentaje" value={porcentaje} />
      <input type="hidden" name="monto" value={monto} />

      <div className="grid grid-cols-2 gap-3">
        {paquetes.map((p) => (
          <button
            key={p.porcentaje}
            type="button"
            onClick={() => seleccionarPorcentaje(p)}
            className={`h-14 rounded-lg font-bold border-2 transition-colors ${
              porcentaje === p.porcentaje
                ? "bg-green text-white border-green"
                : "bg-white text-navy border-gray-300"
            }`}
          >
            {p.porcentaje}% de devolucion
          </button>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-baseline text-sm font-semibold text-gray-600 mb-2">
          <span>Monto a desembolsar</span>
          <span className="text-navy font-bold text-base">{formatCOP(monto)}</span>
        </div>
        <input
          type="range"
          min={montoMinimo}
          max={paquete.capacidad_maxima}
          step={PASO}
          value={monto}
          onChange={(e) => setMonto(Number(e.target.value))}
          className="w-full accent-green"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatCOP(montoMinimo)}</span>
          <span>{formatCOP(paquete.capacidad_maxima)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-muted rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold">Cuota mensual estimada</p>
          <p className="text-lg font-bold">{formatCOP(cuotaEstimada)}</p>
        </div>
        <div className="bg-surface-muted rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold">Total estimado a pagar</p>
          <p className="text-lg font-bold">{formatCOP(totalEstimado)}</p>
        </div>
        <div className="col-span-2 bg-surface-muted rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold">Plazo</p>
          <p className="text-lg font-bold">{paquete.plazo_meses} meses</p>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-14 bg-green text-white rounded-lg font-bold disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
