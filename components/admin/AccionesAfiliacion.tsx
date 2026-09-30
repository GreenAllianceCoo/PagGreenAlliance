"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  aprobarAfiliacion,
  cambiarEstadoAfiliacion,
  type EstadoAccionAfiliacion,
} from "@/app/admin/afiliaciones/actions";

const VACIO: EstadoAccionAfiliacion = {};

type Props = {
  id: string;
  estado: string;
  nombre: string;
  /** Para mostrar el toast y refrescar la lista de hermanas (pieza 3e). */
  onResuelto: (mensaje: string) => void;
};

/**
 * Botones «Contactado», «Aprobar (crea la cuenta)» y «Rechazar» del detalle
 * de afiliación (pieza 3e), en 2 pasos como el de créditos (pieza 2d). A
 * diferencia de créditos, rechazar NO pide un motivo: `solicitudes_afiliacion`
 * no tiene esa columna todavía (ver TODO(backend) en el código de la Server
 * Action `cambiarEstadoAfiliacion`).
 */
export function AccionesAfiliacion({ id, estado, nombre, onResuelto }: Props) {
  const [estadoContactado, accionContactado] = useActionState(cambiarEstadoAfiliacion, VACIO);
  const [estadoRechazar, accionRechazar] = useActionState(cambiarEstadoAfiliacion, VACIO);
  const [estadoAprobar, accionAprobar] = useActionState(aprobarAfiliacion, VACIO);
  const [paso, setPaso] = useState<"idle" | "aprobar" | "rechazar">("idle");

  const mensaje = estadoAprobar.mensaje || estadoContactado.mensaje || estadoRechazar.mensaje;
  const error = estadoAprobar.error || estadoContactado.error || estadoRechazar.error;

  // Solo notifica al padre (toast): `onResuelto` llega por props, así que no
  // es un setState local (el paso de confirmación se cierra solo porque,
  // apenas la solicitud queda «aprobada»/«rechazada», el `if (resuelta)` de
  // abajo reemplaza toda esta vista por el aviso de solo lectura).
  useEffect(() => {
    if (mensaje) onResuelto(mensaje);
  }, [mensaje, onResuelto]);

  const resuelta = estado === "aprobada" || estado === "rechazada";
  if (resuelta) {
    return (
      <p className="m-0 rounded-14 bg-admin-superficie-2 p-3.5 text-14 text-admin-texto-2">
        Esta solicitud ya está <strong>{estado}</strong>. No hay más acciones disponibles.
      </p>
    );
  }

  if (paso === "aprobar") {
    return (
      <div className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]">
        <p className="m-0 text-15 leading-150">
          ¿Aprobar la solicitud de <strong>{nombre}</strong>? Esto crea su cuenta y le envía un correo.
        </p>
        <div className="flex gap-2.5">
          <form action={accionAprobar}>
            <input type="hidden" name="id" value={id} />
            <BotonAdmin variante="verde" textoCargando="Aprobando…">
              Sí, aprobar
            </BotonAdmin>
          </form>
          <button
            type="button"
            onClick={() => setPaso("idle")}
            className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
          >
            Cancelar
          </button>
        </div>
        {error ? <p className="m-0 text-13 font-semibold text-admin-rojo-2">{error}</p> : null}
      </div>
    );
  }

  if (paso === "rechazar") {
    return (
      <div className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]">
        <p className="m-0 text-15 leading-150">¿Rechazar la solicitud de <strong>{nombre}</strong>?</p>
        <div className="flex gap-2.5">
          <form action={accionRechazar}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="estado" value="rechazada" />
            <BotonAdmin variante="rojo" textoCargando="Guardando…">
              Sí, rechazar
            </BotonAdmin>
          </form>
          <button
            type="button"
            onClick={() => setPaso("idle")}
            className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
          >
            Cancelar
          </button>
        </div>
        {error ? <p className="m-0 text-13 font-semibold text-admin-rojo-2">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={() => setPaso("aprobar")}
        className="flex h-12 items-center justify-center rounded-full bg-admin-verde text-15 font-extrabold text-admin-fondo"
      >
        Aprobar (crea la cuenta)
      </button>
      <button
        type="button"
        onClick={() => setPaso("rechazar")}
        className="flex h-12 items-center justify-center rounded-full text-15 font-extrabold text-admin-rojo-2 shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]"
      >
        Rechazar
      </button>
      {estado !== "contactado" ? (
        <form action={accionContactado} className="col-span-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="estado" value="contactado" />
          <BotonContactado />
        </form>
      ) : null}
    </div>
  );
}

function BotonContactado() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center rounded-full text-14 font-bold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Marcar como contactado"}
    </button>
  );
}

function BotonAdmin({
  variante,
  textoCargando,
  children,
}: {
  variante: "verde" | "rojo";
  textoCargando: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const claseColor = variante === "verde" ? "bg-admin-verde text-admin-fondo" : "bg-admin-rojo text-admin-fondo";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`flex h-11.5 items-center justify-center gap-2 rounded-full px-5 text-15 font-extrabold disabled:opacity-85 ${claseColor}`}
    >
      {pending ? textoCargando : children}
    </button>
  );
}
