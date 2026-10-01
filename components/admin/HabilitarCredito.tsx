"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { habilitarCredito, type EstadoHabilitarCredito } from "@/app/admin/asociados/actions";
import { Modal } from "@/components/ui/Modal";
import { BotonEnviar } from "./BotonEnviar";

const INICIAL: EstadoHabilitarCredito = {};
const CLASE_AREA =
  "min-h-24 w-full resize-none rounded-12 bg-ga-fondo-suave p-3 text-16 leading-140 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";

type Props = {
  asociadoId: string;
  nombre: string;
  /** RS-01: el admin no habilita su propio crédito ni el de sus clientes. */
  bloqueado?: boolean;
  onResuelto: (mensaje: string) => void;
};

/**
 * «Habilitar crédito» (§13.2): solo se monta cuando la última solicitud del
 * asociado está rechazada y sin habilitar. Mismo modal y campos que
 * «Dar de baja»: motivo obligatorio (5 a 300), foco al campo con error.
 * El motivo es una nota interna: el asociado nunca lo ve.
 */
export function HabilitarCredito({ asociadoId, nombre, bloqueado = false, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(habilitarCredito, INICIAL);
  const [motivo, setMotivo] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (estado.mensaje) onResuelto(estado.mensaje);
  }, [estado.mensaje, onResuelto]);

  const error = estado.errores?.motivo ?? estado.error;
  useEffect(() => {
    if (error) areaRef.current?.focus();
  }, [error]);

  const tituloId = `habilitar-titulo-${asociadoId}`;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-14 leading-145 text-admin-texto-2">
        Su última solicitud fue rechazada. Al habilitarlo podrá hacer una nueva solicitud.
      </p>
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => setAbierto(true)}
        className="flex h-11.5 items-center justify-center self-start rounded-full bg-admin-verde px-6 text-14 font-extrabold text-admin-fondo disabled:opacity-60"
      >
        Habilitar nuevo crédito
      </button>

      <Modal abierto={abierto && !estado.mensaje} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
        <form action={accion} noValidate className="flex flex-col gap-4 text-ga-texto">
          <input type="hidden" name="asociadoId" value={asociadoId} />
          <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
            ¿Habilitar el crédito de {nombre}?
          </h2>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            Podrá hacer una nueva solicitud. El motivo queda en el historial y el asociado no lo ve.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${tituloId}-motivo`} className="text-14 font-bold">
              Motivo <span className="font-medium text-ga-texto-3">(obligatorio · 5 a 300 caracteres)</span>
            </label>
            <textarea
              ref={areaRef}
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
            <BotonEnviar textoCargando="Guardando…">Habilitar crédito</BotonEnviar>
          </div>
        </form>
      </Modal>
    </div>
  );
}
