import type { Metadata } from "next";
import { IngresoCodigo } from "@/components/pantallas/IngresoCodigo";
import { WHATSAPP_NUMERO } from "@/lib/config";
import { CORREO_ENMASCARADO_EJEMPLO, OTP_EJEMPLO, TIEMPO_REENVIO_EJEMPLO } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Escribe el código · Cooperativa Green Alliance",
};

export default function IngresarCodigoPage() {
  // TODO(funcionalidad): leer el correo enmascarado de la cookie del paso 1;
  // si no hay cookie → redirect("/ingresar"). Quitar los datos de ejemplo.
  return (
    <IngresoCodigo
      correoEnmascarado={CORREO_ENMASCARADO_EJEMPLO}
      whatsapp={WHATSAPP_NUMERO}
      digitos={OTP_EJEMPLO}
      tiempoReenvio={TIEMPO_REENVIO_EJEMPLO}
    />
  );
}
