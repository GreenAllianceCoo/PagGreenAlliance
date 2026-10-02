import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { FilaAlerta } from "@/components/admin/FilaAlerta";
import { FilaRecuperacion } from "@/components/admin/FilaRecuperacion";
import { exigirAdmin } from "@/lib/admin/servidor";
import { listarAlertas, type EstadoAlerta } from "@/lib/admin/alertas";
import { listarRecuperaciones } from "@/lib/admin/recuperaciones";

export const metadata: Metadata = { title: "Alertas · Admin · Green Alliance" };

/** Bandeja de alertas de retiro anticipado y renovación (pieza 3m). */
export default async function AlertasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { supabase, nombre, userId } = await exigirAdmin();
  const { estado: crudo } = await searchParams;
  const estado: EstadoAlerta = crudo === "atendida" ? "atendida" : "pendiente";
  const [{ filas, error }, recuperaciones] = await Promise.all([
    listarAlertas(supabase, estado),
    listarRecuperaciones(supabase, userId, estado === "pendiente" ? "pendiente" : "resueltas"),
  ]);

  return (
    <AdminShell nombre={nombre} seccion="alertas">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Alertas</h1>
      <nav aria-label="Filtrar por estado" className="flex gap-2">
        {(["pendiente", "atendida"] as const).map((e) => (
          <Link
            key={e}
            href={`/admin/alertas?estado=${e}`}
            aria-current={estado === e ? "page" : undefined}
            className={
              "flex h-11 items-center rounded-full px-4 text-14 font-bold no-underline " +
              (estado === e
                ? "bg-admin-rojo-fondo text-admin-rojo-2"
                : "text-admin-texto-3 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]")
            }
          >
            {e === "pendiente"
              ? `Pendientes${estado === e ? ` · ${filas.length + recuperaciones.filas.length}` : ""}`
              : "Atendidas"}
          </Link>
        ))}
      </nav>
      {recuperaciones.error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar las solicitudes de recuperación de acceso.
        </p>
      ) : recuperaciones.filas.length > 0 ? (
        <section aria-labelledby="recuperacion-titulo" className="flex max-w-[820px] flex-col gap-2.5">
          <h2
            id="recuperacion-titulo"
            className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3"
          >
            Recuperación de acceso
          </h2>
          <div className="overflow-hidden rounded-20 bg-admin-superficie">
            {recuperaciones.filas.map((r) => (
              <FilaRecuperacion key={r.id} fila={r} />
            ))}
          </div>
        </section>
      ) : null}
      {error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar las alertas. Intenta de nuevo.
        </p>
      ) : filas.length === 0 && recuperaciones.filas.length === 0 ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-texto-3">
          No hay alertas {estado === "pendiente" ? "pendientes" : "atendidas"}.
        </p>
      ) : filas.length === 0 ? null : (
        <section className="max-w-[820px] overflow-hidden rounded-20 bg-admin-superficie">
          {filas.map((a) => (
            <FilaAlerta key={a.id} alerta={a} />
          ))}
        </section>
      )}
    </AdminShell>
  );
}
