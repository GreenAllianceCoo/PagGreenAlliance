import type { Metadata } from "next";
import { IngresoCedula } from "@/components/pantallas/IngresoCedula";
import { WHATSAPP_NUMERO } from "@/lib/config";

export const metadata: Metadata = {
  title: "Ingresar · Cooperativa Green Alliance",
};

// Nueva ruta de ingreso (reemplaza a /login, que queda intacta por ahora).
export default function IngresarPage() {
  return <IngresoCedula whatsapp={WHATSAPP_NUMERO} />;
}
