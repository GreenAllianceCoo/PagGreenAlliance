import "server-only";
import { randomUUID } from "node:crypto";
import { detectarTipoImagen } from "@/lib/afiliacion/fotos";
import { urlFirmadaFoto } from "@/lib/admin/fotos";
import { CAMPOS_FOTO_AFILIACION, rutaCambioFoto, rutaEsCambioFoto } from "@/lib/fotosAfiliacionAdmin";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { TAMANO_MAXIMO_FOTO, type CampoFoto, type TipoFotoPermitido } from "@/lib/validaciones/afiliacion";

/**
 * Fotos de afiliación del asociado en /admin/asociados/[id] (pedido de Sebas, 8-nov):
 * lado servidor (service role). Quien llama YA debe haber comprobado `exigirAdmin()`:
 * aquí solo se busca, se firma y se mueven archivos. Las rutas nunca salen hacia el
 * navegador, solo URLs firmadas cortas.
 */

const BUCKET = "afiliacion-documentos";

/** Id de la afiliación aprobada más reciente del asociado (la de sus fotos), o null. */
export async function afiliacionVigenteDe(asociadoId: string): Promise<string | null> {
  const { data, error } = await crearClienteAdmin().rpc("afiliacion_vigente_de_asociado", { p_asociado_id: asociadoId });
  if (error) {
    registrar("error", { evento: "afiliacion_vigente_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return typeof data === "string" ? data : null;
}

export type FotoAfiliacionAsociado = { campo: CampoFoto; url: string | null };

/** Las 3 fotos (con URL firmada o null si falta), o null si no tiene afiliación aprobada. */
export async function cargarFotosAfiliacionAsociado(asociadoId: string): Promise<FotoAfiliacionAsociado[] | null> {
  const solicitudId = await afiliacionVigenteDe(asociadoId);
  if (!solicitudId) return null;
  const { data, error } = await crearClienteAdmin()
    .from("solicitudes_afiliacion")
    .select("foto_cedula_frente, foto_cedula_reverso, foto_selfie")
    .eq("id", solicitudId)
    .maybeSingle();
  if (error || !data) {
    registrar("error", { evento: "fotos_afiliacion_asociado_fallo", mensaje: error?.message });
    return null;
  }
  const fila = data as Record<CampoFoto, string | null>;
  return Promise.all(CAMPOS_FOTO_AFILIACION.map(async (campo) => ({ campo, url: await urlFirmadaFoto(fila[campo]) })));
}

/** URL firmada para que el navegador suba la foto nueva directo a Storage. */
export async function crearSubidaCambioFoto(solicitudId: string, campo: CampoFoto, tipo: TipoFotoPermitido) {
  const ruta = rutaCambioFoto(solicitudId, campo, randomUUID(), tipo);
  const { data, error } = await crearClienteAdmin().storage.from(BUCKET).createSignedUploadUrl(ruta, { upsert: false });
  if (error || !data?.token) {
    registrar("error", { evento: "cambio_foto_url_subida_fallo", mensaje: error?.message });
    return null;
  }
  return { ruta, token: data.token, bucket: BUCKET };
}

export async function borrarFotoAfiliacion(ruta: string) {
  const { error } = await crearClienteAdmin().storage.from(BUCKET).remove([ruta]);
  if (error) registrar("warn", { evento: "cambio_foto_borrado_fallo", mensaje: error.message });
}

/**
 * Verifica la foto subida: ruta de ESA solicitud y ESE campo, archivo existente,
 * ≤ 5 MB y bytes reales de JPEG/PNG/WEBP que coinciden con la extensión.
 * Si no sirve, la borra.
 */
export async function verificarFotoSubida(solicitudId: string, campo: CampoFoto, ruta: string): Promise<string | null> {
  if (!rutaEsCambioFoto(ruta, solicitudId, campo)) return "La foto no es válida.";
  const { data, error } = await crearClienteAdmin().storage.from(BUCKET).download(ruta);
  if (error || !data) return "No encontramos la foto subida. Intenta de nuevo.";
  const detectado = await detectarTipoImagen(data);
  if (data.size === 0 || data.size > TAMANO_MAXIMO_FOTO || !detectado || !ruta.endsWith(`.${detectado.extension}`)) {
    registrar("warn", { evento: "cambio_foto_archivo_invalido", campo });
    await borrarFotoAfiliacion(ruta);
    return "La foto debe ser una imagen JPG, PNG o WEBP de máximo 5 MB.";
  }
  return null;
}
