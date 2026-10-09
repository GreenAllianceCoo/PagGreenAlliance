/**
 * Comprobante de desembolso (pedido de Sebas, reunión 1-oct): reglas puras,
 * usadas por el navegador (validar antes de subir) y por el servidor (validar
 * de nuevo; nunca se confía en lo que diga el navegador).
 *
 * Bucket privado, 5 MB, JPG/PNG/WEBP/PDF (migración 20261003000000). La ruta
 * dentro del bucket es «<solicitud>/<uuid>.<ext>» y la fila de la solicitud
 * solo acepta rutas de ESA solicitud (check en la base).
 */

export const BUCKET_COMPROBANTES = "comprobantes-desembolso";
export const TAMANO_MAXIMO_COMPROBANTE = 5 * 1024 * 1024;

export const TIPOS_COMPROBANTE = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type TipoComprobante = (typeof TIPOS_COMPROBANTE)[number];
export type ExtensionComprobante = "jpg" | "png" | "webp" | "pdf";

export const EXTENSION_DE_TIPO_COMPROBANTE: Record<TipoComprobante, ExtensionComprobante> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const TEXTO_FORMATOS_COMPROBANTE = "JPG, PNG, WEBP o PDF, máximo 5 MB";

export function esTipoComprobante(tipo: string): tipo is TipoComprobante {
  return (TIPOS_COMPROBANTE as readonly string[]).includes(tipo);
}

/** Mensaje de error del archivo elegido, o null si sirve. */
export function errorDeArchivoComprobante(archivo: { type: string; size: number }): string | null {
  if (archivo.size === 0) return "El archivo está vacío.";
  if (!esTipoComprobante(archivo.type)) return "El comprobante debe ser una imagen JPG, PNG o WEBP, o un PDF.";
  if (archivo.size > TAMANO_MAXIMO_COMPROBANTE) return "El comprobante pesa más de 5 MB.";
  return null;
}

/** Ruta dentro del bucket (sin el nombre del bucket). */
export function rutaComprobante(solicitudId: string, identificador: string, tipo: TipoComprobante) {
  return `${solicitudId}/${identificador}.${EXTENSION_DE_TIPO_COMPROBANTE[tipo]}`;
}

/** true si la ruta es «<esa solicitud>/<uuid>.<ext permitida>». */
export function rutaEsDeSolicitud(ruta: string, solicitudId: string) {
  return new RegExp(`^${solicitudId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(ruta);
}

/** Detecta el tipo REAL por los primeros bytes (JPEG, PNG, WEBP o PDF). */
export async function detectarTipoComprobante(
  archivo: Blob,
): Promise<{ mime: TipoComprobante; extension: ExtensionComprobante } | null> {
  const c = new Uint8Array(await archivo.slice(0, 12).arrayBuffer());
  if (c[0] === 0xff && c[1] === 0xd8 && c[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (c[0] === 0x89 && c[1] === 0x50 && c[2] === 0x4e && c[3] === 0x47) return { mime: "image/png", extension: "png" };
  if (
    c[0] === 0x52 && c[1] === 0x49 && c[2] === 0x46 && c[3] === 0x46 &&
    c[8] === 0x57 && c[9] === 0x45 && c[10] === 0x42 && c[11] === 0x50
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  // %PDF-
  if (c[0] === 0x25 && c[1] === 0x50 && c[2] === 0x44 && c[3] === 0x46 && c[4] === 0x2d) {
    return { mime: "application/pdf", extension: "pdf" };
  }
  return null;
}
