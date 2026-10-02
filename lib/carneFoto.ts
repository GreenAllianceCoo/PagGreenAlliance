import "server-only";
import { randomUUID } from "node:crypto";
import { detectarTipoImagen } from "@/lib/afiliacion/fotos";
import {
  BUCKET_FOTOS_CARNE,
  TAMANO_MAXIMO_FOTO_CARNE,
  rutaEsDelAsociado,
  rutaFotoCarne,
  separarBucketRuta,
  type TipoFotoCarne,
} from "@/lib/fotoCarne";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Foto del carné: lado servidor (service role). Quien llama YA debe haber comprobado la
 * sesión (asociado activo, admin, o token de carné válido: ver las funciones `*PorToken`).
 * Las rutas del bucket NUNCA salen de aquí hacia el cliente: solo URLs firmadas cortas
 * (o los bytes, para el PDF).
 *
 * Qué foto sale: la propia (`fotos-carne`) y, si no hay, la selfie de la afiliación
 * (`afiliacion-documentos`). Lo decide la base (foto_carne_de_asociado / foto_carne_por_token,
 * solo service_role); esta última además exige que el asociado esté activo.
 */

/** Vida de la URL firmada de lectura (se pinta al cargar la página). */
const SEGUNDOS_URL_FOTO_CARNE = 300;

export type FotoCarne = { ruta: string; origen: "propia" | "afiliacion" };

function leerFila(data: unknown): FotoCarne | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const f = data[0] as { ruta?: unknown; origen?: unknown } | null;
  if (!f || typeof f.ruta !== "string" || (f.origen !== "propia" && f.origen !== "afiliacion")) return null;
  return { ruta: f.ruta, origen: f.origen };
}

/** Foto vigente del asociado («bucket/ruta» + origen), o null si no tiene ninguna. */
export async function fotoCarneDeAsociado(asociadoId: string): Promise<FotoCarne | null> {
  const { data, error } = await crearClienteAdmin().rpc("foto_carne_de_asociado", { p_asociado_id: asociadoId });
  if (error) {
    registrar("error", { evento: "foto_carne_consulta_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return leerFila(data);
}

/** Foto para la verificación pública: solo con token válido y asociado activo. */
export async function fotoCarnePorToken(token: string): Promise<FotoCarne | null> {
  const { data, error } = await crearClienteAdmin().rpc("foto_carne_por_token", { p_token: token.toLowerCase() });
  if (error) {
    registrar("error", { evento: "foto_carne_token_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return leerFila(data);
}

async function firmar(entrada: string): Promise<string | null> {
  const p = separarBucketRuta(entrada);
  if (!p) return null;
  const { data, error } = await crearClienteAdmin().storage.from(p.bucket).createSignedUrl(p.ruta, SEGUNDOS_URL_FOTO_CARNE);
  if (error || !data?.signedUrl) {
    // Un archivo que ya no existe (p. ej. selfie purgada) no es un error de servidor: sin foto.
    registrar("warn", { evento: "foto_carne_firma_fallo", mensaje: error?.message });
    return null;
  }
  return data.signedUrl;
}

export type UrlFotoCarne = { url: string; origen: "propia" | "afiliacion" };

export async function urlFotoCarneDeAsociado(asociadoId: string): Promise<UrlFotoCarne | null> {
  const foto = await fotoCarneDeAsociado(asociadoId);
  const url = foto ? await firmar(foto.ruta) : null;
  return foto && url ? { url, origen: foto.origen } : null;
}

export async function urlFotoCarnePorToken(token: string): Promise<string | null> {
  const foto = await fotoCarnePorToken(token);
  return foto ? firmar(foto.ruta) : null;
}

/** Bytes de la foto para incrustarla en el PDF (solo JPEG o PNG; WEBP no se incrusta). */
export async function fotoCarneParaPdf(asociadoId: string): Promise<{ bytes: Uint8Array; tipo: "jpg" | "png" } | null> {
  const foto = await fotoCarneDeAsociado(asociadoId);
  const p = foto ? separarBucketRuta(foto.ruta) : null;
  if (!p) return null;
  const { data, error } = await crearClienteAdmin().storage.from(p.bucket).download(p.ruta);
  if (error || !data || data.size === 0 || data.size > TAMANO_MAXIMO_FOTO_CARNE) return null;
  const tipo = await detectarTipoImagen(data);
  if (!tipo || tipo.extension === "webp") return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), tipo: tipo.extension };
}

// ---------------------------------------------------------------------------
// Subir / reemplazar / quitar
// ---------------------------------------------------------------------------

/** URL firmada para que el navegador suba la foto directo a Storage. */
export async function crearSubidaFotoCarne(asociadoId: string, tipo: TipoFotoCarne) {
  const ruta = rutaFotoCarne(asociadoId, randomUUID(), tipo);
  const { data, error } = await crearClienteAdmin()
    .storage.from(BUCKET_FOTOS_CARNE)
    .createSignedUploadUrl(ruta, { upsert: false });
  if (error || !data?.token) {
    registrar("error", { evento: "foto_carne_url_subida_fallo", mensaje: error?.message });
    return null;
  }
  return { ruta, token: data.token, bucket: BUCKET_FOTOS_CARNE };
}

async function borrarArchivos(rutas: string[]) {
  if (rutas.length === 0) return;
  const { error } = await crearClienteAdmin().storage.from(BUCKET_FOTOS_CARNE).remove(rutas);
  if (error) registrar("error", { evento: "foto_carne_borrado_fallo", mensaje: error.message });
}

/** Borra de la carpeta del asociado todo lo que no sea la foto vigente (subidas que no se confirmaron). */
async function limpiarHuerfanas(asociadoId: string, vigente: string | null) {
  const { data } = await crearClienteAdmin().storage.from(BUCKET_FOTOS_CARNE).list(asociadoId, { limit: 100 });
  const sobrantes = (data ?? []).map((o) => `${asociadoId}/${o.name}`).filter((r) => r !== vigente);
  await borrarArchivos(sobrantes);
}

/** Textos de registrar_foto_carne() listos para mostrar (los demás errores se ocultan). */
const MENSAJE_LIMITE = "Cambiaste la foto muchas veces seguidas";

export type ResultadoFotoCarne = { ok: true } | { ok: false; error: string };

/**
 * Verifica el archivo subido (existe, ≤ 5 MB, bytes reales de JPEG/PNG/WEBP que
 * coinciden con la extensión) y lo liga al asociado. Borra la foto anterior.
 */
export async function registrarFotoCarneSubida(asociadoId: string, ruta: string): Promise<ResultadoFotoCarne> {
  if (!rutaEsDelAsociado(ruta, asociadoId)) return { ok: false, error: "La foto no es válida." };
  const admin = crearClienteAdmin();

  const { data: archivo, error: errorDescarga } = await admin.storage.from(BUCKET_FOTOS_CARNE).download(ruta);
  if (errorDescarga || !archivo) return { ok: false, error: "No encontramos la foto subida. Intenta de nuevo." };
  const detectado = await detectarTipoImagen(archivo);
  if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO_FOTO_CARNE || !detectado || !ruta.endsWith(`.${detectado.extension}`)) {
    registrar("warn", { evento: "foto_carne_archivo_invalido" });
    await borrarArchivos([ruta]);
    return { ok: false, error: "La foto debe ser una imagen JPG, PNG o WEBP de máximo 5 MB." };
  }

  const { error } = await admin.rpc("registrar_foto_carne", { p_asociado_id: asociadoId, p_ruta: ruta });
  if (error) {
    const limite = error.message?.includes(MENSAJE_LIMITE);
    if (!limite) registrar("error", { evento: "foto_carne_registrar_fallo", codigo: error.code, mensaje: error.message });
    await borrarArchivos([ruta]);
    return {
      ok: false,
      error: limite
        ? "Cambiaste la foto muchas veces seguidas. Intenta de nuevo en un rato."
        : "No pudimos guardar la foto. Intenta de nuevo.",
    };
  }
  await limpiarHuerfanas(asociadoId, ruta);
  return { ok: true };
}

/** «Volver a mi selfie de afiliación»: quita la foto propia y borra su archivo. */
export async function quitarFotoCarneDe(asociadoId: string): Promise<ResultadoFotoCarne> {
  const { error } = await crearClienteAdmin().rpc("quitar_foto_carne", { p_asociado_id: asociadoId });
  if (error) {
    registrar("error", { evento: "foto_carne_quitar_fallo", codigo: error.code, mensaje: error.message });
    return { ok: false, error: "No pudimos quitar la foto. Intenta de nuevo." };
  }
  await limpiarHuerfanas(asociadoId, null);
  return { ok: true };
}
