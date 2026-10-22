import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AvisosAsociados, PausaCuenta } from "@/components/admin/PanelPlataforma";
import { exigirAdmin } from "@/lib/admin/servidor";
import { cargarPlataforma } from "@/lib/admin/plataforma";

export const metadata: Metadata = { title: "Plataforma · Admin · Green Alliance" };

/** Solo admin: pausar el ingreso de asociados y publicar avisos para su próximo ingreso. */
export default async function PlataformaPage() {
  const { supabase, nombre } = await exigirAdmin();
  const { pausa, avisos, error } = await cargarPlataforma(supabase);

  return (
    <AdminShell nombre={nombre} seccion="plataforma">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Plataforma</h1>
      {error || !pausa ? (
        <p role="alert" className="m-0 max-w-[640px] rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar la configuración de la plataforma. Si es la primera vez, falta aplicar la migración
          20261018000000 en la base.
        </p>
      ) : (
        <div className="flex max-w-[640px] flex-col gap-4">
          <PausaCuenta pausa={pausa} />
          <AvisosAsociados avisos={avisos} />
        </div>
      )}
    </AdminShell>
  );
}
