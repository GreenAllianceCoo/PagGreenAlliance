import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CuentaDemo } from "@/components/asesor/CuentaDemo";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";
import { GRADOS, PAQUETES_DEMO, type CodigoGrado, type PaqueteDemo } from "@/lib/asesor/datosDemo";
import { cerrarSesionAsesor } from "../actions";

export const metadata: Metadata = {
  title: "Cuenta de demostración · Cooperativa Green Alliance",
};

/**
 * Cuenta de demostración del asesor (spec-fase-2.md §5): «cuenta fantasma»
 * para mostrarle la plataforma a un cliente. Nunca inserta ni actualiza
 * nada: solo LEE `grados_credito` (tabla de referencia, no de un cliente).
 * Misma protección de rol que /asesor.
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

  const { data: filas, error } = await supabase
    .from("grados_credito")
    .select("grado, porcentaje, capacidad_maxima, tasa_interes_mensual, plazo_meses")
    .order("grado", { ascending: true })
    .order("porcentaje", { ascending: true });

  if (error) {
    registrar("error", { evento: "asesor_demo_grados_fallo", codigo: error.code, mensaje: error.message });
  }

  const paquetesPorGrado = { ...PAQUETES_DEMO } as Record<CodigoGrado, PaqueteDemo[]>;
  if (filas && filas.length > 0) {
    const agrupados = {} as Record<CodigoGrado, PaqueteDemo[]>;
    for (const fila of filas) {
      const grado = fila.grado as CodigoGrado;
      if (!GRADOS.includes(grado)) continue;
      (agrupados[grado] ??= []).push({
        porcentaje: fila.porcentaje as "50" | "100",
        capacidad_maxima: Number(fila.capacidad_maxima),
        tasa_interes_mensual: Number(fila.tasa_interes_mensual),
        plazo_meses: Number(fila.plazo_meses),
      });
    }
    // Solo se reemplaza la copia local por grados que sí trajo la base.
    Object.assign(paquetesPorGrado, agrupados);
  }

  return (
    <CuentaDemo
      nombreAsesor={perfil.nombre_completo ?? "Asesor"}
      paquetesPorGrado={paquetesPorGrado}
      accionSalir={cerrarSesionAsesor}
    />
  );
}
