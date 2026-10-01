"use client";

import { useActionState, useEffect, useState } from "react";
import { marcarDesembolsado, type EstadoAccionCredito } from "@/app/admin/creditos/actions";
import { formatearFechaLarga, hoyBogota } from "@/lib/fechas";
import { BotonAdmin, CampoAdmin, EntradaAdmin } from "./CamposAdmin";

const VACIO: EstadoAccionCredito = {};

type Props = {
  solicitudId: string;
  /** AAAA-MM-DD si ya se desembolsó; null = pendiente de desembolso. */
  fechaDesembolso: string | null;
  onResuelto: (mensaje: string) => void;
};

/**
 * «Marcar desembolsado» (pieza 3q, spec §12.2): fecha (por defecto hoy en hora de
 * Colombia, nunca futura) y confirmación en 2 pasos. Ya desembolsado: solo lectura.
 * Movimiento: solo opacity (motion-safe). Las reglas de fondo las valida el servidor.
 */
export function MarcarDesembolsado({ solicitudId, fechaDesembolso, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(marcarDesembolsado, VACIO);
  const hoy = hoyBogota();

  useEffect(() => {
    if (estado.mensaje) onResuelto(estado.mensaje);
  }, [estado.mensaje, onResuelto]);

  if (fechaDesembolso) {
    return (
      <p className="m-0 rounded-14 bg-admin-verde-fondo p-3.5 text-14 leading-145 text-admin-verde-claro">
        <strong className="text-admin-verde-2">Desembolsado</strong> el {formatearFechaLarga(fechaDesembolso.slice(0, 10))}. El
        conteo de 3 meses ya corre.
      </p>
    );
  }

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="m-0 rounded-14 bg-admin-ambar-fondo p-3.5 text-14 leading-145 text-admin-ambar">
          Aprobado · pendiente de desembolso. Los 3 meses empiezan a contar cuando lo marques.
        </p>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex h-12.5 items-center justify-center rounded-full bg-admin-verde text-16 font-extrabold text-admin-fondo"
        >
          Marcar desembolsado
        </button>
      </div>
    );
  }

  return (
    <form
      action={accion}
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] motion-safe:animate-ga-aparecer"
    >
      <input type="hidden" name="id" value={solicitudId} />
      <CampoAdmin id={`desembolso-fecha-${solicitudId}`} label="Fecha del desembolso" error={estado.error} ayuda="Por defecto, hoy. No puede ser una fecha futura.">
        {(c) => <EntradaAdmin {...c} name="fecha" type="date" required defaultValue={hoy} max={hoy} className="[color-scheme:dark]" />}
      </CampoAdmin>
      <div className="flex gap-2.5">
        <BotonAdmin textoCargando="Guardando…" className="h-11.5 flex-1">
          Confirmar desembolso
        </BotonAdmin>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
