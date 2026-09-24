import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { SelectorMes } from "@/components/admin/SelectorMes";
import { exigirAdmin } from "@/lib/admin/servidor";

export const metadata: Metadata = { title: "Sorteo · Admin · Green Alliance" };

/** Año y mes actuales en hora de Colombia (mismo huso que usa la base, spec §4). */
function mesActualBogota() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const anio = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return { anio, mes };
}

type FilaBoleta = {
  numero: string;
  fecha_confirmacion: string | null;
  perfiles: { nombre_completo: string; cedula: string } | null;
};

/** Boletas confirmadas del mes elegido (mapa §Admin · Sorteo). */
export default async function SorteoPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const { supabase, nombre } = await exigirAdmin();
  const actual = mesActualBogota();
  const { anio: anioCrudo, mes: mesCrudo } = await searchParams;
  const anio = Number(anioCrudo) || actual.anio;
  const mesNum = Number(mesCrudo);
  const mes = mesNum >= 1 && mesNum <= 12 ? mesNum : actual.mes;

  const { data, error } = await supabase
    .from("boletas_sorteo")
    .select("numero, fecha_confirmacion, perfiles:asociado_id(nombre_completo, cedula)")
    .eq("anio", anio)
    .eq("mes", mes)
    .eq("estado", "confirmada")
    .order("fecha_confirmacion", { ascending: true });

  const boletas = (data ?? []) as unknown as FilaBoleta[];
  // Rango razonable para el selector: desde que existe la app hasta el año siguiente.
  const anios = Array.from({ length: 5 }, (_, i) => actual.anio - 3 + i);

  return (
    <AdminShell nombre={nombre} seccion="sorteo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-24 font-extrabold text-ga-navy lg:text-30">Sorteo mensual</h1>
        <SelectorMes anio={anio} mes={mes} anios={anios} />
      </div>

      {error ? (
        <p className="m-0 rounded-12 bg-white p-4 text-15 text-ga-error">No pudimos cargar las boletas.</p>
      ) : boletas.length === 0 ? (
        <p className="m-0 rounded-12 bg-white p-4 text-15 text-ga-texto-3">
          No hay boletas confirmadas para este mes.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-18 bg-white">
          <table className="w-full min-w-[480px] border-collapse text-15">
            <thead>
              <tr className="border-b border-ga-linea text-left text-13 text-ga-texto-3">
                <th className="p-4 font-bold">Boleta</th>
                <th className="p-4 font-bold">Nombre</th>
                <th className="p-4 font-bold">Cédula</th>
                <th className="p-4 font-bold">Confirmada</th>
              </tr>
            </thead>
            <tbody>
              {boletas.map((b) => (
                <tr key={b.numero} className="border-b border-ga-linea last:border-0">
                  <td className="p-4 font-mono font-bold tracking-cedula">{b.numero}</td>
                  <td className="p-4">{b.perfiles?.nombre_completo ?? "—"}</td>
                  <td className="p-4">{b.perfiles?.cedula ?? "—"}</td>
                  <td className="p-4 text-ga-texto-3">
                    {b.fecha_confirmacion
                      ? new Date(b.fecha_confirmacion).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
