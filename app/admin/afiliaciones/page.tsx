import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { exigirAdmin } from "@/lib/admin/servidor";

export const metadata: Metadata = { title: "Afiliaciones · Admin · Green Alliance" };

const ESTADOS = ["pendiente", "contactado", "aprobada", "rechazada"] as const;
type Estado = (typeof ESTADOS)[number];

function esEstadoValido(valor: string | undefined): valor is Estado {
  return !!valor && (ESTADOS as readonly string[]).includes(valor);
}

/** Lista de solicitudes de afiliación, con filtro por estado (mapa §Admin). */
export default async function AfiliacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { supabase, nombre } = await exigirAdmin();
  const { estado: estadoCrudo } = await searchParams;
  const estado: Estado = esEstadoValido(estadoCrudo) ? estadoCrudo : "pendiente";

  const { data: solicitudes, error } = await supabase
    .from("solicitudes_afiliacion")
    .select("id, nombre, cedula, grado, institucion, estado, created_at")
    .eq("estado", estado)
    .order("created_at", { ascending: false });

  return (
    <AdminShell nombre={nombre} seccion="afiliaciones">
      <h1 className="m-0 text-24 font-extrabold text-ga-navy lg:text-30">Afiliaciones</h1>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={`/admin/afiliaciones?estado=${e}`}
            aria-current={estado === e ? "page" : undefined}
            className={
              "rounded-full px-3.5 py-1.5 text-14 font-bold no-underline " +
              (estado === e ? "bg-ga-navy text-white" : "bg-white text-ga-texto hover:bg-ga-fondo-suave")
            }
          >
            {e[0].toUpperCase() + e.slice(1)}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="m-0 rounded-12 bg-white p-4 text-15 text-ga-error">
          No pudimos cargar las solicitudes. Intenta de nuevo.
        </p>
      ) : !solicitudes || solicitudes.length === 0 ? (
        <p className="m-0 rounded-12 bg-white p-4 text-15 text-ga-texto-3">
          No hay solicitudes en estado «{estado}».
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/afiliaciones/${s.id}`}
                className="flex flex-col gap-2 rounded-14 bg-white p-4 no-underline hover:bg-ga-fondo-suave sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-16 font-bold text-ga-texto">{s.nombre}</span>
                  <span className="text-14 text-ga-texto-3">
                    Cédula {s.cedula} · {s.grado} · {s.institucion === "policia" ? "Policía" : "Ejército"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-13 text-ga-texto-3">
                    {new Date(s.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <Badge>{s.estado}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
