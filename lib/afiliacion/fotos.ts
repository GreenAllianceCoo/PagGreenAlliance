import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";

/** Bucket privado de spec-fase-2 §3 (migración 20260924000400). */
const BUCKET = "afiliacion-documentos";

const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  const extension = EXTENSION_POR_TIPO[archivo.type] ?? "jpg";
  // <uuid> en el nombre: rutas no predecibles (spec-fase-2 §3), aunque hoy no haya
  // ninguna política de storage.objects que dependa de eso.
  const ruta = `${cedula}/${randomUUID()}-${tipo}.${extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type,
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
