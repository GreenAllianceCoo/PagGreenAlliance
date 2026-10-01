import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { exigirAdmin } from "@/lib/admin/servidor";
import { listarAsociadosConProceso } from "@/lib/admin/asociados";
import { enmascararCedula } from "@/lib/mascara";
import { ESTADOS_PROCESO } from "@/lib/procesoEjecutivo";

export const metadata: Metadata = { title: "Asociados · Admin · Green Alliance" };

/** Lista de asociados con el estado de su proceso ejecutivo (pieza 3m). */
export default async function AsociadosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, nombre } = await exigirAdmin();
  const { q = "" } = await searchParams;
  const { filas, error } = await listarAsociadosConProceso(supabase);
  const texto = q.trim().toLowerCase();
  const digitos = texto.replace(/\D/g, "");
  const visibles = texto
    ? filas.filter((f) => f.nombre.toLowerCase().includes(texto) || (digitos !== "" && f.cedula.includes(digitos)))
    : filas;

  return (
    <AdminShell nombre={nombre} seccion="asociados">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Asociados</h1>
      <form role="search" className="flex">
        <label htmlFor="buscar-asociado" className="sr-only">
          Buscar por nombre o cédula
        </label>
        <input
          id="buscar-asociado"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nombre o cédula"
          className="h-11.5 w-full rounded-full bg-admin-superficie px-4.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] lg:w-80"
        />
      </form>
      {error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar los asociados. Intenta de nuevo.
        </p>
      ) : visibles.length === 0 ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-texto-3">No hay asociados para mostrar.</p>
      ) : (
        <section className="overflow-hidden rounded-20 bg-admin-superficie">
          {visibles.map((f, i) => {
            const paso = f.estadoProceso ? ESTADOS_PROCESO.indexOf(f.estadoProceso) + 1 : null;
            const tono =
              f.estadoProceso === "operando"
                ? "bg-admin-ambar-fondo text-admin-ambar"
                : f.estadoProceso === "terminado"
                  ? "bg-admin-verde-fondo text-admin-verde"
                  : "bg-white/[.08] text-admin-texto-2";
            return (
              <Link
                key={f.id}
                href={`/admin/asociados/${f.id}`}
                style={{ animationDelay: `${i * 40}ms` }}
                className="flex flex-col gap-2 border-b border-admin-borde-sutil px-4.5 py-3.5 no-underline transition-colors duration-200 last:border-0 hover:bg-admin-superficie-2 motion-safe:animate-ga-fila-entra sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-15 font-extrabold text-white">{f.nombre}</span>
                  <span className="text-13 text-admin-texto-3">
                    {enmascararCedula(f.cedula)} · {f.grado ?? "Sin grado"}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {/* §12.6 (pieza 3q): chip «Inactivo» para los dados de baja. */}
                  {f.activo ? null : (
                    <span className="inline-flex rounded-full bg-admin-rojo-fondo px-2.5 py-1 text-13 font-extrabold text-admin-rojo-2">
                      Inactivo
                    </span>
                  )}
                  <span className={"inline-flex self-start rounded-full px-2.5 py-1 text-13 font-extrabold " + tono}>
                    {f.estadoProcesoTexto}
                    {paso ? ` (${paso}/8)` : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </section>
      )}
    </AdminShell>
  );
}
