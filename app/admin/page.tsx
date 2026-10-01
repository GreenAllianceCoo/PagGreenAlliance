import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { ResumenAdmin } from "@/components/admin/ResumenAdmin";
import { contarAlertasPendientes } from "@/lib/admin/alertas";
import { cargarMetricasAdmin } from "@/lib/admin/metricas";
import { exigirAdmin } from "@/lib/admin/servidor";

export const metadata: Metadata = { title: "Resumen · Admin · Green Alliance" };

/** Dashboard «Resumen de clientes» (pieza 3r, actividad 4.7). */
export default async function AdminPage() {
  const { supabase, nombre } = await exigirAdmin();
  const [metricas, alertasPendientes] = await Promise.all([
    cargarMetricasAdmin(supabase),
    contarAlertasPendientes(supabase),
  ]);
  return (
    <AdminShell nombre={nombre} seccion="resumen">
      <ResumenAdmin metricas={metricas} alertasPendientes={alertasPendientes} />
    </AdminShell>
  );
}
