import type { Metadata } from "next";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "@/lib/config";
import { FormularioIngresoNit } from "./FormularioIngresoNit";

export const metadata: Metadata = {
  title: "Ingreso de empresas en convenio · Cooperativa Green Alliance",
};

// Ingreso de la empresa en convenio, paso 1 (NIT). El paso 2 es /ingresar/codigo.
// Con sesión activa, proxy.ts redirige antes de llegar aquí.
export default function IngresarConvenioPage() {
  return <FormularioIngresoNit whatsapp={WHATSAPP_NUMERO} whatsappUrl={WHATSAPP_URL} />;
}
