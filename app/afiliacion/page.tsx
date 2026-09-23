import type { Metadata } from "next";
import { Afiliacion } from "@/components/pantallas/Afiliacion";
import { GRADOS_EJEMPLO } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Quiero afiliarme · Cooperativa Green Alliance",
};

export default function AfiliacionPage() {
  // TODO(funcionalidad): cargar los grados desde la tabla `grados_credito`.
  return <Afiliacion grados={GRADOS_EJEMPLO} />;
}
