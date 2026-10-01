import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { RealizarSorteo } from "@/components/admin/RealizarSorteo";
import { SelectorMes } from "@/components/admin/SelectorMes";
import { exigirAdmin } from "@/lib/admin/servidor";
import { nombreMes } from "@/lib/sorteo/fecha";

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

/** Forma que devuelve la RPC boletas_confirmadas_sorteo (F2-01, 20260924000600). */
type FilaBoleta = {
  numero: string;
  fecha_confirmacion: string | null;
  nombre_completo: string | null;
  cedula: string | null;
};

type FilaInscrito = {
  nombre_completo: string | null;
  grado: string | null;
  cedula_enmascarada: string | null;
  estado: string;
};

/** Boletas confirmadas del mes elegido (pieza 3g). */
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

  // F2-01 (20260924000600): la columna `numero` ya no se puede leer por
  // select directo (ni el admin): solo por esta RPC, que se autofiltra por
  // es_admin() dentro (quien no sea admin recibe 0 filas).
  const mesClave = `${anio}-${String(mes).padStart(2, "0")}`;
  const [{ data, error }, { data: sorteoHecho }, { data: inscritosData }] = await Promise.all([
    supabase.rpc("boletas_confirmadas_sorteo", { p_anio: anio, p_mes: mes }),
    // §12.10: el admin lee sorteos_mensuales (RLS); una fila = ya se realizó.
    supabase.from("sorteos_mensuales").select("mes").eq("mes", `${mesClave}-01`).maybeSingle(),
    // Inscritos del mes (nombre, grado, cédula enmascarada; sin número de boleta). Solo admin.
    supabase.rpc("admin_inscritos_sorteo", { p_anio: anio, p_mes: mes }),
  ]);
  const inscritos = (inscritosData ?? []) as FilaInscrito[];

  const boletas = (data ?? []) as FilaBoleta[];
  // Rango razonable para el selector: desde que existe la app hasta el año siguiente.
  const anios = Array.from({ length: 5 }, (_, i) => actual.anio - 3 + i);

  return (
    <AdminShell nombre={nombre} seccion="sorteo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Sorteo mensual</h1>
        <SelectorMes anio={anio} mes={mes} anios={anios} />
      </div>

      {error ? null : (
        <RealizarSorteo mes={mesClave} mesTexto={nombreMes(mes)} yaRealizado={Boolean(sorteoHecho)} hayParticipantes={boletas.length > 0} />
      )}

      {error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">No pudimos cargar las boletas.</p>
      ) : boletas.length === 0 ? (
        <div className="rounded-16 bg-admin-superficie p-9 text-center">
          <span className="text-15 text-admin-texto-3">No hay boletas confirmadas para este mes.</span>
        </div>
      ) : (
        <>
          {/* ≥ lg: tabla, como el resto de las pantallas del admin. */}
          <div className="hidden overflow-x-auto rounded-20 bg-admin-superficie lg:block">
            <table className="w-full min-w-[480px] border-collapse text-15">
              <thead>
                <tr className="border-b border-admin-borde-sutil text-left text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
                  <th className="p-4">Boleta</th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Cédula</th>
                  <th className="p-4">Confirmada</th>
                </tr>
              </thead>
              <tbody>
                {boletas.map((b) => (
                  <tr key={b.numero} className="border-b border-admin-borde-sutil last:border-0">
                    <td className="p-4 font-mono font-extrabold tracking-cedula">{b.numero}</td>
                    <td className="p-4 font-bold text-white">{b.nombre_completo ?? "—"}</td>
                    <td className="p-4 text-admin-texto-2">{b.cedula ?? "—"}</td>
                    <td className="p-4 text-admin-texto-3">
                      {b.fecha_confirmacion
                        ? new Date(b.fecha_confirmacion).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* < lg: tarjetas (mismo patrón que PanelCreditos, /admin/afiliaciones y TablaClientes del asesor). */}
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
            {boletas.map((b) => (
              <li key={b.numero} className="flex flex-col gap-1.5 rounded-16 bg-admin-superficie p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-16 font-extrabold tracking-cedula text-white">{b.numero}</span>
                  <span className="text-13 text-admin-texto-3">
                    {b.fecha_confirmacion
                      ? new Date(b.fecha_confirmacion).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </span>
                </div>
                <span className="text-15 font-bold text-white">{b.nombre_completo ?? "—"}</span>
                <span className="text-14 text-admin-texto-2">{b.cedula ?? "—"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <section aria-labelledby="inscritos-sorteo" className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5">
        <h2 id="inscritos-sorteo" className="m-0 font-display text-18 font-extrabold">
          Inscritos del mes · {inscritos.length}
        </h2>
        {inscritos.length === 0 ? (
          <span className="text-15 text-admin-texto-3">Nadie se ha inscrito en este mes.</span>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {inscritos.map((i, n) => (
              <li key={n} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-15">
                <span className="font-bold text-white">{i.nombre_completo ?? "—"}</span>
                <span className="text-admin-texto-2">
                  {i.grado ?? "Sin grado"} · <span className="font-mono tracking-cedula">{i.cedula_enmascarada ?? "—"}</span>
                  {i.estado === "confirmada" ? " · confirmada" : " · sin confirmar"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
