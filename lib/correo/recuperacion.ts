import "server-only";
import { enviarConRespaldo, enviarCorreoTexto } from "@/lib/correo/resend";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Correos de la recuperación de acceso.
 *  - Aviso a los admins de una solicitud nueva: SIN datos sensibles (solo el
 *    nombre en el cuerpo; ni cédula, ni correos, ni celular, ni motivo).
 *  - «Tu correo de ingreso cambió»: al correo anterior y al nuevo, texto plano
 *    (enviarConRespaldo con la variable de plantilla opcional
 *    RESEND_TEMPLATE_CORREO_CAMBIADO; sin ella cae a texto con el mismo contenido).
 * Ninguna función lanza: si falla, se registra y el flujo de negocio sigue.
 */

const una = (texto: string) => texto.replace(/[\r\n]+/g, " ").trim();

/** Aviso interno a los admins (texto simple, como el de alertas). */
export async function avisarAdminsDeRecuperacion(nombre: string) {
  try {
    const { data, error } = await crearClienteAdmin().rpc("correos_admins");
    if (error) throw error;
    const correos = ((data ?? []) as { correo: string | null }[])
      .map((f) => (f.correo ?? "").trim().toLowerCase())
      .filter((c) => c.includes("@"));
    if (correos.length === 0) {
      registrar("warn", { evento: "recuperacion_admin_sin_destinatarios" });
      return;
    }
    await enviarCorreoTexto({
      para: [...new Set(correos)],
      asunto: "Nueva solicitud de recuperación de acceso",
      texto: [
        `${una(nombre)} pidió recuperar el acceso a su cuenta (ya no tiene acceso a su correo de ingreso).`,
        "",
        "Verifica su identidad por otro medio (llamada o WhatsApp al número que ya tenías) antes de cambiar el correo.",
        `Revisa la solicitud en ${await urlDelSitio("/admin/alertas")}`,
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  } catch (e) {
    registrar("error", {
      evento: "recuperacion_admin_correo_fallo",
      mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
  }
}

/**
 * «Tu correo de ingreso cambió»: avisa al correo anterior y al nuevo, cada uno
 * con su texto. Nunca incluye el otro correo ni la cédula.
 */
export async function avisarCambioCorreoIngreso({
  nombre,
  anterior,
  nuevo,
}: {
  nombre: string;
  anterior: string | null;
  nuevo: string;
}) {
  const enlace = await urlDelSitio("/ingresar").catch(() => "https://www.greenallianceco.com/ingresar");
  const asunto = "Tu correo de ingreso cambió";
  const envios: { para: string; texto: string }[] = [
    {
      para: nuevo,
      texto: [
        `Hola, ${una(nombre)}.`,
        "",
        "Este correo quedó registrado como tu correo de ingreso a Green Alliance. Desde ahora el código para entrar te llegará aquí.",
        "",
        `Ingresa con tu cédula en ${enlace}`,
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    },
  ];
  if (anterior && anterior.toLowerCase() !== nuevo.toLowerCase()) {
    envios.unshift({
      para: anterior,
      texto: [
        `Hola, ${una(nombre)}.`,
        "",
        "El correo con el que ingresas a Green Alliance acaba de cambiar. Desde ahora el código para entrar ya no llegará a este correo.",
        "",
        "Si no fuiste tú ni la cooperativa quien lo pidió, escríbenos de inmediato por WhatsApp.",
        "",
        "Cooperativa Green Alliance",
      ].join("\n"),
    });
  }

  for (const envio of envios) {
    try {
      await enviarConRespaldo({
        para: envio.para,
        variablePlantilla: "RESEND_TEMPLATE_CORREO_CAMBIADO",
        variables: { NOMBRE: una(nombre), URL_INGRESO: enlace },
        asunto,
        texto: envio.texto,
      });
    } catch (e) {
      registrar("error", {
        evento: "cambio_correo_aviso_fallo",
        mensaje: (e instanceof Error ? e.message : String(e)).replace(/[^\s<>"]+@[^\s<>"]+/g, "[correo]"),
      });
    }
  }
}
