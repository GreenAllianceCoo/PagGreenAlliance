import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Límite de frecuencia en la base (public.registrar_intento, migración
 * 20260923210000_limite_de_intentos.sql). La clave se guarda como hash:
 * la tabla no tiene IPs ni cédulas en claro.
 */

/** IP del cliente según los encabezados del proxy (Vercel pone x-forwarded-for). */
export async function ipDelCliente() {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return reenviada || h.get("x-real-ip")?.trim() || "desconocida";
}

function claveHash(tipo: string, valor: string) {
  const hash = createHash("sha256").update(`${tipo}:${valor}`).digest("hex").slice(0, 40);
  return `${tipo}:${hash}`;
}

/**
 * Registra un intento y devuelve `true` si todavía está dentro del límite.
 * Si la base falla, deja pasar (no bloquea al usuario) y lo registra.
 */
export async function dentroDelLimite(tipo: string, valor: string, maximo: number, ventanaSegundos: number) {
  try {
    const { data, error } = await crearClienteAdmin().rpc("registrar_intento", {
      p_clave: claveHash(tipo, valor),
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
