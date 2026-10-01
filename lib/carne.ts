/**
 * Carné con QR: funciones puras (sin secretos), usadas por /cuenta/carne y /verificar/[token].
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Tiene forma de token de carné (uuid)? Evita ir a la base con basura. */
export function esTokenCarne(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/** Ruta pública de verificación para un token. */
export function rutaVerificacion(token: string): string {
  return `/verificar/${token.toLowerCase()}`;
}

/** Lo ÚNICO que devuelve verificar_carne (nunca cédula, celular, correo, montos ni tasa). */
export type FilaVerificacionCarne = {
  nombre: string;
  grado: string;
  institucion: string | null;
  activo: boolean;
};

/** Normaliza lo que devuelve la RPC; cualquier cosa rara = null («Carné no válido»). */
export function vistaVerificacion(filas: unknown): FilaVerificacionCarne | null {
  if (!Array.isArray(filas) || filas.length !== 1) return null;
  const f = filas[0] as Record<string, unknown> | null;
  if (!f || typeof f.nombre !== "string" || typeof f.grado !== "string" || typeof f.activo !== "boolean") {
    return null;
  }
  return {
    nombre: f.nombre,
    grado: f.grado,
    institucion: typeof f.institucion === "string" ? f.institucion : null,
    activo: f.activo,
  };
}
