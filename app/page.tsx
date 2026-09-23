import { Landing } from "@/components/pantallas/Landing";
import { CORREO_CONTACTO, TEXTO_VIGILANCIA, WHATSAPP_NUMERO } from "@/lib/config";
import { CONVENIOS_EJEMPLO, ESTADISTICAS_EJEMPLO, TESTIMONIOS_EJEMPLO } from "@/lib/mock";

export default function Home() {
  // TODO(funcionalidad): cargar convenios desde la tabla `convenios` (emoji, nombre, especialidad).
  // TODO(pendiente-spec): cifras y testimonios reales.
  return (
    <Landing
      estadisticas={ESTADISTICAS_EJEMPLO}
      testimonios={TESTIMONIOS_EJEMPLO}
      convenios={CONVENIOS_EJEMPLO}
      whatsapp={WHATSAPP_NUMERO}
      correo={CORREO_CONTACTO}
      textoVigilancia={TEXTO_VIGILANCIA}
    />
  );
}
