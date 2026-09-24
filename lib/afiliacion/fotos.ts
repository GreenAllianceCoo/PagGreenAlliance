import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";

/** Bucket privado de spec-fase-2 §3 (migración 20260924000400). */
const BUCKET = "afiliacion-documentos";

/**
 * S-04 (revisión de seguridad 2026-09-24): `archivo.type` lo declara el
 * navegador (viene del `Content-Type` que el cliente decide poner en el
 * `FormData`); nada impide que alguien mande bytes de otro formato con esa
 * etiqueta falsa. Aquí se lee la "firma" real de los primeros bytes del
 * archivo (magic bytes) y se sube con el tipo REALMENTE detectado, nunca con
 * el que dijo el navegador.
 */
export type TipoImagenDetectado = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

/** Detecta JPEG (FF D8 FF), PNG (89 50 4E 47) o WebP (RIFF....WEBP) por sus primeros bytes. */
export async function detectarTipoImagen(archivo: File | Blob): Promise<TipoImagenDetectado | null> {
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

export type FotosAfiliacion = {
  cedulaFrente: File;
  cedulaReverso: File;
  selfie: File;
};

/** Lo que se guarda en las columnas `foto_*` de la solicitud (con el nombre del bucket, spec-fase-2 §2). */
export type RutasFotosAfiliacion = {
  foto_cedula_frente: string;
  foto_cedula_reverso: string;
  foto_selfie: string;
};

export type ResultadoSubidaFotos = {
  /** Para guardar en la fila de `solicitudes_afiliacion`. */
  columnas: RutasFotosAfiliacion;
  /** Las mismas 3 rutas SIN el prefijo del bucket, para poder borrarlas con `remove()` si el insert falla después. */
  rutas: string[];
};

async function subirUna(
  admin: SupabaseClient,
  cedula: string,
  tipo: "frente" | "reverso" | "selfie",
  archivo: File,
): Promise<string> {
  // S-04: se sube con el tipo detectado por los bytes reales, nunca con
  // `archivo.type` (lo declara el navegador y se puede falsificar).
  const detectado = await detectarTipoImagen(archivo);
  if (!detectado) {
    registrar("error", { evento: "afiliacion_foto_tipo_invalido", tipo });
    throw new Error(`La foto (${tipo}) no es una imagen JPG, PNG o WEBP válida.`);
  }
  // <uuid> en el nombre: rutas no predecibles (spec-fase-2 §3), aunque hoy no haya
  // ninguna política de storage.objects que dependa de eso.
  const ruta = `${cedula}/${randomUUID()}-${tipo}.${detectado.extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: detectado.mime,
    upsert: false,
  });
  if (error) {
    registrar("error", { evento: "afiliacion_foto_subida_fallo", tipo, mensaje: error.message });
    throw new Error(`No se pudo subir la foto (${tipo}).`);
  }
  return ruta;
}

/** Borra rutas ya subidas (sin el prefijo del bucket) cuando algo falla después de subirlas. */
export async function borrarFotosAfiliacion(admin: SupabaseClient, rutas: string[]) {
  if (rutas.length === 0) return;
  const { error } = await admin.storage.from(BUCKET).remove(rutas);
  if (error) {
    registrar("error", { evento: "afiliacion_foto_borrado_fallo", mensaje: error.message });
  }
}

/**
 * Sube las 3 fotos al bucket privado, con el cliente de `service_role`
 * (spec-fase-2 §3: sin política de storage.objects, solo el servidor puede
 * subir). Si una subida falla, borra las que ya se hubieran subido antes de
 * relanzar el error: nunca quedan fotos «sueltas» sin una solicitud.
 */
export async function subirFotosAfiliacion(
  admin: SupabaseClient,
  cedula: string,
  fotos: FotosAfiliacion,
): Promise<ResultadoSubidaFotos> {
  const subidas: string[] = [];
  try {
    const frente = await subirUna(admin, cedula, "frente", fotos.cedulaFrente);
    subidas.push(frente);
    const reverso = await subirUna(admin, cedula, "reverso", fotos.cedulaReverso);
    subidas.push(reverso);
    const selfie = await subirUna(admin, cedula, "selfie", fotos.selfie);
    subidas.push(selfie);
    return {
      columnas: {
        foto_cedula_frente: `${BUCKET}/${frente}`,
        foto_cedula_reverso: `${BUCKET}/${reverso}`,
        foto_selfie: `${BUCKET}/${selfie}`,
      },
      rutas: subidas,
    };
  } catch (error) {
    await borrarFotosAfiliacion(admin, subidas);
    throw error;
  }
}
