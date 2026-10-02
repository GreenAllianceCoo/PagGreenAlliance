import { prepararSubidaComprobante } from "@/app/admin/creditos/actions";
import { errorDeArchivoComprobante } from "@/lib/comprobantes";
import { createClient } from "@/lib/supabase/client";

export type ResultadoSubida = { ok: true; ruta: string } | { ok: false; error: string };

/**
 * Sube el comprobante DIRECTO a Storage con una URL firmada (no pasa por la Server
 * Action: el tope de 4,5 MB de Vercel no deja mandar archivos de 5 MB). El servidor
 * vuelve a verificar tipo real y tamaño antes de ligarlo a la solicitud.
 */
export async function subirArchivoComprobante(solicitudId: string, archivo: File): Promise<ResultadoSubida> {
  const errorLocal = errorDeArchivoComprobante(archivo);
  if (errorLocal) return { ok: false, error: errorLocal };

  const preparada = await prepararSubidaComprobante({ solicitudId, tipo: archivo.type, tamano: archivo.size });
  if (!preparada.ok) return { ok: false, error: preparada.error };

  const { error } = await createClient()
    .storage.from(preparada.bucket)
    .uploadToSignedUrl(preparada.ruta, preparada.token, archivo, { contentType: archivo.type });
  if (error) return { ok: false, error: "No pudimos subir el comprobante. Revisa tu conexión e intenta de nuevo." };
  return { ok: true, ruta: preparada.ruta };
}
