import type { Metadata } from "next";
import { connection } from "next/server";
import { asesoresParaAfiliacion } from "@/lib/afiliacion/asesores";
import { gradosParaAfiliacion } from "@/lib/grados";
import { FormularioAfiliacion } from "./FormularioAfiliacion";

export const metadata: Metadata = {
  title: "Quiero afiliarme · Cooperativa Green Alliance",
};

export default async function AfiliacionPage() {
  // Se genera en cada visita (no en el build): los grados salen del catálogo
  // `grados` (con su institución) y los asesores de `obtener_asesores_publico()`
  // (asesores + admins que atienden asociados, spec-requerimientos-ricardo §2.9).
  await connection();
  const [grados, asesores] = await Promise.all([gradosParaAfiliacion(), asesoresParaAfiliacion()]);
  return <FormularioAfiliacion grados={grados} asesores={asesores} />;
}
