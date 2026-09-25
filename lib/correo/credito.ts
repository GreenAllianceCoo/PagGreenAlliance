import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { enviarPlantillaResend } from "@/lib/correo/resend";

/** Aviso del resultado. Se conecta al flujo administrativo cuando esté implementado. */
export async function enviarResultadoCredito(datos: {
  id: string;
  nombre: string;
  correo: string;
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
