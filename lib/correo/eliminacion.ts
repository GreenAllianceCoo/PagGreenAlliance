import "server-only";
import { enviarConRespaldo } from "@/lib/correo/resend";
import { registrar } from "@/lib/servidor/registro";
import { VIDA_CODIGO_ELIMINACION_MINUTOS } from "@/lib/eliminacion";

/**
 * Código de confirmación para «Eliminar definitivamente», al correo del ADMIN que
 * lo pide (no al asociado). No lleva el nombre ni ningún dato del asociado: solo el
 * código y su vigencia. Plantilla opcional `RESEND_TEMPLATE_CODIGO_ELIMINACION`
 * (variables NOMBRE, CODIGO, MINUTOS) con respaldo en texto plano (§13.4).
 *
 * Devuelve true si salió el correo. En desarrollo local sin RESEND_API_KEY no hay
 * cómo enviarlo: se da por enviado (el código existe solo en la base) para poder
 * probar el flujo; en producción, sin llave, devuelve false y no se crea el pedido.
 */
export async function enviarCodigoEliminacion(datos: {
  correo: string;
  nombreAdmin: string;
  codigo: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === "development") {
    registrar("warn", { evento: "eliminacion_codigo_sin_resend_dev" });
    return true;
  }
  try {
    await enviarConRespaldo({
      para: datos.correo,
      variablePlantilla: "RESEND_TEMPLATE_CODIGO_ELIMINACION",
      variables: { NOMBRE: datos.nombreAdmin, CODIGO: datos.codigo, MINUTOS: VIDA_CODIGO_ELIMINACION_MINUTOS },
      asunto: "Código para confirmar la eliminación de un asociado",
      texto: [
        `Hola ${datos.nombreAdmin},`,
        "",
        "Pediste eliminar definitivamente a un asociado de Green Alliance. Para confirmarlo, escribe este código:",
        "",
        datos.codigo,
        "",
        `Vence en ${VIDA_CODIGO_ELIMINACION_MINUTOS} minutos y se puede intentar 3 veces. La eliminación no se puede deshacer.`,
        "Si no fuiste tú, ignora este mensaje: sin el código no se elimina a nadie. Y avisa al equipo técnico.",
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
    return true;
  } catch (error) {
    registrar("error", {
      evento: "eliminacion_codigo_correo_fallo",
      mensaje: error instanceof Error ? error.message.replace(/[^\s<>"]+@[^\s<>"]+/g, "[correo]") : "desconocido",
    });
    return false;
  }
}
