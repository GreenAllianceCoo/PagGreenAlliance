import { Landing } from "@/components/pantallas/Landing";
import { CORREO_CONTACTO, TEXTO_VIGILANCIA, WHATSAPP_NUMERO } from "@/lib/config";
import { cargarConvenios } from "@/lib/conveniosServidor";
import { ESTADISTICAS_EJEMPLO } from "@/lib/mock";

// Los convenios salen de la tabla `convenios` (spec-requerimientos-ricardo §4);
// la landing se regenera como máximo cada hora (si la tabla no responde, se
// usan los mismos textos de respaldo de lib/convenios.ts).
export const revalidate = 3600;

export default async function Home() {
  // TODO(pendiente-spec): cifras reales. Sin sección de testimonios (decisión de Sebas, 27-sep).
  const convenios = await cargarConvenios();
  return (
    <Landing
      estadisticas={ESTADISTICAS_EJEMPLO}
      convenios={convenios}
      whatsapp={WHATSAPP_NUMERO}
      correo={CORREO_CONTACTO}
      textoVigilancia={TEXTO_VIGILANCIA}
    />
  );
}
