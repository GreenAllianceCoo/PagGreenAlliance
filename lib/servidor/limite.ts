import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Límite de frecuencia en la base (public.registrar_intento, migración
 * 20260923210000_limite_de_intentos.sql). La clave se guarda como HMAC-SHA256
 * con un secreto solo de servidor (LIMITE_HMAC_SECRET): la tabla no tiene IPs
 * ni cédulas en claro, y sin el secreto no se pueden revertir por fuerza bruta
 * (hallazgo M-2 de docs/auditorias/2026-09-23-limite-de-intentos.md).
 *
 * Si falta el secreto:
 * - En Vercel el build falla (next.config.mjs), así que no llega a desplegarse.
 * - Si aun así falta en tiempo de ejecución, se registra `limite_secreto_faltante`
 *   y el límite BLOQUEA (devuelve false): preferimos que el ingreso y la
 *   afiliación dejen de funcionar de forma visible a que el límite quede
 *   apagado sin que nadie lo note.
 */

/** Largo mínimo del secreto (el mismo criterio que INGRESO_COOKIE_SECRET). */
export const LARGO_MINIMO_SECRETO = 32;

/** IP del cliente según los encabezados del proxy (Vercel pone x-forwarded-for). */
export async function ipDelCliente() {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || h.get("x-real-ip")?.trim() || "desconocida";
}

function secretoDelLimite(): string | null {
  const secreto = process.env.LIMITE_HMAC_SECRET;
  return secreto && secreto.length >= LARGO_MINIMO_SECRETO ? secreto : null;
}

/**
 * Clave que se guarda en limites_intentos: `tipo:hmac(tipo:valor)[0..40]`.
 * El prefijo `tipo` queda en claro para poder leer la tabla al depurar.
 */
export function claveHmac(tipo: string, valor: string, secreto: string) {
  const hmac = createHmac("sha256", secreto).update(`${tipo}:${valor}`).digest("hex").slice(0, 40);
  return `${tipo}:${hmac}`;
}

/**
 * Registra un intento y devuelve `true` si todavía está dentro del límite.
 * - Sin LIMITE_HMAC_SECRET: bloquea (false) y registra el error.
 * - Si la base falla: deja pasar (no bloquea al usuario) y lo registra (M-1).
 */
export async function dentroDelLimite(tipo: string, valor: string, maximo: number, ventanaSegundos: number) {
  const secreto = secretoDelLimite();
  if (!secreto) {
    registrar("error", {
      evento: "limite_secreto_faltante",
      tipo,
      mensaje: `Falta LIMITE_HMAC_SECRET (${LARGO_MINIMO_SECRETO}+ caracteres) en el servidor; se bloquea la acción.`,
    });
    return false;
  }

  try {
    const { data, error } = await crearClienteAdmin().rpc("registrar_intento", {
      p_clave: claveHmac(tipo, valor, secreto),
      p_maximo: maximo,
      p_ventana_segundos: ventanaSegundos,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    registrar("error", {
      evento: "limite_de_intentos_fallo",
      tipo,
      mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
    return true;
  }
}
