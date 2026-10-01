import type { Metadata } from "next";
import { CuentaDemo } from "@/components/asesor/CuentaDemo";
import { cargarPaquetesDemo } from "@/lib/asesor/cargarPaquetesDemo";
import { cargarCatalogoGrados } from "@/lib/grados";
import { exigirAsesor } from "@/lib/asesor/servidor";
import { cerrarSesionAsesor } from "../actions";

export const metadata: Metadata = {
  title: "Cuenta de demostración · Cooperativa Green Alliance",
};

/**
 * Cuenta de demostración del asesor (spec-fase-2.md §5; simulador para
 * capacitar, spec-requerimientos-ricardo §5.3): «cuenta fantasma» para
 * mostrarle la plataforma a un cliente. Nunca inserta ni actualiza nada:
 * solo LEE `grados_credito` (tabla de referencia, no de un cliente).
 * Misma protección que /asesor (asesor, o admin que atiende asociados).
 */
export default async function AsesorDemoPage() {
  const { supabase, nombre } = await exigirAsesor();

  // §13.3: grados por institución (catálogo público) + cupos/tasa por grupo (RPC solo asesor/admin).
  const [paquetesPorGrado, catalogoGrados] = await Promise.all([
    cargarPaquetesDemo(supabase, "asesor_demo_grados_fallo"),
    cargarCatalogoGrados(supabase),
  ]);

  return (
    <CuentaDemo
      nombreAsesor={nombre}
      paquetesPorGrado={paquetesPorGrado}
      catalogoGrados={catalogoGrados}
      accionSalir={cerrarSesionAsesor}
    />
  );
}
