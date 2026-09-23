import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Lista 1-2-3 con círculos numerados (aside de afiliación y «Qué sigue»).
 * Los primeros pasos van en navy y el último en verde, como en el diseño.
 */
export function ListaNumerada({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ol
      className={cx(
        "m-0 flex list-none flex-col gap-3 p-0 text-15 leading-145 text-ga-texto-2",
        className,
      )}
    >
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className={cx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-13 font-extrabold text-white",
              i === items.length - 1 ? "bg-ga-verde" : "bg-ga-navy",
            )}
          >
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
