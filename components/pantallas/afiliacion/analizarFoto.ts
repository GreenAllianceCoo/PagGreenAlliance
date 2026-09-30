/**
 * Verificador de foto (solo navegador): reduce la foto a un canvas pequeño y
 * la pasa por `evaluarCalidadFoto` (lib/afiliacion/calidadFoto.ts). Es un
 * AVISO: si algo falla devuelve null y la foto se acepta sin sello ni aviso.
 */
import {
  dimensionesAnalisis,
  evaluarCalidadFoto,
  type ResultadoCalidadFoto,
} from "@/lib/afiliacion/calidadFoto";

export async function analizarFoto(archivo: Blob): Promise<ResultadoCalidadFoto | null> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const { ancho, alto } = dimensionesAnalisis(bitmap.width, bitmap.height);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d", { willReadFrequently: true });
    if (!contexto) return null;
    contexto.drawImage(bitmap, 0, 0, ancho, alto);
    const resultado = evaluarCalidadFoto(contexto.getImageData(0, 0, ancho, alto), {
      anchoOriginal: bitmap.width,
      altoOriginal: bitmap.height,
    });
    bitmap.close?.();
    return resultado;
  } catch {
    return null;
  }
}
