import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { IMAGEN_LADO_MAX_PX } from "@/lib/convenio/publicaciones";

/** Primeros bytes de JPG, PNG o WebP (no basta con el Content-Type del navegador). */
export function esImagenPorFirma(bytes: Uint8Array) {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  return (
    empieza(0xff, 0xd8, 0xff) ||
    empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) ||
    (empieza(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
  );
}

/** Un PDF empieza con «%PDF-». */
export function esPdfPorFirma(bytes: Uint8Array) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

/**
 * Reconvierte la imagen a WebP con sharp: máximo 1600 px por lado (nunca
 * agranda), orientación corregida y sin metadatos (EXIF, GPS). Lanza si el
 * archivo no es una imagen que sharp pueda leer.
 */
export async function imagenAWebp(bytes: Uint8Array) {
  return sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: IMAGEN_LADO_MAX_PX, height: IMAGEN_LADO_MAX_PX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/** Nombre nuevo para cada archivo (sin caché vieja, sin nombres del usuario). */
export function nombreArchivo(extension: "webp" | "pdf") {
  return `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${extension}`;
}
