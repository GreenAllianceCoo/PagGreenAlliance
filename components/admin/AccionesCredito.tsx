"use client";

import { useActionState, useState } from "react";
import { BotonEnviar } from "./BotonEnviar";
import { Textarea } from "@/components/ui/Textarea";
import { resolverCredito, type EstadoAccionCredito } from "@/app/admin/creditos/actions";

const VACIO: EstadoAccionCredito = {};

/** Botones «Aprobar» / «Rechazar» de una fila de /admin/creditos (motivo obligatorio al rechazar). */
export function AccionesCredito({ id }: { id: string }) {
  const [estado, accion] = useActionState(resolverCredito, VACIO);
  const [rechazando, setRechazando] = useState(false);

  if (estado.mensaje) {
    return <p className="m-0 text-14 font-semibold text-ga-texto-2">{estado.mensaje}</p>;
  }

  if (!rechazando) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <form action={accion}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="aprobado" />
            <BotonEnviar variante="primario" textoCargando="Aprobando…" className="h-10 px-5 text-15">
              Aprobar
            </BotonEnviar>
          </form>
          <button
            type="button"
            onClick={() => setRechazando(true)}
            className="flex h-10 items-center rounded-12 border-1.5 border-ga-error px-5 text-15 font-extrabold text-ga-error hover:bg-red-50"
          >
            Rechazar
          </button>
        </div>
        {estado.error ? <p className="m-0 text-14 font-semibold text-ga-error">{estado.error}</p> : null}
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value="rechazado" />
      <label htmlFor={`motivo-${id}`} className="text-14 font-bold">
        Motivo del rechazo
      </label>
      <Textarea id={`motivo-${id}`} name="motivo" rows={2} aria-invalid={estado.error ? true : undefined} required />
      {estado.error ? <p className="m-0 text-14 font-semibold text-ga-error">{estado.error}</p> : null}
      <div className="flex gap-2">
        <BotonEnviar variante="secundario" textoCargando="Guardando…" className="h-10 border-ga-error px-5 text-15 text-ga-error">
          Confirmar rechazo
        </BotonEnviar>
        <button
          type="button"
          onClick={() => setRechazando(false)}
          className="flex h-10 items-center rounded-12 border-1.5 border-ga-borde px-5 text-15 font-bold text-ga-navy hover:bg-ga-fondo-suave"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
