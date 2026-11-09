/**
 * PDF del proceso ejecutivo de cada asociado (pedido de Sebas, 8-nov): reglas puras,
 * usadas por el navegador (validar antes de subir) y por el servidor (validar de nuevo).
 *
 * Bucket privado `procesos-documentos` (10 MB, solo PDF; migración 20261108000000),
 * ruta «<asociado>/<uuid>.pdf». Solo el admin sube, descarga y quita.
 */

export const BUCKET_DOCUMENTOS_PROCESO = "procesos-documentos";
export const TAMANO_MAXIMO_DOCUMENTO_PROCESO = 10 * 1024 * 1024;
export const TEXTO_FORMATO_DOCUMENTO_PROCESO = "PDF, máximo 10 MB";

/** Mensaje de error del archivo elegido, o null si sirve. */
export function errorDeArchivoDocumentoProceso(archivo: { type: string; size: number; name?: string }): string | null {
  if (archivo.size === 0) return "El archivo está vacío.";
  // Algunos navegadores no ponen el tipo; entonces se mira la extensión (el servidor revisa los bytes).
  const esPdf = archivo.type === "application/pdf" || (!archivo.type && /\.pdf$/i.test(archivo.name ?? ""));
  if (!esPdf) return "El documento debe ser un PDF.";
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_PROCESO) return "El documento pesa más de 10 MB.";
  return null;
}

/** Ruta dentro del bucket (sin el nombre del bucket). */
export function rutaDocumentoProceso(asociadoId: string, identificador: string) {
  return `${asociadoId}/${identificador}.pdf`;
}

/** true si la ruta es «<ese asociado>/<uuid>.pdf». */
export function rutaEsDocumentoDe(ruta: string, asociadoId: string) {
  return new RegExp(`^${asociadoId}/[0-9a-f-]{36}\\.pdf$`).test(ruta);
}

/** true si los primeros bytes son los de un PDF («%PDF-»). */
export async function esPdfPorBytes(archivo: Blob): Promise<boolean> {
  const c = new Uint8Array(await archivo.slice(0, 5).arrayBuffer());
  return c[0] === 0x25 && c[1] === 0x50 && c[2] === 0x44 && c[3] === 0x46 && c[4] === 0x2d;
}

/** «1,4 MB» / «820 KB». */
export function formatearTamanoArchivo(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Nombre del archivo al descargar: «Auto que libra mandamiento» → «auto-que-libra-mandamiento.pdf». */
export function nombreArchivoDocumento(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "documento"}.pdf`;
}
