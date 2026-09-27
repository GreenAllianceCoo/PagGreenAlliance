import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ChipEstado } from "@/components/admin/ChipEstado";
import { exigirAdmin } from "@/lib/admin/servidor";
import { enmascararCedula } from "@/lib/mascara";
import { formatearFecha } from "@/lib/cuenta";
import { ESTADOS_AFILIACION, esEstadoAfiliacionValido, listarSolicitudesAfiliacion, type EstadoAfiliacion } from "./_datos";

export const metadata: Metadata = { title: "Afiliaciones · Admin · Green Alliance" };

const INSTITUCIONES: Record<string, string> = { policia: "Policía Nacional", ejercito: "Ejército Nacional" };

/** Lista de solicitudes de afiliación, con filtro por estado (pieza 3e). */
export default async function AfiliacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { supabase, nombre } = await exigirAdmin();
  const { estado: estadoCrudo } = await searchParams;
  const estado: EstadoAfiliacion = esEstadoAfiliacionValido(estadoCrudo) ? estadoCrudo : "pendiente";
  const { filas: solicitudes, error } = await listarSolicitudesAfiliacion(supabase, estado);

  return (
    <AdminShell nombre={nombre} seccion="afiliaciones" contadorSeccionActual={estado === "pendiente" ? solicitudes.length : undefined}>
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Afiliaciones</h1>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ESTADOS_AFILIACION.map((e) => (
          <Link
            key={e}
            href={`/admin/afiliaciones?estado=${e}`}
            aria-current={estado === e ? "page" : undefined}
            className={
              "flex h-10 items-center rounded-full px-4 text-14 font-bold no-underline " +
              (estado === e ? "bg-admin-texto text-admin-fondo" : "text-admin-texto-2 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie")
            }
          >
            {e[0].toUpperCase() + e.slice(1)}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar las solicitudes. Intenta de nuevo.
        </p>
      ) : solicitudes.length === 0 ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-texto-3">
          No hay solicitudes en estado «{estado}».
        </p>
      ) : (
        <section className="overflow-hidden rounded-20 bg-admin-superficie">
          {solicitudes.map((s, indice) => (
            <Link
              key={s.id}
              href={`/admin/afiliaciones/${s.id}`}
              style={{ animationDelay: `${indice * 70}ms` }}
              className="flex flex-col gap-2 border-b border-admin-borde-sutil px-4.5 py-3.5 no-underline transition-colors duration-200 last:border-0 hover:bg-admin-superficie-2 motion-safe:animate-ga-fila-entra sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-16 font-extrabold text-white">{s.nombre}</span>
                <span className="text-14 text-admin-texto-3">
                  {enmascararCedula(s.cedula)} · {s.grado} · {INSTITUCIONES[s.institucion] ?? s.institucion}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-13 text-admin-texto-3">{formatearFecha(s.created_at)}</span>
                <ChipEstado estado={s.estado} />
              </div>
            </Link>
          ))}
        </section>
      )}
    </AdminShell>
  );
}
