"use client";

import { useEffect, useRef, useTransition } from "react";
import { BarraBono } from "@/components/asesor/PanelComisiones";
import { cx } from "@/components/ui/cx";
import type { MetaPremio, VistaPremios } from "@/lib/asesor/premios";

type Props = {
  /** null = no se pudieron cargar (ya quedó registrado en el servidor). */
  premios: VistaPremios | null;
  /** `registrarClicPremios` (app/asesor/actions.ts): máx. 1 registro por minuto por asesor. */
  registrarClic: (meta?: MetaPremio) => Promise<void>;
};

/**
 * Sección «Premios» del asesor (presentación pág. 25): progreso hacia 50 y 100 asociados.
 * Solo gana el primer asesor en llegar a cada meta. Al abrir la sección y al tocar un premio se
 * registra un clic en segundo plano (no bloquea la pantalla).
 */
export function PremiosAsesor({ premios, registrarClic }: Props) {
  const [, iniciar] = useTransition();
  const yaAbierto = useRef(false);

  useEffect(() => {
    if (yaAbierto.current || !premios) return;
    yaAbierto.current = true;
    iniciar(() => {
      void registrarClic().catch(() => undefined);
    });
  }, [premios, registrarClic]);

  if (!premios) return null;

  return (
    <section aria-labelledby="premios-titulo" className="flex flex-col gap-3.5 rounded-20 bg-white p-5 lg:rounded-26 lg:px-6 lg:py-6">
      <h2 id="premios-titulo" className="m-0 text-14 font-extrabold uppercase tracking-[0.04em] text-ga-texto-3">
        Premios
      </h2>
      <p className="m-0 text-15 text-ga-texto-2">
        Llevas {premios.clientesAcumulados} {premios.clientesAcumulados === 1 ? "asociado" : "asociados"}. Cada premio es de una sola vez
        y lo gana el primer asesor en llegar a la meta.
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:grid lg:grid-cols-2 lg:gap-5">
        {premios.premios.map((p) => (
          <li key={p.meta}>
            <button
              type="button"
              onClick={() => iniciar(() => void registrarClic(p.meta).catch(() => undefined))}
              className="flex min-h-11 w-full flex-col gap-2.5 rounded-16 bg-ga-fondo-suave p-4 text-left"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-16 font-extrabold text-ga-navy">{p.titulo}</span>
                <span
                  className={cx(
                    "shrink-0 rounded-full px-3 py-1 text-13 font-extrabold",
                    p.estado === "ganado_por_mi"
                      ? "bg-ga-verde-claro text-ga-verde-oscuro"
                      : p.estado === "ya_ganado"
                        ? "bg-white text-ga-texto-3"
                        : "bg-ga-ambar-fondo text-ga-ambar-texto",
                  )}
                >
                  {p.etiqueta}
                </span>
              </span>
              <span className="text-14 leading-150 text-ga-texto-2">{p.descripcion}</span>
              <BarraBono titulo={`Hacia ${p.meta} asociados`} avance={{ actual: p.actual, meta: p.meta, porcentaje: p.porcentaje, alcanzado: p.actual >= p.meta, faltan: p.faltan }} />
              {p.ganadoTexto ? <span className="text-14 font-bold text-ga-verde-oscuro">{p.ganadoTexto}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
