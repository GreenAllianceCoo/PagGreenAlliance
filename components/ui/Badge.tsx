import type { ReactNode } from "react";
import { cx } from "./cx";

type BadgeProps = {
  children: ReactNode;
  /** `sm` = 13 px (tarjetas); `md` = 13 px en celular y 14 px en escritorio (/cuenta). */
  tamano?: "sm" | "md";
};

/** Etiqueta de estado «En revisión» (ámbar). */
export function Badge({ children, tamano = "sm" }: BadgeProps) {
  return (
    <span
      className={cx(
        "rounded-full bg-ga-ambar-fondo px-2.5 py-1 text-13 font-bold text-ga-ambar-texto",
        tamano === "md" && "lg:px-3 lg:py-[5px] lg:text-14",
      )}
    >
      {children}
    </span>
  );
}
