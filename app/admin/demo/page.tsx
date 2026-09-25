import type { Metadata } from "next";
import { CuentaDemo } from "@/components/asesor/CuentaDemo";
import { EncabezadoAdmin } from "@/components/admin/EncabezadoAdmin";
import { exigirAdmin } from "@/lib/admin/servidor";
import { cargarPaquetesDemo } from "@/lib/asesor/cargarPaquetesDemo";

export const metadata: Metadata = {
  title: "Demostración · Panel de administración · Cooperativa Green Alliance",
};

/**
 * Cuenta de demostración para los administradores: la misma «cuenta
 * fantasma» de /asesor/demo (se ve como /cuenta de un asociado, con selector
 * de grado), para mostrar la plataforma sin usar datos reales. No guarda
 * nada: solo LEE `grados_credito`.
 */
export default async function AdminDemoPage() {
  const { supabase, nombre } = await exigirAdmin();
  const paquetesPorGrado = await cargarPaquetesDemo(supabase, "admin_demo_grados_fallo");

  return (
    <CuentaDemo
      nombreAsesor={nombre}
      paquetesPorGrado={paquetesPorGrado}
      encabezado={<EncabezadoAdmin nombre={nombre} seccion="demo" />}
      volver={{ href: "/admin", texto: "Volver al panel" }}
    />
  );
}
