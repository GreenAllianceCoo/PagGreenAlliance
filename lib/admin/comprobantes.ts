import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUCKET_COMPROBANTES,
  TAMANO_MAXIMO_COMPROBANTE,
  detectarTipoComprobante,
  rutaComprobante,
  rutaEsDeSolicitud,
  type TipoComprobante,
} from "@/lib/comprobantes";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Comprobante de desembolso: lado servidor (service role). Quien llama YA debe
 * haber comprobado `exigirAdmin()` (subir/ver como admin) o que la solicitud es
 * del asociado en sesión (ver app/cuenta/comprobante/actions.ts): aquí solo se
 * firma y se mueven archivos, no se vuelve a validar el rol.
 *
 * Flujo (como las fotos de afiliación, para no pasar el archivo por la Server
 * Action y respetar el tope de 4,5 MB de Vercel):
 *  1. `crearSubidaComprobante`: URL firmada de subida bajo «<solicitud>/<uuid>.<ext>».
 *  2. El navegador sube con `uploadToSignedUrl`.
 *  3. `registrarComprobanteSubido`: comprueba que el archivo existe, pesa ≤ 5 MB y
 *     que sus bytes son de verdad JPEG/PNG/WEBP/PDF; recién ahí lo liga a la
 *     solicitud con la RPC `admin_registrar_comprobante` (con la sesión del admin)
 *     y borra el archivo anterior si lo reemplaza.
 */

/** Vida de la URL firmada de lectura (el comprobante se abre en una pestaña nueva). */
const SEGUNDOS_URL_COMPROBANTE = 180;

export async function crearSubidaComprobante(solicitudId: string, tipo: TipoComprobante) {
  const ruta = rutaComprobante(solicitudId, randomUUID(), tipo);
  const { data, error } = await crearClienteAdmin()
    .storage.from(BUCKET_COMPROBANTES)
    .createSignedUploadUrl(ruta, { upsert: false });
  if (error || !data?.token) {
    registrar("error", { evento: "comprobante_url_subida_fallo", mensaje: error?.message });
    return null;
  }
  return { ruta, token: data.token, bucket: BUCKET_COMPROBANTES };
}

export async function borrarComprobantes(rutas: string[]) {
  if (rutas.length === 0) return;
  const { error } = await crearClienteAdmin().storage.from(BUCKET_COMPROBANTES).remove(rutas);
  if (error) registrar("error", { evento: "comprobante_borrado_fallo", mensaje: error.message });
}

/** Textos de admin_registrar_comprobante() listos para mostrar (los demás errores se ocultan). */
const MENSAJES_COMPROBANTE = [
  "Primero marca el desembolso de este crédito",
  "No puede subir el comprobante de su propio crédito; debe hacerlo otro administrador",
  "La solicitud no existe",
  "El archivo del comprobante no se encontró",
  "La ruta del comprobante no es válida",
  "Solo un administrador puede subir comprobantes",
  "Este asociado ya fue eliminado; su comprobante ya no se puede cambiar",
];

export type ResultadoComprobante = { ok: true } | { ok: false; error: string };

/**
 * Verifica el archivo subido y lo registra en la solicitud. `supabase` es el
 * cliente con la SESIÓN del admin (la RPC valida es_admin con auth.uid()).
 */
export async function registrarComprobanteSubido(
  supabase: SupabaseClient,
  solicitudId: string,
  ruta: string,
): Promise<ResultadoComprobante> {
  if (!rutaEsDeSolicitud(ruta, solicitudId)) return { ok: false, error: "El archivo del comprobante no es válido." };

  const { data: archivo, error: errorDescarga } = await crearClienteAdmin().storage.from(BUCKET_COMPROBANTES).download(ruta);
  if (errorDescarga || !archivo) {
    return { ok: false, error: "No encontramos el archivo subido. Intenta de nuevo." };
  }
  const detectado = await detectarTipoComprobante(archivo);
  if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO_COMPROBANTE || !detectado || !ruta.endsWith(`.${detectado.extension}`)) {
    registrar("warn", { evento: "comprobante_archivo_invalido", solicitud_id: solicitudId });
    await borrarComprobantes([ruta]);
    return { ok: false, error: "El comprobante debe ser una imagen JPG, PNG o WEBP, o un PDF de máximo 5 MB." };
  }

  const { data: anterior, error } = await supabase.rpc("admin_registrar_comprobante", {
    p_solicitud_id: solicitudId,
    p_ruta: ruta,
  });
  if (error) {
    const conocido = MENSAJES_COMPROBANTE.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "comprobante_registrar_fallo", codigo: error.code, mensaje: error.message, solicitud_id: solicitudId });
    }
    // El archivo quedó huérfano: se borra para no acumular.
    await borrarComprobantes([ruta]);
    return { ok: false, error: conocido ? `${conocido}.` : "No pudimos guardar el comprobante. Intenta de nuevo." };
  }
  if (typeof anterior === "string" && anterior && anterior !== ruta) await borrarComprobantes([anterior]);
  return { ok: true };
}

/** URL firmada de corta duración para abrir un comprobante (null si no se pudo firmar). */
export async function firmarComprobante(ruta: string): Promise<string | null> {
  const { data, error } = await crearClienteAdmin()
    .storage.from(BUCKET_COMPROBANTES)
    .createSignedUrl(ruta, SEGUNDOS_URL_COMPROBANTE);
  if (error || !data?.signedUrl) {
    registrar("error", { evento: "comprobante_firma_fallo", mensaje: error?.message });
    return null;
  }
  return data.signedUrl;
}

/** Ruta guardada de una solicitud (service role: la columna no se concede a authenticated). */
export async function rutaDeComprobante(solicitudId: string): Promise<string | null> {
  const { data } = await crearClienteAdmin()
    .from("solicitudes_credito")
    .select("comprobante_path")
    .eq("id", solicitudId)
    .maybeSingle();
  return (data?.comprobante_path as string | null | undefined) ?? null;
}
