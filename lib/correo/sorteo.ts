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

  if (!plantilla) {
    // Resend no está configurado (típico en local): se registra el número
    // para poder probar el flujo igual, pero jamás se muestra en la interfaz.
    registrar("info", {
      evento: "sorteo_boleta_no_enviada_sin_plantilla",
      numero: datos.numero,
      mes: datos.mes,
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
    // falla por falta de llave: se deja el número en el registro.
    registrar("error", {
      evento: "sorteo_boleta_correo_fallo",
      numero: datos.numero,
      mes: datos.mes,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}
