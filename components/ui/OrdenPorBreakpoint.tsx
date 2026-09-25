"use client";

import { Fragment, useSyncExternalStore, type ReactNode } from "react";

/** Breakpoint `lg` de Tailwind (1024 px): a partir de aquí se aplica la versión PC. */
const CONSULTA_ESCRITORIO = "(min-width: 1024px)";

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA_ESCRITORIO);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

const esEscritorio = () => window.matchMedia(CONSULTA_ESCRITORIO).matches;
// En el servidor (y durante la hidratación) se usa el orden de celular (mobile-first).
const enServidor = () => false;

export type ItemOrdenable = { id: string; contenido: ReactNode };

type OrdenPorBreakpointProps = {
  /** Elementos en el orden de celular. */
  items: ItemOrdenable[];
  /** Ids en el orden de escritorio (deben ser los mismos de `items`). */
  ordenEscritorio: string[];
};

/**
 * Renderiza los mismos elementos en un orden de DOM distinto según el breakpoint,
 * para que el orden de tabulación coincida con el visual en celular y en escritorio.
 *
 * - Cada elemento existe UNA sola vez: no se duplican `id` ni `name` en el formulario.
 * - Los elementos llevan `key`, así que React los MUEVE (no los vuelve a montar):
 *   lo escrito en un campo se conserva si cambia el ancho de la ventana.
 * - Sin JavaScript (o antes de hidratar) queda el orden de celular; la ubicación
 *   visual en escritorio la sigue dando el CSS de la grilla, así que no hay salto.
 */
export function OrdenPorBreakpoint({ items, ordenEscritorio }: OrdenPorBreakpointProps) {
  const escritorio = useSyncExternalStore(suscribir, esEscritorio, enServidor);

  const ordenados = escritorio
    ? ordenEscritorio
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is ItemOrdenable => Boolean(item))
    : items;

  return (
    <>
      {ordenados.map((item) => (
        <Fragment key={item.id}>{item.contenido}</Fragment>
      ))}
    </>
  );
}
