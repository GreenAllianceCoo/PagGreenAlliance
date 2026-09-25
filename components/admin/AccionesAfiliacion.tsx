"use client";

import { useActionState } from "react";
import { BotonEnviar } from "./BotonEnviar";
import {
  aprobarAfiliacion,
  cambiarEstadoAfiliacion,
  type EstadoAccionAfiliacion,
} from "@/app/admin/afiliaciones/actions";

const VACIO: EstadoAccionAfiliacion = {};

type Props = { id: string; estado: string };

/** Botones «Contactado», «Aprobar» y «Rechazar» del detalle de una afiliación. */
export function AccionesAfiliacion({ id, estado }: Props) {
  const [estadoContactado, accionContactado] = useActionState(cambiarEstadoAfiliacion, VACIO);
  const [estadoRechazar, accionRechazar] = useActionState(cambiarEstadoAfiliacion, VACIO);
  const [estadoAprobar, accionAprobar] = useActionState(aprobarAfiliacion, VACIO);

  const resuelta = estado === "aprobada" || estado === "rechazada";
  const mensaje = estadoAprobar.mensaje || estadoContactado.mensaje || estadoRechazar.mensaje;
  const error = estadoAprobar.error || estadoContactado.error || estadoRechazar.error;

  if (resuelta) {
    return (
      <p className="m-0 rounded-12 bg-ga-fondo-suave p-4 text-15 text-ga-texto-2">
        Esta solicitud ya está <strong>{estado}</strong>. No hay más acciones disponibles.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {estado !== "contactado" && (
          <form action={accionContactado}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="estado" value="contactado" />
            <BotonEnviar variante="secundario" textoCargando="Guardando…" className="px-6">
              Marcar como contactado
            </BotonEnviar>
          </form>
        )}
        <form action={accionAprobar}>
          <input type="hidden" name="id" value={id} />
          <BotonEnviar variante="primario" textoCargando="Aprobando…" className="px-6">
            Aprobar (crea la cuenta)
          </BotonEnviar>
        </form>
        <form action={accionRechazar}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="rechazada" />
          <BotonEnviar variante="secundario" textoCargando="Guardando…" className="border-ga-error px-6 text-ga-error">
            Rechazar
          </BotonEnviar>
        </form>
      </div>
      <p role="status" aria-live="polite" className="m-0 text-14 font-semibold text-ga-texto-2">
        {error ? <span className="text-ga-error">{error}</span> : mensaje}
      </p>
    </div>
  );
}
