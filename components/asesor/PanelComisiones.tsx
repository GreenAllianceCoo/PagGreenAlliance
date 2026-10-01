"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { EstadoAcumulado } from "@/app/asesor/actions";
import { cx } from "@/components/ui/cx";
import { MASCARA_ACUMULADO, type AvanceMeta, type VistaComisiones } from "@/lib/asesor/comisiones";

type PanelComisionesProps = {
  /** null = no se pudieron cargar (ya quedó registrado en el servidor). */
  comisiones: VistaComisiones | null;
  /** `revelarAcumulado` (app/asesor/actions.ts): cada revelación suma 1 al contador interno. */
  revelar: () => Promise<EstadoAcumulado>;
  hrefSimulador: string;
};

function TarjetaKpi({
  titulo,
  cantidad,
  unitario,
  valor,
  nota,
}: {
  titulo: string;
  cantidad: number;
  unitario: string;
  valor: string;
  nota: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-20 bg-white px-4.5 py-4 lg:gap-2 lg:rounded-26 lg:px-6 lg:py-5.5">
      <span className="text-13 text-ga-texto-3 lg:text-14">{titulo}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-32 font-extrabold leading-none text-ga-navy lg:text-[52px]">{cantidad}</span>
        <span className="hidden text-15 text-ga-texto-3 lg:inline">× {unitario}</span>
        <span className="text-14 font-bold text-ga-verde lg:hidden">{valor}</span>
      </div>
      <span className="hidden text-15 font-bold text-ga-verde lg:block">{valor}</span>
      <span className="hidden text-12 text-ga-deshabilitado-texto lg:block">{nota}</span>
    </div>
  );
}

export function BarraBono({ titulo, avance }: { titulo: string; avance: AvanceMeta }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-3 text-14 font-bold">
        <span>{titulo}</span>
        <span className="text-ga-texto-3">
          {avance.actual} / {avance.meta} embargos
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={titulo}
        aria-valuemin={0}
        aria-valuemax={avance.meta}
        aria-valuenow={Math.min(avance.actual, avance.meta)}
        className="h-2.5 overflow-hidden rounded-full bg-ga-verde-claro"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-ga-verde transition-transform duration-500 ease-spring motion-safe:animate-ga-barra"
          style={{ transform: `scaleX(${avance.porcentaje / 100})` }}
        />
      </div>
    </div>
  );
}

/**
 * Pestaña «Comisiones» del asesor (pieza 3l, spec §5.4). Corte el 15 de cada mes.
 * «Acumulado ganado a la fecha» es un botón con la cifra oculta («•••••»): al tocarlo se
 * revela (y se cuenta en el servidor, sin que nadie lo vea en la app); tocar de nuevo la oculta.
 */
export function PanelComisiones({ comisiones, revelar, hrefSimulador }: PanelComisionesProps) {
  const [total, setTotal] = useState<string | null>(null);
  const [revelado, setRevelado] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [cargando, iniciar] = useTransition();

  function alternar() {
    if (revelado) {
      // Ocultar es local: solo revelar cuenta como «una revelación».
      setRevelado(false);
      return;
    }
    setError(undefined);
    iniciar(async () => {
      const resultado = await revelar();
      if (resultado.total) {
        setTotal(resultado.total);
        setRevelado(true);
      } else {
        setError(resultado.error ?? "No pudimos mostrar tu acumulado. Intenta de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
        <p className="m-0 text-14 text-ga-texto-2 lg:text-16">
          Corte el 15 de cada mes · periodo del 16 al 15
          {comisiones ? <span className="block text-ga-texto-3 lg:mt-1">{comisiones.periodoTexto}</span> : null}
        </p>
        <Link
          href={hrefSimulador}
          className="inline-flex h-13 items-center justify-center gap-2 rounded-full border-1.5 border-ga-verde bg-white px-5.5 text-14 font-extrabold text-ga-verde no-underline hover:bg-ga-verde-tint hover:text-ga-verde lg:text-15"
        >
          Simulador de crédito <span aria-hidden="true">↗</span>
        </Link>
      </div>

      {comisiones ? (
        <>
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-3 lg:gap-4">
            <TarjetaKpi
              titulo="Ingresos nuevos de este periodo"
              cantidad={comisiones.ingresosNuevos.cantidad}
              unitario={comisiones.ingresosNuevos.valorUnitario}
              valor={comisiones.ingresosNuevos.valor}
              nota="Asociados que llegaron a «Operando» en este periodo."
            />
            <TarjetaKpi
              titulo="Clientes operativos"
              cantidad={comisiones.clientesOperativos.cantidad}
              unitario={comisiones.clientesOperativos.valorUnitario}
              valor={comisiones.clientesOperativos.valor}
              nota="En «Operando» al corte del 15."
            />
            <button
              type="button"
              onClick={alternar}
              aria-pressed={revelado}
              disabled={cargando}
              className="flex cursor-pointer flex-col gap-1 rounded-20 bg-ga-navy px-4.5 py-4 text-left text-white transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde disabled:opacity-85 lg:gap-2 lg:rounded-26 lg:px-6 lg:py-5.5"
            >
              <span className="text-13 text-ga-navy-texto-suave lg:text-14">Acumulado ganado a la fecha</span>
              {/* aria-live: el lector de pantalla anuncia la cifra al revelarla. */}
              <span
                aria-live="polite"
                key={revelado ? "visible" : "oculto"}
                className={cx(
                  "font-display text-26 font-extrabold leading-none motion-safe:animate-ga-aparecer lg:text-40",
                  !revelado && "tracking-[0.06em]",
                )}
              >
                {revelado && total ? total : MASCARA_ACUMULADO}
              </span>
              <span className="text-13 text-ga-menta">
                {cargando ? "Mostrando…" : revelado ? "Toca para ocultar de nuevo" : "Toca para revelar"}
              </span>
            </button>
          </div>
          {error ? (
            <p role="alert" className="m-0 text-14 font-semibold text-ga-error">
              {error}
            </p>
          ) : null}

          {/* TODO(confirmar: Q-01) los bonos cuentan hoy los embargos operando ahora, no los históricos. */}
          <section aria-labelledby="bonos-titulo" className="flex flex-col gap-3.5 rounded-20 bg-white p-5 lg:rounded-26 lg:px-6 lg:py-6">
            <h2 id="bonos-titulo" className="m-0 text-14 font-extrabold uppercase tracking-[0.04em] text-ga-texto-3">
              Avance hacia los bonos <span className="font-medium normal-case text-ga-deshabilitado-texto">(opcional)</span>
            </h2>
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
              <BarraBono titulo="Bono de $1.000.000" avance={comisiones.bono50} />
              <BarraBono titulo="Viaje a San Andrés" avance={comisiones.viaje100} />
            </div>
          </section>
        </>
      ) : (
        <p className="m-0 rounded-16 bg-white p-5 text-15 text-ga-texto-2">
          No pudimos cargar tus comisiones. Intenta de nuevo en un momento.
        </p>
      )}
    </div>
  );
}
