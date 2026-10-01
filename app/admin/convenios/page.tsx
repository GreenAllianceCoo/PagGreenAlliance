import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { GestorConvenios } from "@/components/admin/GestorConvenios";
import { exigirAdmin } from "@/lib/admin/servidor";
import { listarConveniosAdmin } from "@/lib/admin/convenios";

export const metadata: Metadata = { title: "Convenios · Admin · Green Alliance" };

/** Convenios administrables (5.9 / P-68): lista, crear, editar, ocultar, ordenar, eliminar y logo. */
export default async function ConveniosAdminPage() {
  const { supabase, nombre } = await exigirAdmin();
  const { convenios, error } = await listarConveniosAdmin(supabase);

  return (
    <AdminShell nombre={nombre} seccion="convenios">
      {error ? (
        <p role="alert" className="m-0 text-14 font-semibold text-admin-rojo-2">
          No pudimos cargar los convenios. Recarga la página.
        </p>
      ) : null}
      <GestorConvenios convenios={convenios} />
    </AdminShell>
  );
}
