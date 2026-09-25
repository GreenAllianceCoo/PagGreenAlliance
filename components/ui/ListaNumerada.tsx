import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Lista 1-2-3 con círculos numerados en verde (aside de afiliación y «Qué sigue»).
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
          {/* Pieza 3c: los 3 círculos van en verde (antes el último era el único
              verde y los demás navy); así se ve en el aside y en «Qué sigue». */}
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ga-verde text-13 font-extrabold text-white"
          >
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
