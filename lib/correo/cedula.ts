import "server-only";
import { enviarConRespaldo } from "@/lib/correo/resend";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";

/**
 * «Tu cédula de ingreso cambió» («Corregir cédula» del admin). Solo al correo
 * PERSONAL (lleva la cédula nueva, como el correo de ingreso aceptado, RS-02).
 * NUNCA lleva el motivo (nota interna). Plantilla opcional
 * `RESEND_TEMPLATE_CEDULA_CAMBIADA` con respaldo en texto plano. No bloquea ni lanza.
 */
export async function avisarCambioCedula(datos: { asociadoId: string; nombre: string; correo: string[]; cedula: string }) {
  const enlace = await urlDelSitio("/ingresar").catch(() => "https://www.greenallianceco.com/ingresar");
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_CEDULA_CAMBIADA",
      variables: { NOMBRE: datos.nombre, CEDULA: datos.cedula, URL_INGRESO: enlace },
      asunto: "Actualizamos la cédula con la que ingresas a Green Alliance",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        "La cooperativa corrigió la cédula con la que ingresas a tu cuenta. Desde ahora ingresa con esta:",
        `Cédula: ${datos.cedula}`,
        "",
        enlace,
        "",
        "Si no pediste este cambio, escríbenos de inmediato por WhatsApp.",
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    registrar("error", {
      evento: "cedula_cambiada_correo_fallo",
      asociado_id: datos.asociadoId,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}
