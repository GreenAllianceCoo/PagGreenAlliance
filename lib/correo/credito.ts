import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { enviarConRespaldo } from "@/lib/correo/resend";

/**
 * Aviso del resultado. §13.4: si falta `RESEND_TEMPLATE_CREDITO_APROBADO` /
 * `_RECHAZADO` o la plantilla falla, cae a texto plano con el mismo contenido
 * y registra `correo_plantilla_faltante` (sin datos personales).
 */
export async function enviarResultadoCredito(datos: {
  id: string;
  nombre: string;
  /** Solo el correo personal (RS-02, lib/correo/destinatarios.ts). */
  correo: string | string[];
  resultado: "aprobado" | "rechazado";
  monto: number;
  motivo?: string;
}) {
  const aprobado = datos.resultado === "aprobado";
  // Con puntos de miles (1.500.000): la plantilla le antepone «$».
  const monto = Math.round(datos.monto).toLocaleString("es-CO");
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: aprobado ? "RESEND_TEMPLATE_CREDITO_APROBADO" : "RESEND_TEMPLATE_CREDITO_RECHAZADO",
      variables: { NOMBRE: datos.nombre, MONTO: monto, MOTIVO: datos.motivo ?? "" },
      asunto: aprobado
        ? "Tu crédito de Green Alliance fue aprobado"
        : "Respuesta a tu solicitud de crédito de Green Alliance",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        aprobado
          ? `Tu solicitud de crédito por $ ${monto} fue aprobada.`
          : `Tu solicitud de crédito por $ ${monto} no fue aprobada.${datos.motivo ? ` Motivo: ${datos.motivo}` : ""}`,
        "",
        "Ingresa a tu cuenta para ver el detalle.",
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
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
 * meses). Solo al correo PERSONAL (lleva el monto). Plantilla
 * `RESEND_TEMPLATE_CREDITO_DESEMBOLSADO`, con respaldo en texto plano.
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
  /** El admin subió el comprobante de la transferencia: el correo avisa que está en su cuenta. */
  conComprobante?: boolean;
}) {
  const monto = Math.round(datos.monto).toLocaleString("es-CO");
  const textoComprobante = datos.conComprobante ? "El comprobante de la transferencia ya está disponible en tu cuenta." : "";
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_CREDITO_DESEMBOLSADO",
      // COMPROBANTE solo viaja cuando hay comprobante (la plantilla de Resend puede incluir {{{COMPROBANTE}}}).
      variables: {
        NOMBRE: datos.nombre,
        MONTO: monto,
        FECHA: datos.fechaTexto,
        ...(datos.conComprobante ? { COMPROBANTE: textoComprobante } : {}),
      },
      asunto: "Tu crédito de Green Alliance fue desembolsado",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        `Tu crédito por $ ${monto} fue desembolsado el ${datos.fechaTexto}. Desde esa fecha empieza a contar tu plazo de 3 meses.`,
        ...(textoComprobante ? ["", textoComprobante] : []),
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    registrar("error", {
      evento: "credito_desembolso_correo_fallo",
      solicitud_id: datos.id,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * §13.2: aviso al asociado de que ya puede pedir un nuevo crédito. Solo al
 * correo PERSONAL. NUNCA lleva el motivo (nota interna del admin). Plantilla
 * opcional `RESEND_TEMPLATE_CREDITO_HABILITADO` con respaldo en texto plano.
 */
export async function enviarCreditoHabilitado(datos: { id: string; nombre: string; correo: string[] }) {
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_CREDITO_HABILITADO",
      variables: { NOMBRE: datos.nombre },
      asunto: "Ya puedes solicitar un nuevo crédito en Green Alliance",
      texto: [
        `Hola ${datos.nombre},`,
        "",
        "La cooperativa habilitó tu cuenta para que puedas hacer una nueva solicitud de crédito. Ingresa a tu cuenta y elige «Nueva solicitud».",
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (error) {
    registrar("error", {
      evento: "credito_habilitado_correo_fallo",
      asociado_id: datos.id,
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }
}
