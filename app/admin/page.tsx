import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResumenAdmin } from "@/components/admin/ResumenAdmin";
import { contarAlertasPendientes } from "@/lib/admin/alertas";
import { cargarMetricasAdmin } from "@/lib/admin/metricas";
import { exigirAdminOSecretario } from "@/lib/admin/servidor";

export const metadata: Metadata = { title: "Resumen · Admin · Green Alliance" };

/** Dashboard «Resumen de clientes» (pieza 3r, actividad 4.7). Lo ven admin y secretario. */
export default async function AdminPage() {
  const { supabase, nombre, rol } = await exigirAdminOSecretario();
  const [metricas, alertasPendientes] = await Promise.all([
    cargarMetricasAdmin(supabase),
    // El secretario no tiene «Alertas»: no se consulta.
    rol === "admin" ? contarAlertasPendientes(supabase) : Promise.resolve(0),
  ]);
  return (
    <AdminShell nombre={nombre} seccion="resumen" rol={rol}>
      <ResumenAdmin metricas={metricas} alertasPendientes={alertasPendientes} soloLectura={rol === "secretario"} />
    </AdminShell>
  );
}
