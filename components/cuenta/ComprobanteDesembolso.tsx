"use client";

import { useState } from "react";
import { urlComprobanteDesembolso } from "@/app/cuenta/comprobante/actions";
import { Button } from "@/components/ui/Button";

type Props = {
  /** Id de la solicitud de crédito desembolsada. */
  solicitudId: string;
  /**
   * `true` si el crédito ya tiene comprobante (`solicitudes_credito.comprobante_subido_at`
   * no es null; esa columna sí la puede leer el asociado). Con `false` no se muestra nada.
   */
  disponible: boolean;
  className?: string;
};

/**
 * «Ver comprobante» del asociado: abre el comprobante de la transferencia en una
 * pestaña nueva con una URL firmada de 3 minutos que genera el servidor tras verificar
 * que la solicitud es suya. Solo lectura. Se conecta junto al estado «Desembolsado».
 *
 * La pestaña se abre ANTES de pedir la URL (en el clic) para que los navegadores de
 * celular no la bloqueen; si no se pudo abrir, se navega en la misma pestaña.
 */
export function ComprobanteDesembolso({ solicitudId, disponible, className }: Props) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!disponible) return null;

  async function ver() {
    setCargando(true);
    setError(null);
    const pestana = window.open("", "_blank");
    if (pestana) pestana.opener = null;
    try {
      const r = await urlComprobanteDesembolso(solicitudId);
      if (!r.url) {
        pestana?.close();
        setError(r.error ?? "No pudimos abrir el comprobante. Intenta de nuevo.");
        return;
      }
      if (pestana) pestana.location.href = r.url;
      else window.location.assign(r.url);
    } catch {
      pestana?.close();
      setError("No pudimos abrir el comprobante. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variante="terciario"
        cargando={cargando}
        textoCargando="Abriendo…"
        onClick={ver}
        aria-describedby={error ? `comprobante-error-${solicitudId}` : undefined}
        className={className}
      >
        Ver comprobante
      </Button>
      {error ? (
        <span id={`comprobante-error-${solicitudId}`} role="alert" className="text-13 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
