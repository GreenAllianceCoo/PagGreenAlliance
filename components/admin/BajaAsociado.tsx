"use client";

import { useActionState, useEffect, useState } from "react";
import { cambiarEstadoAsociado, type EstadoCambiarEstadoAsociado } from "@/app/admin/asociados/actions";
import { Modal } from "@/components/ui/Modal";
import { BotonEnviar } from "./BotonEnviar";

const INICIAL: EstadoCambiarEstadoAsociado = {};
const CLASE_AREA =
  "min-h-24 w-full resize-none rounded-12 bg-ga-fondo-suave p-3 text-16 leading-140 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";

type Props = {
  asociadoId: string;
  nombre: string;
  activo: boolean;
  /** RS-01: el admin no cambia su propio estado ni el de sus clientes. */
  bloqueado?: boolean;
  /** H-07: el perfil es admin; no se puede desactivar desde aquí. */
  esAdmin?: boolean;
  onResuelto: (mensaje: string) => void;
};

/**
 * «Dar de baja» / «Reactivar» (pieza 3q, spec §12.6): modal con motivo obligatorio
 * (5 a 300 caracteres; lo valida el servidor). El modal atrapa el foco y cierra con Esc.
 * Movimiento: el del Modal compartido (transform/opacity, con reduced-motion).
 */
export function BajaAsociado({ asociadoId, nombre, activo, bloqueado = false, esAdmin = false, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(cambiarEstadoAsociado, INICIAL);
  const [motivo, setMotivo] = useState("");
  const darDeBaja = activo;

  useEffect(() => {
    if (estado.mensaje) {
      onResuelto(estado.mensaje);
    }
  }, [estado.mensaje, onResuelto]);

  const tituloId = `baja-titulo-${asociadoId}`;
  const error = estado.errores?.motivo ?? estado.error;

  // H-07: no se puede desactivar a un admin desde la app
  if (esAdmin && darDeBaja) {
    return (
      <div className="flex flex-col gap-2.5">
        <p role="status" className="m-0 text-14 font-semibold text-admin-texto-2">
          No se puede desactivar a un administrador desde la app. Contacta al equipo técnico si es necesario.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {activo ? null : (
        <p role="status" className="m-0 rounded-14 bg-admin-rojo-fondo p-3.5 text-14 leading-145 text-admin-rojo-claro">
          <strong className="text-admin-rojo-2">Inactivo.</strong> No puede entrar a su cuenta ni pedir crédito.
        </p>
      )}
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => setAbierto(true)}
        className={
          "flex h-11.5 items-center justify-center self-start rounded-full px-6 text-14 font-extrabold disabled:opacity-60 " +
          (darDeBaja
            ? "text-admin-rojo shadow-[inset_0_0_0_1px_var(--ga-admin-rojo)]"
            : "bg-admin-verde text-admin-fondo")
        }
      >
        {darDeBaja ? "Dar de baja" : "Reactivar"}
      </button>

      <Modal abierto={abierto && !estado.mensaje} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
        <form action={accion} noValidate className="flex flex-col gap-4 text-ga-texto">
          <input type="hidden" name="asociadoId" value={asociadoId} />
          <input type="hidden" name="activo" value={darDeBaja ? "false" : "true"} />
          <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
            {darDeBaja ? `¿Dar de baja a ${nombre}?` : `¿Reactivar a ${nombre}?`}
          </h2>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            {darDeBaja
              ? "Perderá el acceso a su cuenta y no podrá pedir crédito. Puedes reactivarla después."
              : "Recuperará el acceso a su cuenta."}{" "}
            El motivo queda en el historial.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${tituloId}-motivo`} className="text-14 font-bold">
              Motivo <span className="font-medium text-ga-texto-3">(obligatorio · 5 a 300 caracteres)</span>
            </label>
            <textarea
              id={`${tituloId}-motivo`}
              name="motivo"
              rows={3}
              required
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${tituloId}-error` : undefined}
              className={CLASE_AREA}
            />
            {error ? (
              <span id={`${tituloId}-error`} role="alert" className="text-13 font-semibold text-ga-error">
                {error}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
            >
              Cancelar
            </button>
            <BotonEnviar textoCargando="Guardando…">
              {darDeBaja ? "Dar de baja" : "Reactivar"}
            </BotonEnviar>
          </div>
        </form>
      </Modal>
    </div>
  );
}

