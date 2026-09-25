import type { SelectHTMLAttributes } from "react";
import { cx } from "./cx";

/** Lista desplegable nativa (52 px / 17 px). */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-13 w-full min-w-0 rounded-12 border-1.5 border-ga-borde bg-white px-3 text-17 text-ga-texto",
        "aria-[invalid=true]:border-ga-error",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
