"use client";

import { useActionState, useRef } from "react";
import { alternarAtiendeAsociados, type EstadoAtiendeAsociados } from "@/app/admin/asesores/actions";

const INICIAL: EstadoAtiendeAsociados = {};

/**
 * Interruptor «Atiende asociados» (pieza 3m): píldora 44×24, verde encendido / gris apagado,
 * la perilla se desliza con transform. Solo para administradores (un asesor siempre atiende).
 */
export function InterruptorAtiende({ perfilId, nombre, atiende }: { perfilId: string; nombre: string; atiende: boolean }) {
  const [estado, despachar, pendiente] = useActionState(alternarAtiendeAsociados, INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={despachar} className="flex flex-col items-start gap-1 sm:items-end">
      <input type="hidden" name="perfilId" value={perfilId} />
      <input type="hidden" name="atiende" value={String(!atiende)} />
      <div className="flex items-center gap-2.5">
        <span id={`atiende-${perfilId}`} className={"text-13 font-bold " + (atiende ? "text-admin-texto-2" : "text-admin-texto-3")}>
          Atiende asociados
        </span>
        <button
          type="submit"
          role="switch"
          aria-checked={atiende}
          aria-labelledby={`atiende-${perfilId}`}
          aria-label={`Atiende asociados: ${nombre}`}
          disabled={pendiente}
          className={
            // Área pulsable de 44×44 (regla de accesibilidad); la píldora visible sigue siendo 44×24.
            "flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-verde disabled:opacity-70"
          }
        >
          <span
            aria-hidden="true"
            className={
              "flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-150 " +
              (atiende ? "bg-admin-verde" : "bg-admin-borde")
            }
          >
            <span
              className={
                "h-5 w-5 rounded-full transition-transform duration-150 " +
                (atiende ? "translate-x-5 bg-admin-fondo" : "translate-x-0 bg-admin-texto-3")
              }
            />
          </span>
        </button>
      </div>
      <p role="status" aria-live="polite" className={"m-0 text-12 " + (estado.error ? "font-semibold text-admin-rojo-2" : "text-admin-verde-2")}>
        {estado.error ?? estado.mensaje}
      </p>
    </form>
  );
}
