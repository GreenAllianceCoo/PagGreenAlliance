import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUCKET_DOCUMENTOS_PROCESO,
  TAMANO_MAXIMO_DOCUMENTO_PROCESO,
  esPdfPorBytes,
  nombreArchivoDocumento,
  rutaDocumentoProceso,
  rutaEsDocumentoDe,
} from "@/lib/documentosProceso";
import { fechaBogotaDeInstante } from "@/lib/fechas";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * PDF del proceso ejecutivo (pedido de Sebas, 8-nov): lado servidor. Quien llama YA
 * debe haber comprobado `exigirAdmin()`. La lista sale con la sesión del admin (RLS);
 * subir, firmar la descarga y borrar archivos usan service role. La ruta del archivo
 * nunca llega al navegador.
 */

/** Vida de la URL firmada de descarga. */
const SEGUNDOS_URL_DESCARGA = 120;

export type DocumentoProceso = {
  id: string;
  nombre: string;
  tamanoBytes: number;
  /** «08/11/2026». */
  subidoEl: string;
  subidoPor: string;
};

export async function listarDocumentosProceso(
  supabase: SupabaseClient,
  asociadoId: string,
): Promise<{ documentos: DocumentoProceso[]; error: boolean }> {
  const { data, error } = await supabase
    .from("documentos_proceso")
    .select("id, nombre, tamano_bytes, created_at, subidor:subido_por(nombre_completo)")
    .eq("asociado_id", asociadoId)
    .is("quitado_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    registrar("error", { evento: "documentos_proceso_lista_fallo", codigo: error.code, mensaje: error.message });
    return { documentos: [], error: true };
  }
  type Fila = { id: string; nombre: string; tamano_bytes: number; created_at: string; subidor: { nombre_completo: string } | null };
  return {
    documentos: ((data ?? []) as unknown as Fila[]).map((f) => {
      const [anio, mes, dia] = fechaBogotaDeInstante(f.created_at).split("-");
      return {
        id: f.id,
        nombre: f.nombre,
        tamanoBytes: Number(f.tamano_bytes),
        subidoEl: `${dia}/${mes}/${anio}`,
        subidoPor: f.subidor?.nombre_completo ?? "—",
      };
    }),
    error: false,
  };
}

/** URL firmada para que el navegador suba el PDF directo a Storage. */
export async function crearSubidaDocumentoProceso(asociadoId: string) {
  const ruta = rutaDocumentoProceso(asociadoId, randomUUID());
  const { data, error } = await crearClienteAdmin()
    .storage.from(BUCKET_DOCUMENTOS_PROCESO)
    .createSignedUploadUrl(ruta, { upsert: false });
  if (error || !data?.token) {
    registrar("error", { evento: "documento_proceso_url_subida_fallo", mensaje: error?.message });
    return null;
  }
  return { ruta, token: data.token, bucket: BUCKET_DOCUMENTOS_PROCESO };
}

export async function borrarDocumentosProceso(rutas: string[]) {
  if (rutas.length === 0) return;
  const { error } = await crearClienteAdmin().storage.from(BUCKET_DOCUMENTOS_PROCESO).remove(rutas);
  if (error) registrar("warn", { evento: "documento_proceso_borrado_fallo", mensaje: error.message });
}

/** Verifica el PDF subido (ruta del asociado, existe, ≤ 10 MB, bytes «%PDF-»). Si no sirve, lo borra. */
export async function verificarDocumentoSubido(asociadoId: string, ruta: string): Promise<string | null> {
  if (!rutaEsDocumentoDe(ruta, asociadoId)) return "El documento no es válido.";
  const { data, error } = await crearClienteAdmin().storage.from(BUCKET_DOCUMENTOS_PROCESO).download(ruta);
  if (error || !data) return "No encontramos el documento subido. Intenta de nuevo.";
  if (data.size === 0 || data.size > TAMANO_MAXIMO_DOCUMENTO_PROCESO || !(await esPdfPorBytes(data))) {
    registrar("warn", { evento: "documento_proceso_archivo_invalido" });
    await borrarDocumentosProceso([ruta]);
    return "El documento debe ser un PDF de máximo 10 MB.";
  }
  return null;
}

/** URL firmada de descarga (con el nombre del documento como nombre del archivo), o null. */
export async function urlDescargaDocumento(documentoId: string): Promise<string | null> {
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("documentos_proceso")
    .select("ruta, nombre")
    .eq("id", documentoId)
    .is("quitado_at", null)
    .maybeSingle();
  if (!data) return null;
  const { data: firmada, error } = await admin.storage
    .from(BUCKET_DOCUMENTOS_PROCESO)
    .createSignedUrl(data.ruta as string, SEGUNDOS_URL_DESCARGA, { download: nombreArchivoDocumento(data.nombre as string) });
  if (error || !firmada?.signedUrl) {
    registrar("error", { evento: "documento_proceso_firma_fallo", mensaje: error?.message });
    return null;
  }
  return firmada.signedUrl;
}
