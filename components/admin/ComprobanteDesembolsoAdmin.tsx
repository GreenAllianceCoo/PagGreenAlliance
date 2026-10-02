"use client";

import { useRef, useState, type FormEvent } from "react";
import { guardarComprobanteDesembolso, urlComprobanteAdmin } from "@/app/admin/creditos/actions";
import { TEXTO_FORMATOS_COMPROBANTE, TIPOS_COMPROBANTE, errorDeArchivoComprobante } from "@/lib/comprobantes";
import { BotonAdmin, CampoAdmin } from "./CamposAdmin";
import { subirArchivoComprobante } from "./comprobanteCliente";

/** Entrada de archivo con el estilo de los controles del admin (sin cambiar el diseño: mismos tokens). */
export const CLASE_ARCHIVO_ADMIN =
  "w-full min-w-0 rounded-12 bg-admin-fondo p-2.5 text-14 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none file:mr-3 file:rounded-full file:border-0 file:bg-admin-superficie-2 file:px-3.5 file:py-2 file:text-13 file:font-bold file:text-admin-texto focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]";

export const ACEPTA_COMPROBANTE = TIPOS_COMPROBANTE.join(",");

type Props = {
  solicitudId: string;
  /** true si el crédito ya tiene comprobante (se puede ver y reemplazar). */
  tieneComprobante: boolean;
  onResuelto: (mensaje: string) => void;
};

/**
 * Comprobante de un crédito YA desembolsado (admin): «Ver comprobante», y subir o
 * reemplazar. Sube directo a Storage con URL firmada y luego liga el archivo a la
 * solicitud (la base deja el historial). Botones deshabilitados mientras trabaja.
 */
export function ComprobanteDesembolsoAdmin({ solicitudId, tieneComprobante, onResuelto }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const idCampo = `comprobante-archivo-${solicitudId}`;

  function alElegir(f: File | null) {
    setArchivo(f);
    setError(f ? errorDeArchivoComprobante(f) : null);
  }

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const mal = archivo ? errorDeArchivoComprobante(archivo) : "Elige el archivo del comprobante.";
    if (!archivo || mal) {
      setError(mal);
      entrada.current?.focus();
      return;
    }
    setOcupado(true);
    setError(null);
    const subida = await subirArchivoComprobante(solicitudId, archivo);
    const guardado = subida.ok ? await guardarComprobanteDesembolso({ solicitudId, ruta: subida.ruta }) : null;
    setOcupado(false);
    const fallo = !subida.ok ? subida.error : guardado?.error;
    if (fallo) {
      setError(fallo);
      entrada.current?.focus();
      return;
    }
    setArchivo(null);
    if (entrada.current) entrada.current.value = "";
    onResuelto(guardado?.mensaje ?? "Comprobante guardado.");
  }

  async function ver() {
    setAbriendo(true);
    setError(null);
    const pestana = window.open("", "_blank");
    if (pestana) pestana.opener = null;
    const r = await urlComprobanteAdmin({ solicitudId });
    setAbriendo(false);
    if (!r.url) {
      pestana?.close();
      setError(r.error ?? "No pudimos abrir el comprobante.");
      return;
    }
    if (pestana) pestana.location.href = r.url;
    else window.location.assign(r.url);
  }

  return (
    <div className="flex flex-col gap-3 rounded-14 bg-admin-superficie-2 p-3.5" data-testid="comprobante-admin">
      <div className="flex items-center justify-between gap-3">
        <span className="text-14 font-extrabold">Comprobante de la transferencia</span>
        {tieneComprobante ? (
          <button
            type="button"
            onClick={ver}
            disabled={abriendo}
            aria-busy={abriendo || undefined}
            className="flex h-11 items-center rounded-full px-4.5 text-14 font-bold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
          >
            {abriendo ? "Abriendo…" : "Ver comprobante"}
          </button>
        ) : (
          <span className="text-13 text-admin-ambar">Sin comprobante</span>
        )}
      </div>
      <form onSubmit={alEnviar} noValidate className="flex flex-col gap-2.5">
        <CampoAdmin
          id={idCampo}
          label={tieneComprobante ? "Reemplazar comprobante" : "Subir comprobante"}
          ayuda={TEXTO_FORMATOS_COMPROBANTE}
          error={error ?? undefined}
        >
          {(c) => (
            <input
              {...c}
              ref={entrada}
              name="comprobante"
              type="file"
              accept={ACEPTA_COMPROBANTE}
              onChange={(e) => alElegir(e.target.files?.[0] ?? null)}
              className={CLASE_ARCHIVO_ADMIN}
            />
          )}
        </CampoAdmin>
        <BotonAdmin variante="borde" textoCargando="Subiendo…" cargando={ocupado} className="self-start">
          {tieneComprobante ? "Reemplazar" : "Subir comprobante"}
        </BotonAdmin>
      </form>
    </div>
  );
}
