import { dimensionesObjetivo } from "@/lib/afiliacion/comprimirFoto";
import { IMAGEN_LADO_MAX_PX, IMAGEN_SUBIDA_MAX_BYTES } from "@/lib/convenio/publicaciones";

const CALIDADES = [0.88, 0.8, 0.7, 0.6] as const;

/**
 * Reduce la imagen en el navegador a máx. 1600 px (JPEG) para que quepa en la
 * Server Action (3 MB; Vercel admite 4,5 MB por petición). El servidor la
 * vuelve a procesar con sharp y la guarda en WebP. Si no se puede reducir por
 * debajo del límite devuelve null. Solo navegador (canvas).
 */
export async function reducirImagen(archivo: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const { ancho, alto } = dimensionesObjetivo(bitmap.width, bitmap.height, IMAGEN_LADO_MAX_PX);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d");
    if (!contexto) return archivo.size <= IMAGEN_SUBIDA_MAX_BYTES ? archivo : null;
    // Fondo blanco: los PNG con transparencia no quedan negros al pasar a JPEG.
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close?.();
    for (const calidad of CALIDADES) {
      const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));
      if (blob && blob.size <= IMAGEN_SUBIDA_MAX_BYTES) return new File([blob], "imagen.jpg", { type: "image/jpeg" });
    }
    return null;
  } catch {
    return archivo.size <= IMAGEN_SUBIDA_MAX_BYTES ? archivo : null;
  }
}
