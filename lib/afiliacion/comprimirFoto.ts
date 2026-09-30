/**
 * Compresión de las fotos de /afiliacion en el navegador (spec-requerimientos-
 * ricardo §2.10). Antes se reducía a 1600 px y ~300 KB para caber en el
 * límite de las Server Actions, y por eso las fotos se veían borrosas. Ahora
 * las fotos suben DIRECTO al bucket con URLs firmadas (no pasan por la
 * Server Action), así que se apunta a ~2400 px, calidad 0,85 y como máximo
 * ~1,5 MB por foto. Solo se baja la calidad si pasa de ese peso.
 *
 * `comprimirFoto` usa canvas: solo navegador. `dimensionesObjetivo` y
 * `calidadesAProbar` son puras (se prueban en Node).
 */

import { PESO_OBJETIVO_FOTO } from "@/lib/validaciones/afiliacion";

export const LADO_MAXIMO_FOTO_PX = 2400;
export const CALIDAD_INICIAL_FOTO = 0.85;
/** Calidades que se prueban, en orden, hasta quedar por debajo de PESO_OBJETIVO_FOTO. */
export const CALIDADES_FOTO = [CALIDAD_INICIAL_FOTO, 0.78, 0.7, 0.62] as const;

/** Tamaño final conservando la proporción (nunca agranda). */
export function dimensionesObjetivo(ancho: number, alto: number, ladoMaximo = LADO_MAXIMO_FOTO_PX) {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto, 1));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/**
 * Redimensiona a máx. 2400 px y reconvierte a JPEG (0,85, bajando solo si
 * pasa de ~1,5 MB). Si algo falla, o si el resultado pesa más que el
 * original, se devuelve el original tal cual.
 */
export async function comprimirFoto(archivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const { ancho, alto } = dimensionesObjetivo(bitmap.width, bitmap.height);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d");
    if (!contexto) return archivo;
    contexto.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();

    let comprimido: File | null = null;
    for (const calidad of CALIDADES_FOTO) {
      const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));
      if (!blob) continue;
      const nombre = `${archivo.name.replace(/\.\w+$/, "") || "foto"}.jpg`;
      comprimido = new File([blob], nombre, { type: "image/jpeg" });
      if (comprimido.size <= PESO_OBJETIVO_FOTO) break;
    }
    if (!comprimido) return archivo;
    return comprimido.size < archivo.size ? comprimido : archivo;
  } catch {
    return archivo;
  }
}
