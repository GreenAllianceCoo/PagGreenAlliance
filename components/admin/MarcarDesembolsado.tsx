"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { marcarDesembolsado, type EstadoAccionCredito } from "@/app/admin/creditos/actions";
import { TEXTO_FORMATOS_COMPROBANTE, errorDeArchivoComprobante } from "@/lib/comprobantes";
import { formatearFechaLarga, hoyBogota } from "@/lib/fechas";
import { BotonAdmin, CampoAdmin, EntradaAdmin } from "./CamposAdmin";
import { ACEPTA_COMPROBANTE, CLASE_ARCHIVO_ADMIN, ComprobanteDesembolsoAdmin } from "./ComprobanteDesembolsoAdmin";
import { subirArchivoComprobante } from "./comprobanteCliente";

const VACIO: EstadoAccionCredito = {};

type Props = {
  solicitudId: string;
  /** AAAA-MM-DD si ya se desembolsó; null = pendiente de desembolso. */
  fechaDesembolso: string | null;
  /** true si el crédito ya tiene comprobante de la transferencia. */
  tieneComprobante?: boolean;
  onResuelto: (mensaje: string) => void;
};

/**
 * «Marcar desembolsado» (pieza 3q, spec §12.2): fecha (por defecto hoy en hora de
 * Colombia, nunca futura), comprobante opcional de la transferencia (se recomienda;
 * JPG/PNG/WEBP/PDF, máx. 5 MB) y confirmación en 2 pasos. Ya desembolsado: solo lectura
 * más «Ver / subir / reemplazar comprobante».
 * El comprobante se sube directo a Storage antes de enviar; el servidor lo verifica
 * DESPUÉS de marcar el desembolso. Movimiento: solo opacity (motion-safe).
 */
export function MarcarDesembolsado({ solicitudId, fechaDesembolso, tieneComprobante = false, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(marcarDesembolsado, VACIO);
  const [, iniciar] = useTransition();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const hoy = hoyBogota();

  useEffect(() => {
    if (estado.mensaje) onResuelto(estado.mensaje);
  }, [estado.mensaje, onResuelto]);

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (subiendo || enviando) return;
    const datos = new FormData(e.currentTarget);
    datos.delete("comprobante"); // el archivo no viaja en la Server Action
    if (archivo) {
      const mal = errorDeArchivoComprobante(archivo);
      if (mal) {
        setErrorArchivo(mal);
        entradaArchivo.current?.focus();
        return;
      }
      setSubiendo(true);
      const subida = await subirArchivoComprobante(solicitudId, archivo);
      setSubiendo(false);
      if (!subida.ok) {
        setErrorArchivo(subida.error);
        entradaArchivo.current?.focus();
        return;
      }
      datos.set("comprobanteRuta", subida.ruta);
    }
    setErrorArchivo(null);
    iniciar(() => accion(datos));
  }

  if (fechaDesembolso) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 rounded-14 bg-admin-verde-fondo p-3.5 text-14 leading-145 text-admin-verde-claro">
          <strong className="text-admin-verde-2">Desembolsado</strong> el {formatearFechaLarga(fechaDesembolso.slice(0, 10))}. El
          conteo de 3 meses ya corre.
        </p>
        <ComprobanteDesembolsoAdmin solicitudId={solicitudId} tieneComprobante={tieneComprobante} onResuelto={onResuelto} />
      </div>
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

  const ocupado = subiendo || enviando;
  return (
    <form
      onSubmit={alEnviar}
      noValidate
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] motion-safe:animate-ga-aparecer"
    >
      <input type="hidden" name="id" value={solicitudId} />
      <CampoAdmin id={`desembolso-fecha-${solicitudId}`} label="Fecha del desembolso" error={estado.error} ayuda="Por defecto, hoy. No puede ser una fecha futura.">
        {(c) => <EntradaAdmin {...c} name="fecha" type="date" required defaultValue={hoy} max={hoy} className="[color-scheme:dark]" />}
      </CampoAdmin>
      <CampoAdmin
        id={`desembolso-comprobante-${solicitudId}`}
        label="Comprobante de la transferencia (recomendado)"
        ayuda={`${TEXTO_FORMATOS_COMPROBANTE}. El asociado lo verá en su cuenta.`}
        error={errorArchivo ?? undefined}
      >
        {(c) => (
          <input
            {...c}
            ref={entradaArchivo}
            name="comprobante"
            type="file"
            accept={ACEPTA_COMPROBANTE}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivo(f);
              setErrorArchivo(f ? errorDeArchivoComprobante(f) : null);
            }}
            className={CLASE_ARCHIVO_ADMIN}
          />
        )}
      </CampoAdmin>
      <div className="flex gap-2.5">
        <BotonAdmin textoCargando={subiendo ? "Subiendo comprobante…" : "Guardando…"} cargando={ocupado} className="h-11.5 flex-1">
          Confirmar desembolso
        </BotonAdmin>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          disabled={ocupado}
          className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
