"use client";

import { useActionState } from "react";
import { marcarAlertaAtendida, type EstadoMarcarAlerta } from "@/app/admin/alertas/actions";
import type { FilaAlertaAdmin } from "@/lib/admin/alertas";
import { IconoWhatsapp } from "@/components/ui/Iconos";
import { BotonAdmin } from "./CamposAdmin";

const INICIAL: EstadoMarcarAlerta = {};

/** Fila de la bandeja de alertas (pieza 3m): tipo, quién y cuándo, «Marcar atendida». */
export function FilaAlerta({ alerta }: { alerta: FilaAlertaAdmin }) {
  const [estado, despachar] = useActionState(marcarAlertaAtendida, INICIAL);
  const pendiente = alerta.estado === "pendiente";
  return (
    <div
      className={
        "flex flex-col gap-3 border-b border-admin-borde-sutil px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between " +
        (pendiente ? "" : "opacity-60")
      }
    >
      <div className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-15 font-extrabold text-white">
          {alerta.asociado.nombre}
          <span
            className={
              "rounded-full px-2.5 py-0.5 text-12 font-extrabold " +
              (alerta.tipo === "retiro_anticipado"
                ? "bg-admin-rojo-fondo text-admin-rojo-2"
                : "bg-admin-ambar-fondo text-admin-ambar")
            }
          >
            {alerta.tipoTexto}
          </span>
        </span>
        <span className="text-13 text-admin-texto-3">
          {pendiente
            ? `Avisó el ${alerta.creada}`
            : `Atendida por ${alerta.atendidaPor ?? "un administrador"} · ${alerta.atendida}`}
        </span>
        {estado.error ? (
          <span role="alert" className="text-13 font-semibold text-admin-rojo-2">
            {estado.error}
          </span>
        ) : null}
      </div>
      {pendiente ? (
        <form action={despachar} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="alertaId" value={alerta.id} />
          {alerta.asociado.whatsappUrl ? (
            <a
              href={alerta.asociado.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11.5 items-center gap-2 rounded-full px-4 text-14 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
            >
              <IconoWhatsapp tamano={17} />
              Escribir por WhatsApp
            </a>
          ) : null}
          <BotonAdmin textoCargando="Marcando…">Marcar atendida</BotonAdmin>
        </form>
      ) : (
        <span className="text-13 font-bold text-admin-verde">✓ Atendida</span>
      )}
    </div>
  );
}
