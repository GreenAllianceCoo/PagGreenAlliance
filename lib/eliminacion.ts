import { createHmac, randomInt } from "node:crypto";

/**
 * «Eliminar definitivamente» a un asociado (pedido de Sebas, 1-oct): código de
 * confirmación por correo. Funciones puras (sin `server-only`) para poder
 * probarlas; solo las usa el servidor.
 *
 * El código de 6 dígitos NUNCA se guarda: la base guarda su HMAC-SHA256, atado al
 * admin que lo pide y al asociado, con el secreto de servidor LIMITE_HMAC_SECRET
 * (etiqueta propia «eliminacion:»). Así un código de otro admin o de otro
 * asociado no sirve, y una fuga de la tabla no entrega los códigos.
 */

export const VIDA_CODIGO_ELIMINACION_MINUTOS = 10;
export const INTENTOS_CODIGO_ELIMINACION = 3;

/** 6 dígitos con ceros a la izquierda, de un generador criptográfico. */
export function generarCodigoEliminacion(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCodigoEliminacion(codigo: string, adminId: string, asociadoId: string, secreto: string): string {
  return createHmac("sha256", secreto).update(`eliminacion:${adminId}:${asociadoId}:${codigo}`).digest("hex");
}

/** Secreto de servidor (≥ 32 caracteres) o null si falta. */
export function secretoEliminacion(): string | null {
  const s = process.env.LIMITE_HMAC_SECRET;
  return s && s.length >= 32 ? s : null;
}

/** «bucket/ruta/del/archivo» → { bucket, ruta }. */
export function separarRutaStorage(entrada: string): { bucket: string; ruta: string } | null {
  const i = entrada.indexOf("/");
  if (i < 1 || i === entrada.length - 1) return null;
  return { bucket: entrada.slice(0, i), ruta: entrada.slice(i + 1) };
}

/** Agrupa «bucket/ruta» por bucket (para un `remove` por bucket). Ignora entradas mal formadas. */
export function agruparPorBucket(entradas: string[]): Map<string, string[]> {
  const grupos = new Map<string, string[]>();
  for (const e of entradas) {
    const p = separarRutaStorage(e);
    if (!p) continue;
    grupos.set(p.bucket, [...(grupos.get(p.bucket) ?? []), p.ruta]);
  }
  return grupos;
}
