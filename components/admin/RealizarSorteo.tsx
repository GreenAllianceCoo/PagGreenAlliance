"use client";

import { useActionState, useState } from "react";
import { realizarSorteo, type EstadoRealizarSorteo } from "@/app/admin/sorteo/actions";
import { BotonEnviar } from "./BotonEnviar";

const INICIAL: EstadoRealizarSorteo = {};

type Props = {
  /** Mes del listado, AAAA-MM. */
  mes: string;
  mesTexto: string;
  /** Ya existe el sorteo de ese mes en `sorteos_mensuales`. */
  yaRealizado: boolean;
  /** Hay al menos una boleta confirmada (sin participantes no hay sorteo). */
  hayParticipantes: boolean;
};

/**
 * «Realizar sorteo» (pieza 3q, spec §12.10): tres estados: sin realizar, confirmación
 * y «Ya se realizó este mes» (botón apagado). El azar y la regla «una vez por mes»
 * viven en la RPC; aquí solo se pide confirmación. Sin animaciones propias.
 */
export function RealizarSorteo({ mes, mesTexto, yaRealizado, hayParticipantes }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion] = useActionState(realizarSorteo, INICIAL);
  const hecho = yaRealizado || Boolean(estado.ganador);

  if (hecho) {
    return (
      <section aria-label="Sorteo del mes" className="flex flex-col gap-2 rounded-16 bg-admin-superficie p-4">
        <button
          type="button"
          disabled
          className="flex h-11.5 items-center justify-center self-start rounded-full bg-admin-superficie-2 px-6 text-14 font-extrabold text-admin-texto-3 opacity-70"
        >
          Realizar sorteo
        </button>
        <p role="status" className="m-0 text-14 font-semibold text-admin-verde">
          Ya se realizó este mes
          {estado.ganador ? `: ganó ${estado.ganador.grado} ${estado.ganador.nombre}.` : "."}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Sorteo del mes" className="flex flex-col gap-3 rounded-16 bg-admin-superficie p-4">
      {confirmando ? (
        <form action={accion} className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]">
          <input type="hidden" name="mes" value={mes} />
          <p className="m-0 text-15 leading-150">
            ¿Realizar el sorteo de <strong>{mesTexto}</strong>? Se elige una boleta al azar y no se puede repetir ni deshacer.
          </p>
          <div className="flex gap-2.5">
            <BotonEnviar textoCargando="Sorteando…" className="flex-1">
              Sí, realizar sorteo
            </BotonEnviar>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={!hayParticipantes}
          onClick={() => setConfirmando(true)}
          className="flex h-11.5 items-center justify-center self-start rounded-full bg-admin-verde px-6 text-14 font-extrabold text-admin-fondo disabled:opacity-50"
        >
          Realizar sorteo
        </button>
      )}
      {!hayParticipantes && !confirmando ? (
        <p className="m-0 text-13 text-admin-texto-3">No hay boletas confirmadas para sortear.</p>
      ) : null}
      {estado.error ? (
        <p role="alert" className="m-0 text-14 font-semibold text-admin-rojo-2">
          {estado.error}
        </p>
      ) : null}
    </section>
  );
}
