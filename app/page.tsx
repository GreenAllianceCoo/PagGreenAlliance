import { Landing } from "@/components/pantallas/Landing";
import { CORREO_CONTACTO, TEXTO_VIGILANCIA, WHATSAPP_NUMERO } from "@/lib/config";
import { CONVENIOS } from "@/lib/convenios";
import { ESTADISTICAS_EJEMPLO, TESTIMONIOS_EJEMPLO } from "@/lib/mock";

export default function Home() {
  // Convenios fijos (decisión del 23-sep): no se leen de la tabla `convenios`.
  // TODO(pendiente-spec): cifras y testimonios reales.
  return (
    <Landing
      estadisticas={ESTADISTICAS_EJEMPLO}
      testimonios={TESTIMONIOS_EJEMPLO}
      convenios={CONVENIOS}
      whatsapp={WHATSAPP_NUMERO}
      correo={CORREO_CONTACTO}
      textoVigilancia={TEXTO_VIGILANCIA}
    />
  );
}
