import type { Metadata } from "next";
import { MENSAJE_CUENTA_INACTIVA, PARAMETRO_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "@/lib/config";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = {
  title: "Ingresar · Cooperativa Green Alliance",
};

// Ingreso paso 1.
// Con sesión activa, proxy.ts redirige a /cuenta antes de llegar aquí.
export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  // §12.6: /api/cuenta-inactiva cierra la sesión y manda aquí con ?cuenta=inactiva.
  const { cuenta } = await searchParams;
  return (
    <FormularioIngreso
      whatsapp={WHATSAPP_NUMERO}
      whatsappUrl={WHATSAPP_URL}
      aviso={cuenta === PARAMETRO_CUENTA_INACTIVA ? MENSAJE_CUENTA_INACTIVA : undefined}
    />
  );
}
