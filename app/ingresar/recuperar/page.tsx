import type { Metadata } from "next";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "@/lib/config";
import { FormularioRecuperacion } from "./FormularioRecuperacion";

export const metadata: Metadata = {
  title: "Recuperar acceso · Cooperativa Green Alliance",
};

// Público: quien ya no tiene acceso a su correo de ingreso pide que la
// cooperativa lo contacte. Con sesión activa, proxy.ts redirige a /cuenta.
export default function RecuperarPage() {
  return <FormularioRecuperacion whatsapp={WHATSAPP_NUMERO} whatsappUrl={WHATSAPP_URL} />;
}
