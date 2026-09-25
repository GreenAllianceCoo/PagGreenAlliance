import { Badge } from "@/components/ui/Badge";
import { estadoCliente, idFilaResumen, type FilaResumenAsesor } from "@/lib/asesor/resumen";

type TablaClientesProps = {
  filas: FilaResumenAsesor[];
};

/**
 * «Mis clientes»: tabla en escritorio, tarjetas en celular. Sin maqueta (no
 * hay diseño para /asesor): usa los mismos tokens (rounded-18/14, colores,
 * Badge) que /cuenta.
 *
 * IMPORTANTE (spec-fase-2.md §1): nunca se reciben ni se muestran celular,
 * correo, Nequi ni fotos — `resumen_clientes_asesor()` no las devuelve, y
 * `FilaResumenAsesor` tampoco las declara.
 */
export function TablaClientes({ filas }: TablaClientesProps) {
  return (
    <>
      {/* ≥ lg: tabla. */}
      <table className="hidden w-full border-collapse text-left lg:table">
        <thead>
          <tr className="border-b border-ga-linea text-14 text-ga-texto-3">
            <th scope="col" className="py-2.5 pr-3 font-bold">Nombre</th>
            <th scope="col" className="py-2.5 pr-3 font-bold">Cédula</th>
            <th scope="col" className="py-2.5 pr-3 font-bold">Grado</th>
            <th scope="col" className="py-2.5 pr-3 font-bold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const estado = estadoCliente(fila);
            return (
              <tr key={idFilaResumen(fila)} className="border-b border-ga-linea last:border-0">
                <td className="py-3 pr-3 text-15 font-bold text-ga-texto">{fila.nombre}</td>
                <td className="py-3 pr-3 text-15 text-ga-texto-2">{fila.cedula}</td>
                <td className="py-3 pr-3 text-15 text-ga-texto-2">{fila.grado}</td>
                <td className="py-3 pr-3">
                  <Badge tamano="md">{estado.etiqueta}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* < lg: tarjetas. */}
      <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:hidden">
        {filas.map((fila) => {
          const estado = estadoCliente(fila);
          return (
            <li
              key={idFilaResumen(fila)}
              className="flex flex-col gap-2 rounded-14 border border-ga-borde-tarjeta p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-16 font-bold text-ga-texto">{fila.nombre}</span>
                <Badge>{estado.etiqueta}</Badge>
              </div>
              <div className="flex gap-4 text-14 text-ga-texto-2">
                <span>Cédula {fila.cedula}</span>
                <span>Grado {fila.grado}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
