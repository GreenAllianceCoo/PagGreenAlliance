"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TablaClientes } from "@/components/asesor/TablaClientes";
import { filtrarClientes, opcionesEstadoCliente, type FilaResumenAsesor } from "@/lib/asesor/resumen";

type ListaClientesClienteProps = {
  filas: FilaResumenAsesor[];
};

/**
 * «Mis clientes»: buscador (nombre o cédula) + filtro por estado. Todo en el
 * cliente porque `resumen_clientes_asesor()` ya trae la lista completa del
 * asesor (no hay paginación en el servidor para esta primera versión).
 */
export function ListaClientesCliente({ filas }: ListaClientesClienteProps) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");

  const opcionesEstado = useMemo(() => opcionesEstadoCliente(filas), [filas]);
  const filtradas = useMemo(
    () => filtrarClientes(filas, { busqueda, estado }),
    [filas, busqueda, estado],
  );

  if (filas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-14 bg-ga-fondo-suave p-6 text-center">
        <p className="m-0 text-16 font-bold text-ga-texto">Todavía no tienes clientes</p>
        <p className="m-0 text-14 leading-150 text-ga-texto-2">
          Cuando refieras una afiliación o la cooperativa te asigne un asociado, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex grow flex-col gap-1.5">
          <span className="sr-only">Buscar por nombre o cédula</span>
          <Input
            type="search"
            placeholder="Buscar por nombre o cédula"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar por nombre o cédula"
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:w-64">
          <span className="sr-only">Filtrar por estado</span>
          <Select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
            {opcionesEstado.map((op) => (
              <option key={op.clave} value={op.clave}>
                {op.etiqueta}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {filtradas.length === 0 ? (
        <p className="m-0 rounded-12 bg-ga-fondo-suave p-3.5 text-15 text-ga-texto-2">
          No encontramos clientes con esa búsqueda o ese estado.
        </p>
      ) : (
        <TablaClientes filas={filtradas} />
      )}
    </div>
  );
}
