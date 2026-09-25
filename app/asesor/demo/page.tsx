import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CuentaDemo } from "@/components/asesor/CuentaDemo";
import { cargarPaquetesDemo } from "@/lib/asesor/cargarPaquetesDemo";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesionAsesor } from "../actions";

export const metadata: Metadata = {
  title: "Cuenta de demostración · Cooperativa Green Alliance",
};

/**
 * Cuenta de demostración del asesor (spec-fase-2.md §5): «cuenta fantasma»
 * para mostrarle la plataforma a un cliente. Nunca inserta ni actualiza
 * nada: solo LEE `grados_credito` (tabla de referencia, no de un cliente).
 * Misma protección de rol que /asesor. El admin tiene la suya en /admin/demo.
 */
export default async function AsesorDemoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "asesor") {
    redirect(perfil ? "/cuenta" : "/ingresar");
  }

  const paquetesPorGrado = await cargarPaquetesDemo(supabase, "asesor_demo_grados_fallo");

  return (
    <CuentaDemo
      nombreAsesor={perfil.nombre_completo ?? "Asesor"}
      paquetesPorGrado={paquetesPorGrado}
      accionSalir={cerrarSesionAsesor}
    />
  );
}
