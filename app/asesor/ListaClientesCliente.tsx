"use client";

import { useMemo, useState } from "react";
import { cx } from "@/components/ui/cx";
import { ResumenClientes } from "@/components/asesor/ResumenClientes";
import { TablaClientes } from "@/components/asesor/TablaClientes";
import {
  CATEGORIAS_AFILIACION,
  contarPorCategoriaAfiliacion,
  etiquetaCategoriaAfiliacion,
  filtrarPorCategoriaYNombre,
  type CategoriaAfiliacion,
  type FilaResumenAsesor,
} from "@/lib/asesor/resumen";

type ListaClientesClienteProps = {
  filas: FilaResumenAsesor[];
};

/**
 * «Mis clientes» (pieza 2c): las tarjetas de resumen y los chips filtran por
 * categoría de afiliación; el buscador filtra por nombre. Todo en el cliente
 * porque `resumen_clientes_asesor()` ya trae la lista completa del asesor (no
 * hay paginación en el servidor para esta primera versión).
 */
export function ListaClientesCliente({ filas }: ListaClientesClienteProps) {
  const [categoria, setCategoria] = useState<CategoriaAfiliacion | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");

  const conteos = useMemo(() => contarPorCategoriaAfiliacion(filas), [filas]);
  const filtradas = useMemo(
    () => filtrarPorCategoriaYNombre(filas, { categoria, busqueda }),
    [filas, categoria, busqueda],
  );

  if (filas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-20 bg-white p-6 text-center">
        <p className="m-0 font-display text-18 font-extrabold text-ga-navy">Todavía no tienes clientes</p>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          Cuando refieras una afiliación o la cooperativa te asigne un asociado, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <ResumenClientes conteos={conteos} categoriaActiva={categoria} onCambiar={setCategoria} />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4">
        {/* Chips: en celular las tarjetas de arriba ya filtran; no se repite el control (DECISIONES de 2c). */}
        <div className="hidden flex-wrap gap-2 lg:flex" role="group" aria-label="Filtrar por afiliación">
          <ChipEstado
            activo={categoria === "todos"}
            etiqueta="Todos"
            cantidad={filas.length}
            onClick={() => setCategoria("todos")}
          />
          {CATEGORIAS_AFILIACION.map((c) => (
            <ChipEstado
              key={c}
              activo={categoria === c}
              etiqueta={etiquetaCategoriaAfiliacion(c)}
              cantidad={conteos[c]}
              onClick={() => setCategoria(c)}
            />
          ))}
        </div>

        <label className="flex flex-col gap-1.5 lg:w-[300px]">
          <span className="sr-only">Buscar por nombre</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre"
            aria-label="Buscar por nombre"
            className="h-12 w-full min-w-0 rounded-full border-1.5 border-ga-borde-input bg-white px-5 text-16 text-ga-texto placeholder:text-ga-texto-3 focus:border-ga-verde focus:outline-none focus:shadow-[0_0_0_3px_rgba(30,102,82,0.15)]"
          />
        </label>
      </div>

      {/* `key` cambia con el filtro/búsqueda: la lista vuelve a entrar con fundido + 8 px
          en vez de saltar (MOVIMIENTO de 2c; ver keyframe `ga-lista` en tailwind.config.ts). */}
      <section
        key={`${categoria}-${busqueda}`}
        className="motion-safe:animate-ga-lista lg:rounded-28 lg:bg-white lg:p-2 lg:pb-3"
      >
        <TablaClientes filas={filtradas} />
      </section>
    </div>
  );
}

function ChipEstado({
  activo,
  etiqueta,
  cantidad,
  onClick,
}: {
  activo: boolean;
  etiqueta: string;
  cantidad: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cx(
        "flex h-11 items-center gap-2 rounded-full px-4 text-15 font-bold transition-colors duration-200",
        activo ? "bg-ga-navy text-white" : "bg-white text-ga-navy",
      )}
    >
      {etiqueta}
      <span className="text-13 opacity-75">{cantidad}</span>
    </button>
  );
}
