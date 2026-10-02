"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/ui/cx";

const BASE =
  "h-12 w-full min-w-0 rounded-12 bg-admin-fondo px-3.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]";

export const CLASE_CONTROL_ADMIN = BASE;

/** Campo del admin oscuro (label + control + ayuda + error), mismo estilo de FormularioAsesor. */
export function CampoAdmin({
  id,
  label,
  error,
  ayuda,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  ayuda?: string;
  children: (p: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const desc = [ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-13 font-bold uppercase tracking-[0.04em] text-admin-texto-3">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": desc })}
      {ayuda ? (
        <span id={`${id}-ayuda`} className="text-13 text-admin-texto-3">
          {ayuda}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-13 font-semibold text-admin-rojo-2">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function EntradaAdmin(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(BASE, props.className)} />;
}

export function SelectAdmin({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(BASE, props.className)}>
      {children}
    </select>
  );
}

/** Botón de envío del admin; cede al texto de carga sin cambiar de tamaño. */
export function BotonAdmin({
  children,
  textoCargando,
  variante = "verde",
  className,
  deshabilitado = false,
  cargando = false,
}: {
  children: ReactNode;
  textoCargando: string;
  variante?: "verde" | "borde" | "rojo";
  className?: string;
  /** Prop mínima (RS-01): botón inactivo sin cambiar su aspecto (usa el mismo estilo de «enviando»). */
  deshabilitado?: boolean;
  /** Prop mínima (comprobante): carga manual cuando el envío no es un `action` (hay una subida a Storage antes). */
  cargando?: boolean;
}) {
  const { pending: enviando } = useFormStatus();
  const pending = enviando || cargando;
  return (
    <button
      type="submit"
      disabled={pending || deshabilitado}
      aria-busy={pending || undefined}
      className={cx(
        "flex h-11.5 items-center justify-center rounded-full px-6 text-14 font-extrabold transition-colors duration-200 disabled:opacity-85",
        variante === "verde" && "bg-admin-verde text-admin-fondo",
        variante === "borde" && "text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]",
        variante === "rojo" && "text-admin-rojo shadow-[inset_0_0_0_1px_var(--ga-admin-rojo)] hover:bg-admin-rojo-fondo",
        className,
      )}
    >
      {pending ? textoCargando : children}
    </button>
  );
}
