"use server";

import { revalidatePath } from "next/cache";
import {
  borrarDocumentosProceso,
  crearSubidaDocumentoProceso,
  urlDescargaDocumento,
  verificarDocumentoSubido,
} from "@/lib/admin/documentosProceso";
import { exigirAdmin } from "@/lib/admin/servidor";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import {
  esquemaGuardarDocumentoProceso,
  esquemaPrepararDocumentoProceso,
  esquemaQuitarDocumentoProceso,
} from "@/lib/validaciones/admin";

/** Textos de las RPC de documentos listos para mostrar (los demás errores se ocultan). */
const MENSAJES_DOCUMENTO = [
  "No puedes subir documentos a tu propio proceso; debe hacerlo otro administrador",
  "No puedes quitar documentos de tu propio proceso; debe hacerlo otro administrador",
  "No encontramos al asociado",
  "El archivo del documento no se encontró",
  "El documento debe pesar máximo 10 MB",
  "Ese documento ya no está en el proceso",
];

const mensajeConocido = (texto: string | undefined) => MENSAJES_DOCUMENTO.find((m) => texto?.includes(m));

export type RespuestaPrepararDocumento = { ok: true; ruta: string; token: string; bucket: string } | { ok: false; error: string };
export type RespuestaDocumento = { mensaje?: string; error?: string };

/** «Subir documento» (solo admin), paso 1: URL firmada para subir el PDF directo a Storage. */
export async function prepararSubidaDocumentoProceso(entrada: {
  asociadoId: string;
  tamano: number;
}): Promise<RespuestaPrepararDocumento> {
  const { supabase, userId } = await exigirAdmin();
  const r = esquemaPrepararDocumentoProceso.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Datos inválidos." };
  if (r.data.asociadoId === userId) {
    return { ok: false, error: "No puedes subir documentos a tu propio proceso; debe hacerlo otro administrador." };
  }
  const { data } = await supabase.from("perfiles").select("rol, eliminado_at").eq("id", r.data.asociadoId).maybeSingle();
  if (!data || data.rol !== "asociado" || data.eliminado_at) return { ok: false, error: "No encontramos al asociado." };
  if (!(await dentroDelLimite("admin-documento-proceso", userId, 30, 60 * 60))) {
    return { ok: false, error: "Subiste muchos documentos seguidos. Intenta de nuevo en una hora." };
  }
  const subida = await crearSubidaDocumentoProceso(r.data.asociadoId);
  if (!subida) return { ok: false, error: "No pudimos preparar la subida. Intenta de nuevo." };
  return { ok: true, ...subida };
}

/** Paso 2: verifica el PDF subido y lo liga al proceso (la base deja quién y cuándo). */
export async function guardarDocumentoProceso(entrada: {
  asociadoId: string;
  ruta: string;
  nombre: string;
}): Promise<RespuestaDocumento> {
  const { supabase } = await exigirAdmin();
  const r = esquemaGuardarDocumentoProceso.safeParse(entrada);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const { asociadoId, ruta, nombre } = r.data;

  const malo = await verificarDocumentoSubido(asociadoId, ruta);
  if (malo) return { error: malo };

  const { error } = await supabase.rpc("admin_registrar_documento_proceso", {
    p_asociado_id: asociadoId,
    p_ruta: ruta,
    p_nombre: nombre,
  });
  if (error) {
    const conocido = mensajeConocido(error.message);
    if (!conocido) registrar("error", { evento: "documento_proceso_registrar_fallo", codigo: error.code, mensaje: error.message });
    await borrarDocumentosProceso([ruta]);
    return { error: conocido ? `${conocido}.` : "No pudimos guardar el documento. Intenta de nuevo." };
  }
  revalidatePath(`/admin/asociados/${asociadoId}`);
  revalidatePath("/admin/cambios");
  return { mensaje: "Documento guardado." };
}

/** «Descargar»: URL firmada de 2 minutos (solo admin). */
export async function urlDescargaDocumentoProceso(entrada: { documentoId: string }): Promise<{ url?: string; error?: string }> {
  await exigirAdmin();
  const id = typeof entrada?.documentoId === "string" ? entrada.documentoId : "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "No encontramos el documento." };
  const url = await urlDescargaDocumento(id);
  return url ? { url } : { error: "No pudimos descargar el documento. Recarga la página e intenta de nuevo." };
}

/** «Quitar» (con motivo): la fila queda en «Cambios» y el archivo se borra. */
export async function quitarDocumentoProceso(entrada: {
  asociadoId: string;
  documentoId: string;
  motivo: string;
}): Promise<RespuestaDocumento> {
  const { supabase } = await exigirAdmin();
  const r = esquemaQuitarDocumentoProceso.safeParse(entrada);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const { data, error } = await supabase.rpc("admin_quitar_documento_proceso", {
    p_documento_id: r.data.documentoId,
    p_motivo: r.data.motivo,
  });
  if (error) {
    const conocido = mensajeConocido(error.message);
    if (!conocido) registrar("error", { evento: "documento_proceso_quitar_fallo", codigo: error.code, mensaje: error.message });
    return { error: conocido ? `${conocido}.` : "No pudimos quitar el documento. Intenta de nuevo." };
  }
  if (typeof data === "string" && data) await borrarDocumentosProceso([data]);
  if (/^[0-9a-f-]{36}$/.test(entrada.asociadoId)) revalidatePath(`/admin/asociados/${entrada.asociadoId}`);
  revalidatePath("/admin/cambios");
  return { mensaje: "Documento quitado." };
}
