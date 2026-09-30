"use client";

import { useId, useState } from "react";
import { IconoWhatsapp } from "@/components/ui/Iconos";
import { Modal } from "@/components/ui/Modal";
import type { Convenio } from "@/lib/convenios";

type ListaConveniosProps = {
  convenios: Convenio[];
  /** `landing`: tarjetas grandes (pieza 2a). `cuenta`: chips compactos de /cuenta (pieza 2b). */
  variante: "landing" | "cuenta";
};

/** Viñeta verde de «Servicios» (pieza 3n). */
function Vineta() {
  return <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-ga-verde" />;
}

/**
 * Detalle de un convenio (pieza 3n): modal centrado en escritorio y hoja inferior en
 * celular, con descripción, servicios en viñetas, sedes (solo si tiene), NIT y
 * «Escribir por WhatsApp» (enlace wa.me directo, sin backend).
 */
function DetalleConvenio({ convenio, onCerrar }: { convenio: Convenio; onCerrar: () => void }) {
  const idTitulo = useId();
  return (
    <Modal abierto onCerrar={onCerrar} tituloId={idTitulo}>
      <div className="flex flex-col gap-3.5 lg:gap-4.5">
        <div className="flex flex-col gap-1 pr-10 lg:gap-1.5">
          <span className="text-12 font-bold uppercase tracking-[0.04em] text-ga-verde lg:text-13">
            {convenio.especialidad}
          </span>
          <h2 id={idTitulo} className="m-0 font-display text-22 font-extrabold text-ga-navy lg:text-30">
            {convenio.nombre}
          </h2>
        </div>
        {convenio.descripcion ? (
          <p className="m-0 text-14 leading-150 text-ga-texto-2 lg:text-16 lg:leading-155">{convenio.descripcion}</p>
        ) : null}
        {convenio.servicios.length > 0 ? (
          <div className="flex flex-col gap-1.5 lg:gap-2">
            <h3 className="m-0 text-14 font-extrabold text-ga-navy">Servicios</h3>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-14 text-ga-texto-2 lg:gap-2 lg:text-16">
              {convenio.servicios.map((servicio) => (
                <li key={servicio} className="flex items-baseline gap-2.5">
                  <Vineta />
                  {servicio}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {/* Sedes solo si el convenio tiene (Dr. Ribero y Racing Tours): si no, la fila no existe. */}
        {convenio.sedes.length > 0 ? (
          <div className="flex flex-col gap-1.5 lg:gap-2">
            <h3 className="m-0 text-14 font-extrabold text-ga-navy">Sedes</h3>
            <div className="flex flex-col gap-1.5 text-14 text-ga-texto-2 lg:text-15">
              {convenio.sedes.map((sede) => (
                <span key={sede}>{sede}</span>
              ))}
            </div>
          </div>
        ) : null}
        <hr className="m-0 border-0 border-t border-ga-linea" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <span className="text-13 text-ga-texto-3 lg:text-14">
            {convenio.nit ? `NIT ${convenio.nit}` : null}
            {convenio.whatsappTexto ? (
              <span className="sr-only"> · WhatsApp {convenio.whatsappTexto}</span>
            ) : null}
          </span>
          {convenio.whatsappUrl ? (
            <a
              href={convenio.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12.5 items-center justify-center gap-2.5 rounded-full border-1.5 border-ga-navy bg-white px-5.5 text-14 font-extrabold text-ga-navy no-underline transition-colors duration-200 hover:bg-ga-fondo-suave hover:text-ga-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde lg:text-15"
            >
              <IconoWhatsapp tamano={18} />
              Escribir por WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/** Lista de convenios con su detalle por marca (pieza 3n), en la landing y en /cuenta. */
export function ListaConvenios({ convenios, variante }: ListaConveniosProps) {
  const [abierto, setAbierto] = useState<Convenio | null>(null);
  const cerrar = () => setAbierto(null);

  return (
    <>
      <div
        className={
          variante === "landing"
            ? "flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-3.5"
            : "flex flex-col gap-3 lg:grid lg:grid-cols-5"
        }
      >
        {convenios.map((convenio) =>
          variante === "landing" ? (
            <button
              key={convenio.nombre}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setAbierto(convenio)}
              className="flex flex-col gap-2.5 rounded-24 bg-white p-5 text-left transition-colors duration-200 hover:bg-ga-verde-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
            >
              <span className="text-13 font-bold uppercase tracking-[0.04em] text-ga-verde">
                {convenio.especialidad}
              </span>
              <strong className="font-display text-20 font-extrabold leading-115 text-ga-navy">
                {convenio.nombre}
              </strong>
              <span className="flex items-center gap-2 text-15 text-ga-texto-2">
                <span aria-hidden="true" className="text-22">
                  {convenio.emoji}
                </span>
                {convenio.nombreCorto}
              </span>
              <span className="text-14 font-extrabold text-ga-verde underline">Ver detalle</span>
            </button>
          ) : (
            <button
              key={convenio.nombre}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setAbierto(convenio)}
              className="flex items-center gap-2.5 rounded-12 border border-ga-borde-tarjeta bg-white p-3 text-left text-14 font-bold text-ga-texto transition-colors duration-200 hover:bg-ga-fondo-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
            >
              <span aria-hidden="true" className="text-22">
                {convenio.emoji}
              </span>
              {convenio.nombreCorto}
            </button>
          ),
        )}
      </div>
      {abierto ? <DetalleConvenio convenio={abierto} onCerrar={cerrar} /> : null}
    </>
  );
}
