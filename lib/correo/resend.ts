import "server-only";
import { registrar } from "@/lib/servidor/registro";

type VariablesPlantilla = Record<string, string | number>;

const ENTIDADES_HTML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * S-15: las plantillas usan `{{{VAR}}}` (sin escapar), así que el texto que
 * viene de la base (nombre, motivo del rechazo) se escapa aquí. Si no, un
 * nombre con `<a href=…>` saldría como enlace real en un correo de la cooperativa.
 */
export function escaparVariables(variables: VariablesPlantilla): VariablesPlantilla {
  return Object.fromEntries(
    Object.entries(variables).map(([clave, valor]) => [
      clave,
      typeof valor === "string" ? valor.replace(/[&<>"']/g, (c) => ENTIDADES_HTML[c]) : valor,
    ]),
  );
}

/**
 * Envía una plantilla publicada en Resend sin exponer la llave al cliente.
 * `para` acepta varios correos; los avisos con datos del asociado van SOLO al
 * personal (RS-02, lib/correo/destinatarios.ts).
 */
export async function enviarPlantillaResend({
  para,
  plantilla,
  variables,
  responderA,
}: {
  para: string | string[];
  plantilla: string;
  variables: VariablesPlantilla;
  responderA?: string;
}) {
  const llave = process.env.RESEND_API_KEY;
  const remitente = process.env.EMAIL_FROM;
  if (!llave || !remitente) throw new Error("Falta RESEND_API_KEY o EMAIL_FROM");

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente,
      to: Array.isArray(para) ? para : [para],
      template: { id: plantilla, variables: escaparVariables(variables) },
      ...(responderA ? { reply_to: responderA } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    throw new Error(`Resend respondió ${respuesta.status}: ${cuerpo.slice(0, 300)}`);
  }
}

/**
 * Correo de texto simple, SIN plantilla, para avisos internos al equipo
 * (p. ej. alerta de retiro anticipado a los admins) y para el aviso genérico
 * SIN datos al correo institucional (lib/correo/institucional.ts, RS-02).
 * Los avisos con datos al asociado usan solo las plantillas de docs/resend-plantillas.md.
 */
export async function enviarCorreoTexto({ para, asunto, texto }: { para: string[]; asunto: string; texto: string }) {
  const llave = process.env.RESEND_API_KEY;
  const remitente = process.env.EMAIL_FROM;
  if (!llave || !remitente) throw new Error("Falta RESEND_API_KEY o EMAIL_FROM");
  if (para.length === 0) return;

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente, to: para, subject: asunto, text: texto }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    throw new Error(`Resend respondió ${respuesta.status}: ${cuerpo.slice(0, 300)}`);
  }
}

/** Quita correos del mensaje de error antes de registrarlo (sin datos personales en el log). */
function mensajeSinCorreos(error: unknown) {
  const texto = error instanceof Error ? error.message : String(error);
  return texto.replace(/[^\s<>"]+@[^\s<>"]+/g, "[correo]");
}

/**
 * §13.4: envía con plantilla de Resend y, si la variable de plantilla falta o
 * Resend la rechaza, cae a texto plano con el mismo contenido. Registra
 * `correo_plantilla_faltante` con el NOMBRE de la variable (nunca datos
 * personales). Lanza solo si también falla el texto plano; cada llamador decide
 * cómo registrar ese fallo final (no bloquea el flujo de negocio).
 */
export async function enviarConRespaldo({
  para,
  variablePlantilla,
  variables,
  asunto,
  texto,
  responderA,
}: {
  para: string | string[];
  /** Nombre de la variable de entorno, p. ej. `RESEND_TEMPLATE_CREDITO_RECHAZADO`. */
  variablePlantilla: string;
  variables: VariablesPlantilla;
  asunto: string;
  texto: string;
  responderA?: string;
}): Promise<"plantilla" | "texto"> {
  const lista = Array.isArray(para) ? para : [para];
  const plantilla = process.env[variablePlantilla];
  if (plantilla) {
    try {
      await enviarPlantillaResend({ para: lista, plantilla, variables, responderA });
      return "plantilla";
    } catch (error) {
      registrar("warn", {
        evento: "correo_plantilla_faltante",
        variable: variablePlantilla,
        motivo: "plantilla_fallo",
        mensaje: mensajeSinCorreos(error),
      });
    }
  } else {
    registrar("warn", { evento: "correo_plantilla_faltante", variable: variablePlantilla, motivo: "variable_vacia" });
  }
  await enviarCorreoTexto({ para: lista, asunto, texto });
  return "texto";
}
