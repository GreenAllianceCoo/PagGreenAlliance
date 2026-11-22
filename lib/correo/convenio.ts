import "server-only";
import { enviarConRespaldo } from "@/lib/correo/resend";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";

/**
 * «Ya puedes publicar en Green Alliance»: llega al correo de acceso de la
 * empresa en convenio cuando el admin crea o cambia su acceso
 * (docs/spec-convenios.md §B2). Plantilla opcional
 * `RESEND_TEMPLATE_CONVENIO_ACCESO` con respaldo en texto plano. No bloquea ni lanza.
 */
export async function avisarAccesoConvenio(datos: { convenioId: string; nombre: string; correo: string }) {
  const enlace = await urlDelSitio("/ingresar/convenio").catch(() => "https://www.greenallianceco.com/ingresar/convenio");
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_CONVENIO_ACCESO",
      variables: { NOMBRE_EMPRESA: datos.nombre, URL_INGRESO: enlace },
      asunto: "Ya puedes publicar en Green Alliance",
      texto: [
        `Hola, equipo de ${datos.nombre}:`,
        "",
        "Green Alliance activó el acceso de su empresa. Desde ahora pueden publicar promociones y catálogos para nuestros asociados.",
        "",
        "Para entrar, escriban el NIT de la empresa y les enviaremos un código de 6 números a este correo:",
        enlace,
        "",
        "Si no esperaban este mensaje, escríbannos por WhatsApp.",
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    registrar("error", {
      evento: "convenio_acceso_correo_fallo",
      convenio_id: datos.convenioId,
      mensaje: (error instanceof Error ? error.message : String(error)).replace(/[^\s<>"]+@[^\s<>"]+/g, "[correo]"),
    });
  }
}
