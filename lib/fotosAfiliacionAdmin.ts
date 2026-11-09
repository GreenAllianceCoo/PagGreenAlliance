import {
  CAMPOS_FOTO,
  TAMANO_MAXIMO_FOTO,
  TIPOS_FOTO_PERMITIDOS,
  type CampoFoto,
  type TipoFotoPermitido,
} from "@/lib/validaciones/afiliacion";

/**
 * Cambiar las fotos de afiliación desde /admin/asociados/[id] (pedido de Sebas, 8-nov):
 * reglas puras, usadas por el navegador (validar antes de subir) y por el servidor
 * (validar de nuevo). Las fotos viven en el bucket privado `afiliacion-documentos`.
 *
 * La foto nueva va en el MISMO prefijo de la solicitud de afiliación
 * («solicitudes/<solicitud>/<frente|reverso|selfie>-<uuid>.<ext>»): así la limpieza de
 * fotos huérfanas no la borra mientras la solicitud exista, y la base solo acepta
 * rutas de ESA solicitud y ESE campo (admin_cambiar_foto_afiliacion).
 */

export const CAMPOS_FOTO_AFILIACION = Object.keys(CAMPOS_FOTO) as CampoFoto[];

export const ETIQUETA_FOTO_AFILIACION: Record<CampoFoto, string> = {
  foto_cedula_frente: "Cédula (frente)",
  foto_cedula_reverso: "Cédula (reverso)",
  foto_selfie: "Selfie",
};

export const TEXTO_FORMATOS_FOTO_AFILIACION = "JPG, PNG o WEBP, máximo 5 MB";
export const ACEPTA_FOTO_AFILIACION = TIPOS_FOTO_PERMITIDOS.join(",");

const EXTENSION: Record<TipoFotoPermitido, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function esCampoFoto(valor: string): valor is CampoFoto {
  return (CAMPOS_FOTO_AFILIACION as string[]).includes(valor);
}

export function esTipoFotoAfiliacion(tipo: string): tipo is TipoFotoPermitido {
  return (TIPOS_FOTO_PERMITIDOS as readonly string[]).includes(tipo);
}

/** Mensaje de error del archivo elegido, o null si sirve. */
export function errorDeArchivoFotoAfiliacion(archivo: { type: string; size: number }): string | null {
  if (archivo.size === 0) return "El archivo está vacío.";
  if (!esTipoFotoAfiliacion(archivo.type)) return "La foto debe ser JPG, PNG o WEBP.";
  if (archivo.size > TAMANO_MAXIMO_FOTO) return "La foto pesa más de 5 MB.";
  return null;
}

/** Ruta dentro del bucket (sin el nombre del bucket). */
export function rutaCambioFoto(solicitudId: string, campo: CampoFoto, identificador: string, tipo: TipoFotoPermitido) {
  return `solicitudes/${solicitudId}/${CAMPOS_FOTO[campo]}-${identificador}.${EXTENSION[tipo]}`;
}

/** true si la ruta es la de un cambio de ESE campo dentro del prefijo de ESA solicitud. */
export function rutaEsCambioFoto(ruta: string, solicitudId: string, campo: CampoFoto) {
  return new RegExp(`^solicitudes/${solicitudId}/${CAMPOS_FOTO[campo]}-[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(ruta);
}
