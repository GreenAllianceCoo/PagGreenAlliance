import type { Metadata } from "next";
import { connection } from "next/server";
import { asesoresParaAfiliacion } from "@/lib/afiliacion/asesores";
import { gradosParaAfiliacion } from "@/lib/grados";
import { FormularioAfiliacion } from "./FormularioAfiliacion";

export const metadata: Metadata = {
  title: "Quiero afiliarme · Cooperativa Green Alliance",
};

export default async function AfiliacionPage() {
  // Se genera en cada visita (no en el build): los grados salen de `grados_credito`
  // y los asesores de `obtener_asesores_publico()` (spec-fase-2 §1).
  await connection();
  const [grados, asesores] = await Promise.all([gradosParaAfiliacion(), asesoresParaAfiliacion()]);
  return <FormularioAfiliacion grados={grados} asesores={asesores} />;
}
