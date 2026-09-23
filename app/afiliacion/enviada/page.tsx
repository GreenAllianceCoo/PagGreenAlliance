import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AfiliacionEnviada } from "@/components/pantallas/AfiliacionEnviada";
import { leerFlashAfiliacion } from "@/lib/afiliacion/flash";
import { DIAS_RESPUESTA } from "@/lib/config";

export const metadata: Metadata = {
  title: "Solicitud enviada · Cooperativa Green Alliance",
};

export default async function AfiliacionEnviadaPage() {
  // Correo enmascarado del envío (cookie de 10 min). Si se entra directo → /afiliacion.
  const correoEnmascarado = await leerFlashAfiliacion();
  if (!correoEnmascarado) redirect("/afiliacion");

  // TODO(pendiente-spec): DIAS_RESPUESTA real (hoy «[N]»).
  return <AfiliacionEnviada correoEnmascarado={correoEnmascarado} diasRespuesta={DIAS_RESPUESTA} />;
}
