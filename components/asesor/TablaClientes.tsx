import Image from "next/image";
import { Badge, type EstadoBadge } from "@/components/ui/Badge";
import {
  categoriaAfiliacion,
  etiquetaCategoriaAfiliacion,
  etiquetaUltimoCredito,
  idFilaResumen,
  type FilaResumenAsesor,
} from "@/lib/asesor/resumen";

type TablaClientesProps = {
  filas: FilaResumenAsesor[];
};

// La categoría de afiliación y el estado de crédito comparten la paleta de
// Badge (pieza 2c: mismos tonos que el resto del design system C+).
const BADGE_AFILIACION: Record<ReturnType<typeof categoriaAfiliacion>, EstadoBadge> = {
  pendiente: "revision",
  contactado: "enviada",
  aprobada: "aprobada",
  rechazada: "rechazada",
};

const BADGE_CREDITO: Record<"pendiente" | "aprobado" | "rechazado" | "sin_credito", EstadoBadge> = {
  pendiente: "revision",
  aprobado: "aprobada",
  rechazado: "rechazada",
  sin_credito: "neutral",
};

function badgeCredito(fila: FilaResumenAsesor): EstadoBadge {
  return BADGE_CREDITO[fila.estado_credito ?? "sin_credito"];
}

/**
 * «Mis clientes» (pieza 2c): tabla de 5 columnas en escritorio (sin
 * columnas de contacto: no queda espacio donde pudieran aparecer celular,
 * correo, Nequi ni fotos), tarjetas blancas en celular. El estado vacío
 * (nadie en la categoría elegida) vive dentro de la misma tarjeta blanca,
 * como una fila más (así lo dibuja 2c: el encabezado de columnas se queda
 * arriba aunque no haya filas).
 */
export function TablaClientes({ filas }: TablaClientesProps) {
  return (
    <>
      {/* ≥ lg: tabla dentro de la tarjeta blanca (section la envuelve en ListaClientesCliente). */}
      <table className="hidden w-full border-collapse text-left lg:table">
        <thead>
          <tr className="text-13 font-bold uppercase tracking-[0.04em] text-ga-texto-3">
            <th scope="col" className="px-5 py-3.5 font-bold">Nombre</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Cédula</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Grado</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Afiliación</th>
            <th scope="col" className="px-3 py-3.5 font-bold">Último crédito</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={idFilaResumen(fila)} className="border-t border-ga-linea-suave text-16">
              <td className="px-5 py-3.5 font-extrabold text-ga-texto">{fila.nombre}</td>
              <td className="px-3 py-3.5 tabular-nums tracking-cedula text-ga-texto-2">{fila.cedula}</td>
              <td className="px-3 py-3.5 text-ga-texto-2">{fila.grado}</td>
              <td className="px-3 py-3.5">
                <Badge tamano="md" estado={BADGE_AFILIACION[categoriaAfiliacion(fila)]}>
                  {etiquetaCategoriaAfiliacion(categoriaAfiliacion(fila))}
                </Badge>
              </td>
              <td className="px-3 py-3.5">
                <Badge tamano="md" estado={badgeCredito(fila)}>
                  {etiquetaUltimoCredito(fila)}
                </Badge>
              </td>
            </tr>
          ))}
          {filas.length === 0 ? (
            <tr className="border-t border-ga-linea-suave">
              <td colSpan={5} className="p-0">
                <EstadoVacio />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* < lg: tarjetas blancas sueltas dentro de la misma tarjeta contenedora. */}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
        {filas.map((fila) => (
          <li key={idFilaResumen(fila)} className="flex flex-col gap-2 rounded-20 bg-white p-3.5">
            <strong className="text-16 font-bold text-ga-texto">{fila.nombre}</strong>
            <span className="text-14 tabular-nums text-ga-texto-3">
              {fila.cedula} · {fila.grado}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Badge estado={BADGE_AFILIACION[categoriaAfiliacion(fila)]}>
                Afiliación: {etiquetaCategoriaAfiliacion(categoriaAfiliacion(fila))}
              </Badge>
              <Badge estado={badgeCredito(fila)}>{etiquetaUltimoCredito(fila)}</Badge>
            </div>
          </li>
        ))}
        {filas.length === 0 ? <EstadoVacio /> : null}
      </ul>
    </>
  );
}

/** «Nadie en este estado por ahora» (pieza 2c): mismo tono motivador que el resto del sitio. */
function EstadoVacio() {
  return (
    <div className="flex items-center gap-5 rounded-20 bg-white p-6 lg:gap-6 lg:rounded-none lg:bg-transparent lg:p-9">
      <span
        aria-hidden="true"
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[58%_42%_55%_45%/48%_58%_42%_52%] bg-ga-verde-claro lg:h-[72px] lg:w-[72px]"
      >
        <Image
          src="/logos/vector/green-alliance-isotipo.svg"
          alt=""
          width={34}
          height={34}
          className="h-6 w-6 lg:h-8 lg:w-8"
        />
      </span>
      <div className="flex flex-col gap-1">
        <strong className="font-display text-18 font-extrabold text-ga-navy lg:text-22">
          Nadie en este estado por ahora
        </strong>
        <span className="text-15 text-ga-texto-2 lg:text-16">
          Cada compañero que refieras aparece aquí apenas envíe su afiliación. Pídele que escriba tu nombre en
          «¿Quién te refirió?».
        </span>
      </div>
    </div>
  );
}
