import type { Metadata } from "next";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "@/lib/config";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = {
  title: "Ingresar · Cooperativa Green Alliance",
};

// Ingreso paso 1 (reemplaza a /login, que queda intacta por ahora).
// Con sesión activa, proxy.ts redirige a /cuenta antes de llegar aquí.
export default function IngresarPage() {
  return <FormularioIngreso whatsapp={WHATSAPP_NUMERO} whatsappUrl={WHATSAPP_URL} />;
}
