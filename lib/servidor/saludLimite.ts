import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCorreoTexto } from "@/lib/correo/resend";
import { LARGO_MINIMO_SECRETO } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";

/**
 * Revisión del límite de intentos (alternativa a una alerta de Vercel, que el
 * plan Pro sin Observability Plus no permite por texto del log). La corre el
 * cron cada hora y detecta las dos fallas silenciosas de lib/servidor/limite.ts:
 *  - falta LIMITE_HMAC_SECRET → el límite BLOQUEA ingreso, afiliación y recuperación;
 *  - la base no cuenta intentos → el límite deja pasar todo.
 * El correo sale UNA vez al día (8 a. m. de Bogotá) mientras siga la falla, a
 * ALERTA_TECNICA_CORREOS (separados por coma) o, si falta, a soporte. No usa
 * la base para saber a quién avisar porque la falla puede ser justo la base.
 */

const CORREO_SOPORTE = "soporte@greenallianceco.com";
/** 13:00 UTC = 8:00 a. m. en Bogotá (UTC-5, sin horario de verano). */
const HORA_AVISO_UTC = 13;

export function destinatariosAlertaTecnica(valor = process.env.ALERTA_TECNICA_CORREOS): string[] {
  const correos = (valor ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
  return correos.length > 0 ? [...new Set(correos)] : [CORREO_SOPORTE];
}

export function esHoraDelAviso(ahora = new Date()) {
  return ahora.getUTCHours() === HORA_AVISO_UTC;
}

/** Lista de problemas encontrados (vacía si el límite funciona). */
export async function revisarLimite(admin: SupabaseClient): Promise<string[]> {
  const problemas: string[] = [];
  const secreto = process.env.LIMITE_HMAC_SECRET;
  if (!secreto || secreto.length < LARGO_MINIMO_SECRETO) {
    problemas.push(
      `Falta la variable LIMITE_HMAC_SECRET (${LARGO_MINIMO_SECRETO}+ caracteres) en Vercel. Mientras falte, nadie puede ingresar, afiliarse ni pedir recuperación de acceso.`,
    );
  }
  try {
    // Clave fija sin datos personales; el máximo alto hace que nunca bloquee.
    const { error } = await admin.rpc("registrar_intento", {
      p_clave: "salud:cron",
      p_maximo: 1_000_000,
      p_ventana_segundos: 60,
    });
    if (error) throw error;
  } catch (e) {
    problemas.push(
      `La base no está contando los intentos (${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}). Mientras siga así, el límite de intentos deja pasar todo.`,
    );
  }
  return problemas;
}

/** Revisa y, si hay problemas y es la hora del aviso, manda el correo. Nunca lanza. */
export async function vigilarLimite(admin: SupabaseClient, ahora = new Date()): Promise<"ok" | "fallo"> {
  const problemas = await revisarLimite(admin);
  if (problemas.length === 0) return "ok";
  registrar("error", { evento: "salud_limite_fallo", problemas: problemas.length });
  if (esHoraDelAviso(ahora)) {
    try {
      await enviarCorreoTexto({
        para: destinatariosAlertaTecnica(),
        asunto: "Alerta técnica: el límite de intentos de la plataforma está fallando",
        texto: [
          "La revisión automática de la plataforma Green Alliance encontró:",
          "",
          ...problemas.map((p) => `- ${p}`),
          "",
          "Revisa Vercel (Settings → Environment Variables y Logs) y Supabase. Este aviso se repite cada día a las 8 a. m. mientras siga la falla.",
        ].join("\n"),
      });
    } catch (e) {
      registrar("error", {
        evento: "salud_limite_correo_fallo",
        mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      });
    }
  }
  return "fallo";
}
