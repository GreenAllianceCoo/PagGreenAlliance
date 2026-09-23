import type { Metadata } from "next";
import { connection } from "next/server";
import { gradosParaAfiliacion } from "@/lib/grados";
import { FormularioAfiliacion } from "./FormularioAfiliacion";

export const metadata: Metadata = {
  title: "Quiero afiliarme · Cooperativa Green Alliance",
};

export default async function AfiliacionPage() {
  // Se genera en cada visita (no en el build): los grados salen de `grados_credito`.
  await connection();
  const grados = await gradosParaAfiliacion();
  return <FormularioAfiliacion grados={grados} />;
}
