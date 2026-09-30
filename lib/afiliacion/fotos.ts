import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";
import {
  CAMPOS_FOTO,
  TAMANO_MAXIMO_FOTO,
  type CampoFoto,
  type EntradaPrepararSubida,
  type TipoFotoPermitido,
} from "@/lib/validaciones/afiliacion";

/**
 * Fotos de /afiliacion con *signed upload URLs* (spec-requerimientos-ricardo
 * §2.10). Antes las 3 fotos viajaban dentro de la Server Action (límite de
 * 4,5 MB en Vercel) y por eso se comprimían hasta verse borrosas.
 *
 * Flujo:
 *  1. `prepararSubidaFotos` (Server Action) crea un id de solicitud nuevo y,
 *     con service role, una URL firmada de subida por foto bajo el prefijo
 *     `solicitudes/<id>/`. Devuelve rutas + tokens + un TICKET firmado (HMAC)
 *     que ata ese prefijo y su vencimiento.
 *  2. El navegador sube cada foto con `uploadToSignedUrl` (sin sesión: el
 *     token de la URL es el permiso). El bucket sigue siendo privado y sus
 *     límites (5 MB, jpeg/png/webp) los aplica Storage también aquí.
 *  3. `enviarAfiliacion` solo recibe las RUTAS + el ticket: verifica la
 *     firma, que cada ruta sea exactamente la de ese prefijo, que el archivo
 *     exista, que pese ≤ 5 MB y que sus primeros bytes sean de verdad
 *     JPEG/PNG/WEBP (S-04). La fila se crea con `id = <id del prefijo>`, así
 *     un ticket no sirve para dos solicitudes.
 */

/** Bucket privado de spec-fase-2 §3 (migración 20260924000400). */
export const BUCKET_AFILIACION = "afiliacion-documentos";
/** Las URLs firmadas de subida de Supabase duran 2 horas. */
export const VIDA_TICKET_SEGUNDOS = 2 * 60 * 60;
const PREFIJO_RUTAS = "solicitudes";

// ---------------------------------------------------------------------------
// Tipos de imagen (S-04: por los bytes, no por lo que declare el navegador)
// ---------------------------------------------------------------------------

export type TipoImagenDetectado = { mime: TipoFotoPermitido; extension: "jpg" | "png" | "webp" };

export const EXTENSION_DE_TIPO: Record<TipoFotoPermitido, TipoImagenDetectado["extension"]> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Detecta JPEG (FF D8 FF), PNG (89 50 4E 47) o WebP (RIFF....WEBP) por sus primeros bytes. */
export async function detectarTipoImagen(archivo: Blob): Promise<TipoImagenDetectado | null> {
  const cabecera = new Uint8Array(await archivo.slice(0, 12).arrayBuffer());
  if (cabecera[0] === 0xff && cabecera[1] === 0xd8 && cabecera[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (cabecera[0] === 0x89 && cabecera[1] === 0x50 && cabecera[2] === 0x4e && cabecera[3] === 0x47) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    cabecera[0] === 0x52 && // R
    cabecera[1] === 0x49 && // I
    cabecera[2] === 0x46 && // F
    cabecera[3] === 0x46 && // F
    cabecera[8] === 0x57 && // W
    cabecera[9] === 0x45 && // E
    cabecera[10] === 0x42 && // B
    cabecera[11] === 0x50 // P
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ticket firmado (prefijo + vencimiento)
// ---------------------------------------------------------------------------

/**
 * Secreto del ticket. Se reutiliza LIMITE_HMAC_SECRET (ya obligatorio en
 * Vercel, next.config.mjs) con una etiqueta propia («afiliacion-fotos:»), así
 * que una firma de aquí no sirve como clave del limitador ni al revés.
 */
function secretoTicket(): string | null {
  const secreto = process.env.LIMITE_HMAC_SECRET;
  return secreto && secreto.length >= 32 ? secreto : null;
}

function firmar(solicitudId: string, vence: number, secreto: string) {
  return createHmac("sha256", secreto).update(`afiliacion-fotos:${solicitudId}:${vence}`).digest("base64url");
}

/** «<uuid>.<vence epoch s>.<firma>». */
export function crearTicketFotos(solicitudId: string, secreto: string, ahoraMs = Date.now()) {
  const vence = Math.floor(ahoraMs / 1000) + VIDA_TICKET_SEGUNDOS;
  return `${solicitudId}.${vence}.${firmar(solicitudId, vence, secreto)}`;
}

/** Id de la solicitud si el ticket es auténtico y no ha vencido; si no, null. */
export function leerTicketFotos(ticket: string, secreto: string, ahoraMs = Date.now()): string | null {
  const partes = ticket.split(".");
  if (partes.length !== 3) return null;
  const [solicitudId, venceTexto, firma] = partes;
  if (!/^[0-9a-f-]{36}$/.test(solicitudId) || !/^[0-9]{1,12}$/.test(venceTexto)) return null;
  const vence = Number(venceTexto);
  const esperada = Buffer.from(firmar(solicitudId, vence, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  if (Math.floor(ahoraMs / 1000) > vence) return null;
  return solicitudId;
}

/** Ruta de una foto dentro del bucket (sin el nombre del bucket). */
export function rutaFoto(solicitudId: string, campo: CampoFoto, tipo: TipoFotoPermitido) {
  return `${PREFIJO_RUTAS}/${solicitudId}/${CAMPOS_FOTO[campo]}.${EXTENSION_DE_TIPO[tipo]}`;
}

/** true si la ruta es la de ESA foto dentro del prefijo de ESA solicitud. */
export function rutaEsDelPrefijo(ruta: string, solicitudId: string, campo: CampoFoto) {
  const patron = new RegExp(`^${PREFIJO_RUTAS}/${solicitudId}/${CAMPOS_FOTO[campo]}\\.(jpg|png|webp)$`);
  return patron.test(ruta);
}

// ---------------------------------------------------------------------------
// 1. Emitir URLs firmadas
// ---------------------------------------------------------------------------

export type SubidaFoto = { ruta: string; token: string };
export type SubidasAfiliacion = {
  ticket: string;
  bucket: typeof BUCKET_AFILIACION;
  fotos: Record<CampoFoto, SubidaFoto>;
};

/** Crea el prefijo de una solicitud nueva y una URL firmada de subida por foto (service role). */
export async function crearSubidasAfiliacion(
  admin: SupabaseClient,
  tipos: EntradaPrepararSubida,
): Promise<SubidasAfiliacion> {
  const secreto = secretoTicket();
  if (!secreto) {
    registrar("error", { evento: "afiliacion_fotos_sin_secreto" });
    throw new Error("Falta LIMITE_HMAC_SECRET");
  }
  const solicitudId = randomUUID();
  const campos = Object.keys(CAMPOS_FOTO) as CampoFoto[];
  const fotos = {} as Record<CampoFoto, SubidaFoto>;
  for (const campo of campos) {
    const ruta = rutaFoto(solicitudId, campo, tipos[campo]);
    const { data, error } = await admin.storage.from(BUCKET_AFILIACION).createSignedUploadUrl(ruta, { upsert: false });
    if (error || !data?.token) {
      registrar("error", { evento: "afiliacion_url_subida_fallo", campo, mensaje: error?.message });
      throw new Error("No se pudo crear la URL de subida.");
    }
    fotos[campo] = { ruta, token: data.token };
  }
  return { ticket: crearTicketFotos(solicitudId, secreto), bucket: BUCKET_AFILIACION, fotos };
}

// ---------------------------------------------------------------------------
// 2. Verificar lo subido (envío final)
// ---------------------------------------------------------------------------

export type RutasFotosAfiliacion = Record<CampoFoto, string>;

export type VerificacionFotos =
  | {
      ok: true;
      solicitudId: string;
      /** Para las columnas foto_* (con el nombre del bucket delante, como antes). */
      columnas: RutasFotosAfiliacion;
      /** Rutas sin el bucket (para borrarlas si el insert falla). */
      rutas: string[];
    }
  | {
      ok: false;
      /** null = ticket inválido o vencido: no se sabe de qué prefijo son las rutas (no se borra nada). */
      solicitudId: string | null;
      /** Campo al que corresponde el problema (null = general). */
      campo: CampoFoto | null;
      motivo: "ticket" | "ruta" | "falta" | "peso" | "tipo";
    };

/** Id del prefijo si el ticket es válido (para limpiar si el envío falla antes de verificar). */
export function solicitudIdDeTicket(ticket: string): string | null {
  const secreto = secretoTicket();
  return secreto ? leerTicketFotos(ticket, secreto) : null;
}

/**
 * Verifica las 3 rutas: ticket auténtico y vigente, rutas del prefijo,
 * archivo existente, ≤ 5 MB y con bytes reales de JPEG/PNG/WEBP que
 * coinciden con la extensión.
 */
export async function verificarFotosSubidas(
  admin: SupabaseClient,
  ticket: string,
  rutas: RutasFotosAfiliacion,
): Promise<VerificacionFotos> {
  const solicitudId = solicitudIdDeTicket(ticket);
  if (!solicitudId) return { ok: false, solicitudId: null, campo: null, motivo: "ticket" };

  const campos = Object.keys(CAMPOS_FOTO) as CampoFoto[];
  for (const campo of campos) {
    if (!rutaEsDelPrefijo(rutas[campo], solicitudId, campo)) {
      return { ok: false, solicitudId, campo, motivo: "ruta" };
    }
  }

  for (const campo of campos) {
    const ruta = rutas[campo];
    const { data, error } = await admin.storage.from(BUCKET_AFILIACION).download(ruta);
    if (error || !data) {
      return { ok: false, solicitudId, campo, motivo: "falta" };
    }
    if (data.size === 0 || data.size > TAMANO_MAXIMO_FOTO) {
      return { ok: false, solicitudId, campo, motivo: "peso" };
    }
    const detectado = await detectarTipoImagen(data);
    if (!detectado || !ruta.endsWith(`.${detectado.extension}`)) {
      registrar("warn", { evento: "afiliacion_foto_tipo_invalido", campo });
      return { ok: false, solicitudId, campo, motivo: "tipo" };
    }
  }

  return {
    ok: true,
    solicitudId,
    columnas: {
      foto_cedula_frente: `${BUCKET_AFILIACION}/${rutas.foto_cedula_frente}`,
      foto_cedula_reverso: `${BUCKET_AFILIACION}/${rutas.foto_cedula_reverso}`,
      foto_selfie: `${BUCKET_AFILIACION}/${rutas.foto_selfie}`,
    },
    rutas: campos.map((c) => rutas[c]),
  };
}

// ---------------------------------------------------------------------------
// 3. Limpieza
// ---------------------------------------------------------------------------

/** Borra rutas (sin el prefijo del bucket). */
export async function borrarFotosAfiliacion(admin: SupabaseClient, rutas: string[]) {
  if (rutas.length === 0) return;
  const { error } = await admin.storage.from(BUCKET_AFILIACION).remove(rutas);
  if (error) {
    registrar("error", { evento: "afiliacion_foto_borrado_fallo", mensaje: error.message });
  }
}

/**
 * Borra las fotos de un prefijo SOLO si todavía no existe una solicitud con
 * ese id. Evita que alguien que repita un envío ya aceptado (mismo ticket y
 * rutas) haga borrar las fotos de una solicitud real.
 */
export async function borrarFotosSiHuerfanas(admin: SupabaseClient, solicitudId: string, rutas: string[]) {
  const { data, error } = await admin
    .from("solicitudes_afiliacion")
    .select("id")
    .eq("id", solicitudId)
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "afiliacion_fotos_huerfanas_consulta_fallo", mensaje: error.message });
    return;
  }
  if (data) return;
  await borrarFotosAfiliacion(admin, rutas);
}
