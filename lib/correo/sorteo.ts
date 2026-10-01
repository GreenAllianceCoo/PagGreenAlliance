import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { enviarConRespaldo } from "@/lib/correo/resend";

/**
 * Correo con el número de boleta del sorteo mensual (docs/resend-plantillas.md
 * §4). El número SOLO sale por correo (plantilla o, si falta/falla, texto
 * plano con el mismo contenido) o, fuera de producción, en el registro del
 * servidor; nunca se devuelve al navegador (spec-fase-2.md §4).
 */
export async function enviarBoletaSorteo(datos: { correo: string | string[]; nombre: string; numero: string; mes: string }) {
  // S-05: en producción el número jamás se deja en un log que pueda ir a monitoreo de terceros.
  const esProduccion = process.env.NODE_ENV === "production";
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_SORTEO_BOLETA",
      variables: { NOMBRE: datos.nombre, NUMERO_BOLETA: datos.numero, MES: datos.mes },
      asunto: "Tu boleta del sorteo de Green Alliance",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        `Tu número de boleta para el sorteo de ${datos.mes} es ${datos.numero}.`,
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    // Local sin llave de Resend: se deja el número en el registro para probar (nunca en producción).
    registrar("error", {
      evento: "sorteo_boleta_correo_fallo",
      mes: datos.mes,
      mensaje: error instanceof Error ? error.message : String(error),
      ...(esProduccion ? {} : { numero: datos.numero }),
    });
  }
}

/**
 * §12.10: aviso al ganador del sorteo del mes. Plantilla
 * `RESEND_TEMPLATE_SORTEO_GANADOR` con respaldo en texto plano. No lleva el
 * número de boleta ni la cédula. No bloquea ni lanza.
 */
export async function enviarGanadorSorteo(datos: { correo: string | string[]; nombre: string; mes: string }) {
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_SORTEO_GANADOR",
      variables: { NOMBRE: datos.nombre, MES: datos.mes },
      asunto: "¡Ganaste el sorteo de Green Alliance!",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        `Fuiste elegido como ganador del sorteo de ${datos.mes}. La cooperativa se pondrá en contacto contigo.`,
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    registrar("error", {
      evento: "sorteo_ganador_correo_fallo",
      mes: datos.mes,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}
