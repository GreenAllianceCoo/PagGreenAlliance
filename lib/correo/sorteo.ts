import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { enviarPlantillaResend } from "@/lib/correo/resend";

/**
 * Correo con el número de boleta del sorteo mensual (docs/resend-plantillas.md
 * §4). El número SOLO sale de aquí (correo) o del registro estructurado del
 * servidor para poder probar en local: nunca se devuelve al navegador
 * (spec-fase-2.md §4, "El número que devuelve la función solo lo ve el
 * servidor").
 */
export async function enviarBoletaSorteo(datos: { correo: string; nombre: string; numero: string; mes: string }) {
  const plantilla = process.env.RESEND_TEMPLATE_SORTEO_BOLETA;

  // S-05 (revisión de seguridad 2026-09-24): el número SOLO se registra fuera
  // de producción. En Vercel/producción, next.config.mjs ya exige
  // RESEND_TEMPLATE_SORTEO_BOLETA (y RESEND_API_KEY/EMAIL_FROM) en el build,
  // así que este "sin plantilla" no debería poder pasar ahí; aun así, por si
  // Resend falla en tiempo de ejecución, nunca se deja el número en un log
  // que pueda terminar en una herramienta de monitoreo de terceros.
  const esProduccion = process.env.NODE_ENV === "production";

  if (!plantilla) {
    // Resend no está configurado (típico en local): se registra el número
    // para poder probar el flujo igual, pero jamás se muestra en la interfaz.
    registrar("info", {
      evento: "sorteo_boleta_no_enviada_sin_plantilla",
      mes: datos.mes,
      ...(esProduccion ? {} : { numero: datos.numero }),
    });
    return;
  }

  try {
    await enviarPlantillaResend({
      para: datos.correo,
      plantilla,
      variables: { NOMBRE: datos.nombre, NUMERO_BOLETA: datos.numero, MES: datos.mes },
    });
  } catch (error) {
    // Tampoco aquí se pierde la posibilidad de probar en local si Resend
    // falla por falta de llave: se deja el número en el registro (nunca en producción).
    registrar("error", {
      evento: "sorteo_boleta_correo_fallo",
      mes: datos.mes,
      mensaje: error instanceof Error ? error.message : String(error),
      ...(esProduccion ? {} : { numero: datos.numero }),
    });
  }
}
