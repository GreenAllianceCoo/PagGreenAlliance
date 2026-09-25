import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { AccionesCredito } from "@/components/admin/AccionesCredito";
import { Badge } from "@/components/ui/Badge";
import { exigirAdmin } from "@/lib/admin/servidor";
import { formatearFecha, formatearPesos } from "@/lib/cuenta";
import { formatTasa } from "@/lib/credito";

export const metadata: Metadata = { title: "Créditos · Admin · Green Alliance" };

const ESTADOS = ["pendiente", "aprobado", "rechazado"] as const;
type Estado = (typeof ESTADOS)[number];

function esEstadoValido(valor: string | undefined): valor is Estado {
  return !!valor && (ESTADOS as readonly string[]).includes(valor);
}

type FilaCredito = {
  id: string;
  estado: Estado;
  monto_solicitado: number;
  porcentaje_devolucion: "50" | "100";
  tasa_interes_mensual: number;
  grado: string;
  fecha_solicitud: string;
  motivo_rechazo: string | null;
  perfiles: { nombre_completo: string; cedula: string } | null;
};

/** Lista de solicitudes de crédito, con filtro por estado (mapa §Admin). */
export default async function CreditosPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { supabase, nombre } = await exigirAdmin();
  const { estado: estadoCrudo } = await searchParams;
  const estado: Estado = esEstadoValido(estadoCrudo) ? estadoCrudo : "pendiente";

  const { data, error } = await supabase
    .from("solicitudes_credito")
    .select(
      "id, estado, monto_solicitado, porcentaje_devolucion, tasa_interes_mensual, grado, fecha_solicitud, motivo_rechazo, perfiles:asociado_id(nombre_completo, cedula)",
    )
    .eq("estado", estado)
    .order("fecha_solicitud", { ascending: false });

  const solicitudes = (data ?? []) as unknown as FilaCredito[];

  return (
    <AdminShell nombre={nombre} seccion="creditos">
      <h1 className="m-0 text-24 font-extrabold text-ga-navy lg:text-30">Solicitudes de crédito</h1>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={`/admin/creditos?estado=${e}`}
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
        <p className="m-0 rounded-12 bg-white p-4 text-15 text-ga-error">No pudimos cargar las solicitudes.</p>
      ) : solicitudes.length === 0 ? (
        <p className="m-0 rounded-12 bg-white p-4 text-15 text-ga-texto-3">No hay solicitudes en estado «{estado}».</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {solicitudes.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 rounded-14 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-16 font-bold text-ga-texto">{s.perfiles?.nombre_completo ?? "—"}</span>
                <span className="text-14 text-ga-texto-3">
                  Cédula {s.perfiles?.cedula ?? "—"} · {s.grado} · {formatearFecha(s.fecha_solicitud)}
                </span>
                {s.motivo_rechazo ? (
                  <span className="text-13 text-ga-error">Motivo: {s.motivo_rechazo}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col items-start gap-0.5 lg:items-end">
                  <span className="text-18 font-extrabold text-ga-navy">{formatearPesos(s.monto_solicitado)}</span>
                  <span className="text-13 text-ga-texto-3">
                    {s.porcentaje_devolucion}% · {formatTasa(Number(s.tasa_interes_mensual))} mensual
                  </span>
                </div>
                {estado === "pendiente" ? <AccionesCredito id={s.id} /> : <Badge>{s.estado}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
