import type { Metadata } from "next";
import { AfiliacionEnviada } from "@/components/pantallas/AfiliacionEnviada";
import { DIAS_RESPUESTA } from "@/lib/config";
import { CORREO_ENMASCARADO_EJEMPLO } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Solicitud enviada · Cooperativa Green Alliance",
};

export default function AfiliacionEnviadaPage() {
  // TODO(funcionalidad): leer el correo enmascarado de la cookie/flash del envío;
  // si se entra directo sin enviar → redirect("/afiliacion").
  return (
    <AfiliacionEnviada correoEnmascarado={CORREO_ENMASCARADO_EJEMPLO} diasRespuesta={DIAS_RESPUESTA} />
  );
}
