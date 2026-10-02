import { LADO_FOTO_CARNE_PX, recorteCuadrado } from "@/lib/fotoCarne";

/**
 * Solo navegador (usa canvas). Recorta el cuadrado central de la foto, la reduce a
 * 800 x 800 y la comprime a JPEG (~100 KB). Así siempre sube un JPEG liviano, el PDF
 * del carné puede incrustarlo y la foto sale cuadrada en el carné.
 * Devuelve null si el navegador no puede leer la imagen.
 */
export async function recortarFotoCarne(archivo: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const { x, y, lado } = recorteCuadrado(bitmap.width, bitmap.height);
    const salida = Math.min(lado, LADO_FOTO_CARNE_PX);
    const lienzo = document.createElement("canvas");
    lienzo.width = salida;
    lienzo.height = salida;
    const contexto = lienzo.getContext("2d");
    if (!contexto) return null;
    contexto.drawImage(bitmap, x, y, lado, lado, 0, 0, salida, salida);
    bitmap.close?.();
    for (const calidad of [0.88, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));
      if (blob && blob.size <= 1.5 * 1024 * 1024) return new File([blob], "foto-carne.jpg", { type: "image/jpeg" });
    }
    return null;
  } catch {
    return null;
  }
}
