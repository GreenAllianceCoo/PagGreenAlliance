import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { enviarConRespaldo } from "@/lib/correo/resend";

/**
 * Ingreso aceptado (docs/resend-plantillas.md §1). §13.4: plantilla
 * `RESEND_TEMPLATE_INGRESO_ACEPTADO` con respaldo en texto plano. Va SOLO al
 * correo personal (lleva la cédula, RS-02). No bloquea ni lanza.
 */
export async function enviarIngresoAceptado(datos: {
  id: string;
  nombre: string;
  cedula: string;
  correo: string[];
  urlIngreso: string;
}) {
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_INGRESO_ACEPTADO",
      variables: { NOMBRE: datos.nombre, CEDULA: datos.cedula, URL_INGRESO: datos.urlIngreso },
      asunto: "Tu afiliación a Green Alliance fue aceptada",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        "Tu solicitud de afiliación fue aceptada. Para ingresar usa tu cédula; te enviaremos un código a este correo.",
        `Cédula: ${datos.cedula}`,
        "",
        datos.urlIngreso,
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    // La cuenta ya quedó creada: el correo no bloquea la aprobación (spec §Afiliaciones).
    registrar("error", {
      evento: "ingreso_aceptado_correo_fallo",
      mensaje: error instanceof Error ? error.message : String(error),
      solicitud_id: datos.id,
    });
  }
}
