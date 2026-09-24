"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

type Props = { anio: number; mes: number; anios: number[] };

/** Selector de año y mes de /admin/sorteo: cambia la URL (?anio=&mes=) al elegir. */
export function SelectorMes({ anio, mes, anios }: Props) {
  const router = useRouter();

  function irA(nuevoAnio: number, nuevoMes: number) {
    router.push(`/admin/sorteo?anio=${nuevoAnio}&mes=${nuevoMes}`);
  }

  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor="sorteo-mes">Mes</label>
      <Select id="sorteo-mes" value={mes} onChange={(e) => irA(anio, Number(e.target.value))} className="w-auto">
        {MESES.map((nombreMes, indice) => (
          <option key={nombreMes} value={indice + 1}>
            {nombreMes}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="sorteo-anio">Año</label>
      <Select id="sorteo-anio" value={anio} onChange={(e) => irA(Number(e.target.value), mes)} className="w-auto">
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </Select>
    </div>
  );
}
