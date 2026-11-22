"use client";

import { useActionState, useState } from "react";
import { mostrarPublicacion, ocultarPublicacion, type EstadoModeracion } from "@/app/admin/convenios/publicaciones/actions";
import { MOTIVO_OCULTAR_MAX } from "@/lib/validaciones/publicacionesConvenio";

const VACIO: EstadoModeracion = {};

const CLASE_BOTON =
  "flex h-11 items-center justify-center rounded-10 px-4 text-14 font-semibold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie disabled:opacity-40";

function Aviso({ estado }: { estado: EstadoModeracion }) {
  if (!estado.error && !estado.mensaje) return null;
  return (
    <p role={estado.error ? "alert" : "status"} className={"m-0 text-14 font-semibold " + (estado.error ? "text-admin-rojo-2" : "text-admin-verde-2")}>
      {estado.error ?? estado.mensaje}
    </p>
  );
}

/** «Ocultar» (con motivo opcional) o «Volver a mostrar» una publicación de convenio. */
export function AccionesPublicacionAdmin({ id, titulo, oculta }: { id: string; titulo: string; oculta: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estadoOcultar, ocultar, ocultando] = useActionState(async (previo: EstadoModeracion, datos: FormData) => {
    const resultado = await ocultarPublicacion(previo, datos);
    if (resultado.listo) {
      setAbierto(false);
      setMotivo("");
    }
    return resultado;
  }, VACIO);
  const [estadoMostrar, mostrar, mostrando] = useActionState(mostrarPublicacion, VACIO);

  if (oculta) {
    return (
      <form action={mostrar} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={mostrando} className={CLASE_BOTON + " self-start"}>
          {mostrando ? "Guardando…" : "Volver a mostrar"}
        </button>
        <Aviso estado={estadoMostrar} />
        <Aviso estado={estadoOcultar} />
      </form>
    );
  }

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setAbierto(true)} className={CLASE_BOTON + " self-start"}>
          Ocultar
        </button>
        <Aviso estado={estadoMostrar} />
      </div>
    );
  }

  const campo = `motivo-${id}`;
  return (
    <form action={ocultar} role="group" aria-label={`Ocultar «${titulo}»`} className="flex flex-col gap-2.5 rounded-14 bg-admin-superficie p-3.5">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={campo} className="text-14 font-semibold text-admin-texto">
        Motivo <span className="font-normal text-admin-texto-3">(opcional, lo ve el convenio)</span>
      </label>
      <textarea
        id={campo}
        name="motivo"
        rows={2}
        maxLength={MOTIVO_OCULTAR_MAX}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ej.: la imagen no corresponde a la promoción"
        className="w-full min-w-0 resize-y rounded-12 bg-admin-fondo px-3.5 py-3 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]"
      />
      <span className="text-13 text-admin-texto-3">
        {motivo.length} de {MOTIVO_OCULTAR_MAX}. Sale de Beneficios al instante y el convenio ya no podrá editarla ni retirarla.
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={ocultando}
          className="flex h-11 items-center justify-center rounded-10 bg-admin-ambar px-5 text-14 font-semibold text-admin-fondo disabled:opacity-60"
        >
          {ocultando ? "Ocultando…" : "Sí, ocultar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} disabled={ocultando} className={CLASE_BOTON}>
          Cancelar
        </button>
      </div>
      <Aviso estado={estadoOcultar} />
    </form>
  );
}
