import { IconoCheck } from "./Iconos";
import { cx } from "./cx";

export type EstadoPaso = "hecho" | "actual" | "pendiente";

type Paso = { etiqueta: string; estado: EstadoPaso; fecha?: string };

type PasosSolicitudProps = {
  pasos: Paso[];
  /**
   * `lista`: lista vertical con círculos (landing, siempre igual).
   * `cuenta`: lista vertical con fechas en celular; en escritorio 4 columnas
   * con barra superior (design/Inicio-*.dc.html).
   */
  variante?: "lista" | "cuenta";
};

function Marcador({ estado, className }: { estado: EstadoPaso; className?: string }) {
  if (estado === "hecho") {
    return (
      <span
        className={cx(
          "flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-ga-verde text-white",
          className,
        )}
      >
        <IconoCheck tamano={14} grosor={3} />
      </span>
    );
  }
  return (
    <span
      className={cx(
        "h-5.5 w-5.5 shrink-0 rounded-full",
        estado === "actual" ? "border-6 border-ga-ambar" : "border-2 border-ga-gris-circulo",
        className,
      )}
    />
  );
}

const BARRA: Record<EstadoPaso, string> = {
  hecho: "lg:border-ga-verde",
  actual: "lg:border-ga-ambar",
  pendiente: "lg:border-ga-gris-paso",
};

/** Estado de una solicitud de crédito: Enviada → En revisión → Aprobada → Desembolso. */
export function PasosSolicitud({ pasos, variante = "lista" }: PasosSolicitudProps) {
  if (variante === "lista") {
    return (
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-15">
        {pasos.map((paso) => (
          <li
            key={paso.etiqueta}
            className={cx(
              "flex items-center gap-2.5",
              paso.estado === "actual" && "font-bold",
              paso.estado === "pendiente" && "text-ga-texto-3",
            )}
          >
            <Marcador estado={paso.estado} />
            {paso.etiqueta}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0 text-15 lg:grid lg:grid-cols-4">
      {pasos.map((paso) => (
        <li
          key={paso.etiqueta}
          className={cx(
            "flex items-center gap-2.5 lg:flex-col lg:items-start lg:gap-2 lg:border-t-4 lg:pt-3",
            BARRA[paso.estado],
            paso.estado === "actual" && "font-bold",
            paso.estado === "pendiente" && "text-ga-texto-3",
          )}
        >
          <Marcador estado={paso.estado} className="lg:hidden" />
          <span className={cx("grow lg:grow-0", paso.estado !== "actual" && "lg:font-bold")}>
            {paso.etiqueta}
          </span>
          {paso.fecha ? (
            <span className="font-normal text-ga-texto-3">{paso.fecha}</span>
          ) : (
            // Sin fecha: en escritorio el diseño muestra una raya.
            <span className="hidden lg:block">—</span>
          )}
        </li>
      ))}
    </ol>
  );
}
