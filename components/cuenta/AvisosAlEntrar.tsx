"use client";

import { useState, useTransition } from "react";
import { marcarAvisoVisto } from "@/app/cuenta/actions-avisos";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export type AvisoPendiente = { id: string; titulo: string; mensaje: string };

/**
 * Avisos que publicó la cooperativa desde /admin/plataforma: se muestran uno a
 * uno en una ventana la próxima vez que el asociado entra a /cuenta. Cerrar la
 * ventana (botón, Escape o fondo) lo marca como visto y no vuelve a salir.
 */
export function AvisosAlEntrar({ avisos }: { avisos: AvisoPendiente[] }) {
  const [indice, setIndice] = useState(0);
  const [, iniciar] = useTransition();
  const aviso = avisos[indice];
  if (!aviso) return null;

  function cerrar() {
    const id = aviso.id;
    iniciar(() => marcarAvisoVisto(id));
    setIndice((i) => i + 1);
  }

  const tituloId = `aviso-${aviso.id}`;
  return (
    <Modal abierto onCerrar={cerrar} tituloId={tituloId} variante="adaptable">
      <div className="flex flex-col gap-4 text-ga-texto">
        <span className="text-12 font-bold uppercase tracking-etiqueta text-ga-verde">Aviso de la cooperativa</span>
        <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
          {aviso.titulo}
        </h2>
        <p className="m-0 whitespace-pre-line text-16 leading-150 text-ga-texto-2">{aviso.mensaje}</p>
        <Button type="button" onClick={cerrar} className="sm:self-end">
          {indice + 1 < avisos.length ? "Siguiente aviso" : "Entendido"}
        </Button>
      </div>
    </Modal>
  );
}
