import "server-only";
import { destinatarioAvisoInstitucional } from "@/lib/correo/destinatarios";
import { enviarCorreoTexto, enviarPlantillaResend } from "@/lib/correo/resend";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";

/** Texto fijo del aviso (RS-02): NUNCA lleva cédula, nombre, montos, motivo ni número de boleta. */
export const TEXTO_AVISO_INSTITUCIONAL = "Tienes una novedad en tu cuenta de Green Alliance; ingresa para verla";

/** Asunto fijo del aviso (el mismo de la plantilla `ga-aviso-institucional`). */
export const ASUNTO_AVISO_INSTITUCIONAL = "Novedad en tu cuenta de Green Alliance";

/** Quita correos del mensaje de error de Resend antes de registrarlo (datos personales mínimos, Ley 1581). */
function sinCorreos(error: unknown) {
  const texto = error instanceof Error ? error.message : String(error);
  return texto.replace(/[^\s<>"]+@[^\s<>"]+/g, "[correo]");
}

/** Texto plano de respaldo: mismo contenido que la plantilla, sin ningún dato del asociado. */
function textoDeRespaldo(enlace: string) {
  return [TEXTO_AVISO_INSTITUCIONAL + ".", "", enlace, "", "Cooperativa Green Alliance"].join("\n");
}

/**
 * RS-02: aviso SIN datos al correo institucional. El contenido es siempre el
 * mismo (asunto, frase y enlace al sitio), así que aunque el buzón lo controle
 * el empleador o sea de un tercero, no se filtra nada del asociado.
 *
 * Usa la plantilla publicada en Resend (`RESEND_TEMPLATE_AVISO_INSTITUCIONAL`,
 * docs/resend-plantillas.md §5; su única variable es el enlace al sitio). Si no
 * está configurada, o Resend la rechaza, cae a texto plano con el mismo texto.
 * No bloquea ni lanza: si todo falla, solo se registra (sin el correo en el log).
 */
export async function avisarCorreoInstitucional(
  personal: string | null | undefined,
  institucional: string | null | undefined,
) {
  const para = destinatarioAvisoInstitucional(personal, institucional);
  if (!para) return;

  try {
    const enlace = await urlDelSitio("/ingresar");
    const plantilla = process.env.RESEND_TEMPLATE_AVISO_INSTITUCIONAL;

    if (plantilla) {
      try {
        await enviarPlantillaResend({ para: [para], plantilla, variables: { URL_INGRESO: enlace } });
        return;
      } catch (error) {
        registrar("warn", {
          evento: "aviso_institucional_plantilla_fallo",
          mensaje: sinCorreos(error),
        });
      }
    } else {
      registrar("warn", { evento: "aviso_institucional_sin_plantilla" });
    }

    await enviarCorreoTexto({
      para: [para],
      asunto: ASUNTO_AVISO_INSTITUCIONAL,
      texto: textoDeRespaldo(enlace),
    });
  } catch (error) {
    registrar("error", {
      evento: "aviso_institucional_fallo",
      mensaje: sinCorreos(error),
    });
  }
}
