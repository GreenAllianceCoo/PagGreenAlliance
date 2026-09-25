import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/** Vida de la URL firmada de una foto (spec §3: «60–300 s»). */
const SEGUNDOS_URL_FOTO = 180;

/** El bucket privado a veces guarda la ruta con el nombre del bucket adelante
 * (ver supabase/seed.sql: `afiliacion-documentos/<cedula>/...`); Storage
 * necesita la ruta SIN ese prefijo. */
function rutaSinBucket(ruta: string) {
  return ruta.startsWith("afiliacion-documentos/") ? ruta.slice("afiliacion-documentos/".length) : ruta;
}

/**
 * Devuelve una URL firmada de corta duración para una foto del bucket
 * privado `afiliacion-documentos`. Quien llama YA debe haber comprobado
 * `exigirAdmin()` antes: esta función solo firma, no vuelve a validar el rol
 * (spec §3: primero se confirma admin con el cliente normal, luego se firma
 * con service role).
 */
export async function urlFirmadaFoto(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  const admin = crearClienteAdmin();
  const { data, error } = await admin.storage
    .from("afiliacion-documentos")
    .createSignedUrl(rutaSinBucket(ruta), SEGUNDOS_URL_FOTO);
  if (error || !data?.signedUrl) {
    registrar("error", { evento: "afiliacion_foto_firma_fallo", mensaje: error?.message });
    return null;
  }
  return data.signedUrl;
}

/** Firma las 3 fotos de una solicitud en paralelo. */
export async function urlsFirmadasAfiliacion(rutas: {
  foto_cedula_frente: string | null;
  foto_cedula_reverso: string | null;
  foto_selfie: string | null;
}) {
  const [frente, reverso, selfie] = await Promise.all([
    urlFirmadaFoto(rutas.foto_cedula_frente),
    urlFirmadaFoto(rutas.foto_cedula_reverso),
    urlFirmadaFoto(rutas.foto_selfie),
  ]);
  return { frente, reverso, selfie };
}
