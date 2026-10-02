"use client";

import { useState } from "react";
import { urlComprobanteAdmin } from "@/app/admin/creditos/actions";

export type ComprobantePorBorrar = {
  solicitudId: string;
  /** Fecha del borrado programado, ya formateada «DD/MM/AAAA». */
  borrarEl: string;
};

/**
 * Ficha de un asociado ELIMINADO: sus comprobantes de desembolso se guardan 30 días
 * y solo el admin los abre («Ver» = URL firmada de 3 minutos). Luego los borra la
 * tarea programada.
 */
export function ComprobantesPorBorrar({ comprobantes }: { comprobantes: ComprobantePorBorrar[] }) {
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ver(solicitudId: string) {
    setAbriendo(solicitudId);
    setError(null);
    const pestana = window.open("", "_blank");
    if (pestana) pestana.opener = null;
    const r = await urlComprobanteAdmin({ solicitudId });
    setAbriendo(null);
    if (!r.url) {
      pestana?.close();
      setError(r.error ?? "No pudimos abrir el comprobante.");
      return;
    }
    if (pestana) pestana.location.href = r.url;
    else window.location.assign(r.url);
  }

  return (
    <section
      aria-labelledby="titulo-comprobantes-por-borrar"
      data-testid="comprobantes-por-borrar"
      className="flex max-w-[640px] flex-col gap-3 rounded-20 bg-admin-superficie p-5.5"
    >
      <h2 id="titulo-comprobantes-por-borrar" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
        Comprobantes de desembolso
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {comprobantes.map((c) => (
          <li key={c.solicitudId} className="flex items-center justify-between gap-3">
            <span className="text-14 text-admin-texto-2">Comprobantes que se borrarán el {c.borrarEl}</span>
            <button
              type="button"
              onClick={() => ver(c.solicitudId)}
              disabled={abriendo !== null}
              aria-busy={abriendo === c.solicitudId || undefined}
              className="flex h-11 items-center rounded-full px-4.5 text-14 font-bold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
            >
              {abriendo === c.solicitudId ? "Abriendo…" : "Ver"}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="m-0 text-13 text-admin-rojo">
          {error}
        </p>
      ) : null}
    </section>
  );
}
