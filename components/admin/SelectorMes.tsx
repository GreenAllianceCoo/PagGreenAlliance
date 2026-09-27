"use client";

import { useRouter } from "next/navigation";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

type Props = { anio: number; mes: number; anios: number[] };

/** Selector de año y mes de /admin/sorteo (pieza 3g): cambia la URL (?anio=&mes=) al elegir. */
export function SelectorMes({ anio, mes, anios }: Props) {
  const router = useRouter();

  function irA(nuevoAnio: number, nuevoMes: number) {
    router.push(`/admin/sorteo?anio=${nuevoAnio}&mes=${nuevoMes}`);
  }

  const clasePildora =
    "h-11 rounded-12 bg-admin-superficie px-4 text-15 font-bold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none";

  return (
    <div className="flex gap-2.5">
      <label className="sr-only" htmlFor="sorteo-mes">Mes</label>
      <select id="sorteo-mes" value={mes} onChange={(e) => irA(anio, Number(e.target.value))} className={clasePildora}>
        {MESES.map((nombreMes, indice) => (
          <option key={nombreMes} value={indice + 1} className="text-admin-fondo">
            {nombreMes}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="sorteo-anio">Año</label>
      <select id="sorteo-anio" value={anio} onChange={(e) => irA(Number(e.target.value), mes)} className={clasePildora}>
        {anios.map((a) => (
          <option key={a} value={a} className="text-admin-fondo">
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
