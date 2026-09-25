import "server-only";

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

/** Envía una plantilla publicada en Resend sin exponer la llave al cliente. */
export async function enviarPlantillaResend({
  para,
  plantilla,
  variables,
  responderA,
}: {
  para: string;
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
      to: [para],
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
