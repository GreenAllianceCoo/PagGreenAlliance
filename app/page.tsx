import { Landing } from "@/components/pantallas/Landing";
import { CORREO_CONTACTO, TEXTO_VIGILANCIA, WHATSAPP_NUMERO, WHATSAPP_URL_PIE } from "@/lib/config";
import { cargarConvenios } from "@/lib/conveniosServidor";

// Los convenios salen de la tabla `convenios` (spec-requerimientos-ricardo §4);
// la landing se regenera como máximo cada hora (si la tabla no responde, se
// usan los mismos textos de respaldo de lib/convenios.ts).
export const revalidate = 3600;

export default async function Home() {
  // TODO(pendiente-spec): cifras reales. Sin sección de testimonios (decisión de Sebas, 27-sep).
  // El WhatsApp de cada convenio es solo para asociados: no se manda al navegador en la página pública.
  const convenios = (await cargarConvenios()).map((c) => ({ ...c, whatsappTexto: null, whatsappUrl: null }));
  return (
    <Landing
      convenios={convenios}
      whatsapp={WHATSAPP_NUMERO}
      whatsappUrl={WHATSAPP_URL_PIE}
      correo={CORREO_CONTACTO}
      textoVigilancia={TEXTO_VIGILANCIA}
    />
  );
}
