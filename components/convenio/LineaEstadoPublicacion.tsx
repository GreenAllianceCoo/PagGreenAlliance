import { Marcador, type EstadoPaso } from "@/components/ui/PasosSolicitud";
import { cx } from "@/components/ui/cx";
import { fechaCorta, type EstadoPublicacion } from "@/lib/convenio/publicaciones";

const PASOS = ["Programada", "Publicada", "Vencida"] as const;

function estadosDe(estado: Exclude<EstadoPublicacion, "oculta">): EstadoPaso[] {
  if (estado === "programada") return ["actual", "pendiente", "pendiente"];
  if (estado === "publicada") return ["hecho", "actual", "pendiente"];
  return ["hecho", "hecho", "hecho"];
}

/**
 * Estado de una publicación con la línea de pasos de la casa (la misma del
 * proceso de crédito): Programada → Publicada → Vencida. «Oculta por Green
 * Alliance» rompe la línea y muestra el motivo.
 */
export function LineaEstadoPublicacion({
  estado,
  iniciaEl,
  terminaEl,
  motivo,
}: {
  estado: EstadoPublicacion;
  iniciaEl: string | null;
  terminaEl: string | null;
  motivo?: string | null;
}) {
  if (estado === "oculta") {
    return (
      <div className="flex flex-col gap-1 rounded-12 bg-ga-error-fondo px-3 py-2.5 text-14 text-ga-error-texto">
        <span className="font-semibold">Oculta por Green Alliance</span>
        {motivo ? <span>Motivo: {motivo}</span> : <span>Escríbenos por WhatsApp si quieres saber por qué.</span>}
      </div>
    );
  }
  const estados = estadosDe(estado);
  const fechas = [iniciaEl ? fechaCorta(iniciaEl) : null, null, terminaEl ? fechaCorta(terminaEl) : null];
  return (
    <ol className="m-0 flex list-none items-start gap-1.5 p-0 text-13" aria-label="Estado de la publicación">
      {PASOS.map((paso, i) => (
        <li key={paso} className="flex min-w-0 flex-1 items-start gap-1.5" aria-current={estados[i] === "actual" ? "step" : undefined}>
          <Marcador estado={estados[i]} className="!h-4.5 !w-4.5" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className={cx(estados[i] === "actual" ? "font-semibold text-ga-texto" : estados[i] === "pendiente" ? "text-ga-texto-3" : "text-ga-texto-2")}>
              {paso}
            </span>
            {fechas[i] ? <span className="text-12 text-ga-texto-3">{fechas[i]}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
