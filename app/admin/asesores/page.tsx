import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormularioAsesor } from "@/components/admin/FormularioAsesor";
import { exigirAdmin } from "@/lib/admin/servidor";

export const metadata: Metadata = { title: "Asesores · Admin · Green Alliance" };

/** Lista de asesores (con cuántos clientes y afiliaciones tiene cada uno) + alta (pieza 3f). */
export default async function AsesoresPage() {
  const { supabase, nombre } = await exigirAdmin();

  const { data: asesores } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, cedula")
    .eq("rol", "asesor")
    .order("nombre_completo");

  const conConteos = await Promise.all(
    (asesores ?? []).map(async (a) => {
      const [clientes, afiliaciones] = await Promise.all([
        supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("asesor_id", a.id),
        supabase.from("solicitudes_afiliacion").select("id", { count: "exact", head: true }).eq("asesor_id", a.id),
      ]);
      return { ...a, clientes: clientes.count ?? 0, afiliaciones: afiliaciones.count ?? 0 };
    }),
  );

  return (
    <AdminShell nombre={nombre} seccion="asesores">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Asesores</h1>

      <FormularioAsesor />

      <section className="flex flex-col gap-2 rounded-20 bg-admin-superficie p-5.5">
        <h2 className="m-0 font-display text-20 font-extrabold">Asesores registrados</h2>
        {conConteos.length === 0 ? (
          <p className="m-0 text-15 text-admin-texto-3">Todavía no hay asesores.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {conConteos.map((a, indice) => (
              <li
                key={a.id}
                style={{ animationDelay: `${indice * 60}ms` }}
                className="flex flex-col gap-1 rounded-14 bg-admin-superficie-2 p-3.5 motion-safe:animate-ga-fila-entra sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-16 font-extrabold text-white">{a.nombre_completo}</span>
                  <span className="text-13 text-admin-texto-3">Cédula {a.cedula}</span>
                </div>
                <span className="text-14 text-admin-texto-2">
                  {a.clientes} {a.clientes === 1 ? "cliente" : "clientes"} · {a.afiliaciones}{" "}
                  {a.afiliaciones === 1 ? "afiliación referida" : "afiliaciones referidas"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {/* TODO(pendiente-spec): desactivar un asesor. No hay columna «activo» en
            perfiles ni mecanismo descrito en la spec para esto; falta confirmar con
            la cooperativa cómo debe comportarse (¿deja de aparecer en el desplegable
            de /afiliacion? ¿se reasignan sus clientes?). La pieza 3f del lienzo
            confirma que tampoco está en el diseño («No incluye "asignar asociados a
            un asesor"»). */}
      </section>
    </AdminShell>
  );
}
