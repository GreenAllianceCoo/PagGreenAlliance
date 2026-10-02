/**
 * Foto del asociado en el carné (pedido de Sebas, 2-oct): reglas puras, usadas por
 * el navegador (validar y recortar antes de subir) y por el servidor (validar de nuevo).
 *
 * Por defecto el carné usa la selfie de la afiliación; el asociado puede cambiarla por
 * otra foto suya. La propia vive en el bucket privado `fotos-carne` (5 MB, JPG/PNG/WEBP),
 * una por asociado, en «<asociado>/<uuid>.<ext>» (migración 20261003200000).
 */

export const BUCKET_FOTOS_CARNE = "fotos-carne";
export const TAMANO_MAXIMO_FOTO_CARNE = 5 * 1024 * 1024;
export const TIPOS_FOTO_CARNE = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFotoCarne = (typeof TIPOS_FOTO_CARNE)[number];
export type ExtensionFotoCarne = "jpg" | "png" | "webp";

export const EXTENSION_DE_TIPO_FOTO_CARNE: Record<TipoFotoCarne, ExtensionFotoCarne> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONSEJO_FOTO_CARNE = "Usa una foto reciente donde se vea bien tu cara, sin gafas oscuras ni gorra.";
export const TEXTO_FORMATOS_FOTO_CARNE = "JPG, PNG o WEBP, máximo 5 MB";

/** Lado (px) de la foto cuadrada que se sube: sobra para el carné y el PDF, y pesa poco. */
export const LADO_FOTO_CARNE_PX = 800;

export function esTipoFotoCarne(tipo: string): tipo is TipoFotoCarne {
  return (TIPOS_FOTO_CARNE as readonly string[]).includes(tipo);
}

/** Mensaje de error del archivo elegido, o null si sirve. */
export function errorDeArchivoFotoCarne(archivo: { type: string; size: number }): string | null {
  if (archivo.size === 0) return "El archivo está vacío.";
  if (!esTipoFotoCarne(archivo.type)) return "La foto debe ser JPG, PNG o WEBP.";
  if (archivo.size > TAMANO_MAXIMO_FOTO_CARNE) return "La foto pesa más de 5 MB.";
  return null;
}

/** Ruta dentro del bucket (sin el nombre del bucket). */
export function rutaFotoCarne(asociadoId: string, identificador: string, tipo: TipoFotoCarne) {
  return `${asociadoId}/${identificador}.${EXTENSION_DE_TIPO_FOTO_CARNE[tipo]}`;
}

/** true si la ruta es «<ese asociado>/<uuid>.<ext permitida>». */
export function rutaEsDelAsociado(ruta: string, asociadoId: string) {
  return new RegExp(`^${asociadoId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(ruta);
}

/** Cuadrado central de una imagen (recorte «cover»): origen y lado en la imagen original. */
export function recorteCuadrado(ancho: number, alto: number) {
  const lado = Math.max(1, Math.min(ancho, alto));
  return { x: Math.floor((ancho - lado) / 2), y: Math.floor((alto - lado) / 2), lado };
}

/** «bucket/ruta» → { bucket, ruta } (null si viene mal formado). */
export function separarBucketRuta(entrada: string): { bucket: string; ruta: string } | null {
  const i = entrada.indexOf("/");
  if (i < 1 || i === entrada.length - 1) return null;
  return { bucket: entrada.slice(0, i), ruta: entrada.slice(i + 1) };
}
