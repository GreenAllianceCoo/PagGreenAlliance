"use client";

import { useActionState, useState } from "react";
import { retirarPublicacion, type EstadoRetirar } from "@/app/convenio/actions";
import { Button } from "@/components/ui/Button";

const VACIO: EstadoRetirar = {};

/** «Retirar» con confirmación: borra la publicación y sus archivos. */
export function BotonRetirar({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion, pendiente] = useActionState(retirarPublicacion, VACIO);

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className="enlace self-start text-15 font-semibold text-ga-error-texto">
        Retirar publicación
      </button>
    );
  }
  return (
    <form action={accion} className="flex flex-col gap-3 rounded-20 bg-ga-error-fondo p-4" role="group" aria-label="Confirmar retiro">
      <input type="hidden" name="id" value={id} />
      <p className="m-0 text-15 text-ga-error-texto">
        Se borra de Beneficios junto con sus imágenes o su PDF. No se puede deshacer.
      </p>
      {estado.error ? (
        <p role="alert" className="m-0 text-14 font-semibold text-ga-error-texto">
          {estado.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button cargando={pendiente} textoCargando="Retirando…" className="px-7 !bg-ga-error">
          Sí, retirar
        </Button>
        <Button type="button" variante="terciario" onClick={() => setConfirmando(false)} disabled={pendiente} className="px-7">
          No, conservarla
        </Button>
      </div>
    </form>
  );
}
