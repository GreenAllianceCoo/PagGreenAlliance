import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { enviarCorreoTexto, enviarPlantillaResend } from "@/lib/correo/resend";

/** Aviso del resultado. Se conecta al flujo administrativo cuando esté implementado. */
export async function enviarResultadoCredito(datos: {
  id: string;
  nombre: string;
  /** Solo el correo personal (RS-02, lib/correo/destinatarios.ts). */
  correo: string | string[];
  resultado: "aprobado" | "rechazado";
  monto: number;
  motivo?: string;
}) {
  const plantilla = datos.resultado === "aprobado"
    ? process.env.RESEND_TEMPLATE_CREDITO_APROBADO
    : process.env.RESEND_TEMPLATE_CREDITO_RECHAZADO;

  if (!plantilla) {
    registrar("error", {
      evento: "credito_resultado_no_enviado",
      motivo: "falta_plantilla",
      resultado: datos.resultado,
      solicitud_id: datos.id,
    });
    return;
  }

  try {
    await enviarPlantillaResend({
      para: datos.correo,
      plantilla,
      variables: {
        NOMBRE: datos.nombre,
        // Con puntos de miles (1.500.000): la plantilla le antepone «$».
        MONTO: Math.round(datos.monto).toLocaleString("es-CO"),
        MOTIVO: datos.motivo ?? "",
      },
    });
  } catch (error) {
    registrar("error", {
      evento: "credito_resultado_correo_fallo",
      resultado: datos.resultado,
      solicitud_id: datos.id,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * §12.2: aviso de que el crédito ya se desembolsó (arranca el conteo de 3
 * meses). Solo al correo PERSONAL (lleva el monto). Usa la plantilla
 * `RESEND_TEMPLATE_CREDITO_DESEMBOLSADO` si existe; si no, texto plano.
 * No bloquea ni lanza.
 */
export async function enviarDesembolsoCredito(datos: {
  id: string;
  nombre: string;
  correo: string[];
  monto: number;
  /** AAAA-MM-DD */
  fecha: string;
  fechaTexto: string;
}) {
  const monto = Math.round(datos.monto).toLocaleString("es-CO");
  const plantilla = process.env.RESEND_TEMPLATE_CREDITO_DESEMBOLSADO;
  try {
    if (plantilla) {
      await enviarPlantillaResend({
        para: datos.correo,
        plantilla,
        variables: { NOMBRE: datos.nombre, MONTO: monto, FECHA: datos.fechaTexto },
      });
    } else {
      await enviarCorreoTexto({
        para: datos.correo,
        asunto: "Tu crédito de Green Alliance fue desembolsado",
        texto: [
          `Hola ${datos.nombre},`,
          "",
          `Tu crédito por $ ${monto} fue desembolsado el ${datos.fechaTexto}. Desde esa fecha empieza a contar tu plazo de 3 meses.`,
          "",
          "Cooperativa Green Alliance",
        ].join("\n"),
      });
    }
  } catch (error) {
    registrar("error", {
      evento: "credito_desembolso_correo_fallo",
      solicitud_id: datos.id,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}
