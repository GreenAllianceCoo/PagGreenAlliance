import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "@/lib/config";
import { leerCookieIngreso, segundosParaReenviar } from "@/lib/ingreso/servidor";
import { FormularioCodigo } from "./FormularioCodigo";

export const metadata: Metadata = {
  title: "Escribe el código · Cooperativa Green Alliance",
};

export default async function IngresarCodigoPage() {
  // Sin la cookie del paso 1 (o vencida) no hay a quién verificar: volver a /ingresar.
  const datos = await leerCookieIngreso();
  if (!datos) redirect("/ingresar");

  return (
    <FormularioCodigo
      correoEnmascarado={datos.m}
      whatsapp={WHATSAPP_NUMERO}
      whatsappUrl={WHATSAPP_URL}
      segundosIniciales={segundosParaReenviar(datos)}
    />
  );
}
