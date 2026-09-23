import type { TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

/** Área de texto (16 px, sin redimensionar). */
export function Textarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cx(
        "w-full min-w-0 resize-none rounded-12 border-1.5 border-ga-borde bg-white px-3.5 py-3 text-16 text-ga-texto",
        "aria-[invalid=true]:border-ga-error",
        className,
      )}
      {...props}
    />
  );
}
