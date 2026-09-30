import type { PasoProceso } from "@/lib/procesoEjecutivo";
import { cx } from "./cx";
import { IconoCheck } from "./Iconos";

type LineaProcesoProps = {
  pasos: PasoProceso[];
  /** `completa`: tarjeta de /cuenta (círculos de 32 px en escritorio). `compacta`: versión pequeña. */
  className?: string;
};

function Circulo({ estado, tamano }: { estado: PasoProceso["estado"]; tamano: "grande" | "chico" }) {
  const medida = tamano === "grande" ? "h-8 w-8" : "h-5.5 w-5.5";
  if (estado === "hecho") {
    return (
      <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-ga-verde text-white", medida)}>
        <IconoCheck tamano={tamano === "grande" ? 16 : 13} grosor={3} />
      </span>
    );
  }
  return (
    <span
      className={cx(
        "box-border shrink-0 rounded-full",
        medida,
        // Mismos colores del stepper de solicitud (pieza 3a): aro ámbar = actual, borde claro = pendiente.
        estado === "actual"
          ? tamano === "grande"
            ? "border-6 border-ga-ambar bg-ga-ambar-fondo"
            : "border-5 border-ga-ambar bg-ga-ambar-fondo"
          : "border-2 border-ga-verde-borde-pendiente bg-white",
      )}
    />
  );
}

/**
 * Línea de los 8 pasos del proceso ejecutivo (pieza 3k): Reparto → … → Terminado.
 * Escritorio (lg): 8 columnas con una barra que se llena con scaleX (500 ms, spring).
 * Celular: lista vertical (8 columnas no caben en 390 px). Solo lectura: el asociado
 * no puede cambiarla (la escribe el admin).
 */
export function LineaProceso({ pasos, className }: LineaProcesoProps) {
  const indiceActual = pasos.findIndex((p) => p.estado === "actual");
  const ultimoHecho = pasos.reduce((acc, p, i) => (p.estado === "hecho" ? i : acc), -1);
  const avance = Math.max(indiceActual, ultimoHecho, 0);
  const fraccion = pasos.length > 1 ? avance / (pasos.length - 1) : 0;

  return (
    <div className={className}>
      {/* Escritorio */}
      <ol className="relative m-0 hidden list-none grid-cols-8 p-0 lg:grid">
        <span aria-hidden="true" className="absolute left-[6.25%] right-[6.25%] top-3.5 h-[3px] rounded-sm bg-ga-verde-claro" />
        <span
          aria-hidden="true"
          className="absolute left-[6.25%] top-3.5 h-[3px] w-[87.5%] origin-left rounded-sm bg-ga-verde transition-transform duration-500 ease-spring"
          style={{ transform: `scaleX(${fraccion})` }}
        />
        {pasos.map((paso, i) => (
          <li
            key={paso.clave}
            aria-current={paso.estado === "actual" ? "step" : undefined}
            className="relative flex flex-col items-center gap-1.5 text-center"
          >
            <Circulo estado={paso.estado} tamano="grande" />
            <span
              className={cx(
                "text-12 leading-tight",
                paso.estado === "actual" ? "font-extrabold text-ga-texto" : "font-semibold",
                paso.estado === "pendiente" ? "text-ga-texto-3" : "text-ga-texto",
              )}
            >
              <span className="sr-only">Paso {i + 1} de {pasos.length}: </span>
              {paso.etiqueta}
            </span>
          </li>
        ))}
      </ol>

      {/* Celular y tableta */}
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-14 lg:hidden">
        {pasos.map((paso, i) => (
          <li
            key={paso.clave}
            aria-current={paso.estado === "actual" ? "step" : undefined}
            className={cx(
              "flex items-center gap-2.5",
              paso.estado === "hecho" && "opacity-[.55]",
              paso.estado === "actual" && "font-extrabold",
              paso.estado === "pendiente" && "text-ga-texto-3",
            )}
          >
            <Circulo estado={paso.estado} tamano="chico" />
            <span className="sr-only">Paso {i + 1} de {pasos.length}: </span>
            {paso.etiqueta}
          </li>
        ))}
      </ol>
    </div>
  );
}
