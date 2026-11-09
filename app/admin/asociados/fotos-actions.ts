"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import {
  afiliacionVigenteDe,
  borrarFotoAfiliacion,
  crearSubidaCambioFoto,
  verificarFotoSubida,
} from "@/lib/admin/fotosAfiliacionAsociado";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { esquemaGuardarCambioFoto, esquemaPrepararCambioFoto } from "@/lib/validaciones/admin";

/** Textos de admin_cambiar_foto_afiliacion() listos para mostrar (los demás errores se ocultan). */
const MENSAJES_CAMBIO_FOTO = [
  "No puedes cambiar tus propias fotos; debe hacerlo otro administrador",
  "No encontramos al asociado",
  "Es uno de tus clientes: otro administrador debe cambiar sus fotos",
  "El asociado no tiene una afiliación aprobada con fotos",
  "El archivo de la foto no se encontró",
  "Esa ya es la foto actual",
];

export type RespuestaPrepararCambioFoto = { ok: true; ruta: string; token: string; bucket: string } | { ok: false; error: string };
export type RespuestaCambioFoto = { mensaje?: string; error?: string };

/**
 * Reglas que la base vuelve a revisar, comprobadas antes de subir nada: no a sí mismo
 * ni a sus clientes (la selfie sale en el carné y sirve para reconocer a la persona).
 */
async function revisarAsociado(
  supabase: Awaited<ReturnType<typeof exigirAdmin>>["supabase"],
  userId: string,
  asociadoId: string,
): Promise<string | null> {
  if (asociadoId === userId) return "No puedes cambiar tus propias fotos; debe hacerlo otro administrador.";
  const { data } = await supabase.from("perfiles").select("rol, asesor_id, eliminado_at").eq("id", asociadoId).maybeSingle();
  if (!data || data.rol !== "asociado" || data.eliminado_at) return "No encontramos al asociado.";
  if (data.asesor_id === userId) return "Es uno de tus clientes: otro administrador debe cambiar sus fotos.";
  return null;
}

/**
 * «Cambiar foto» (solo admin), paso 1: URL firmada para subir la foto nueva al prefijo de
 * la afiliación vigente del asociado. El archivo no pasa por la Server Action.
 */
export async function prepararCambioFotoAfiliacion(entrada: {
  asociadoId: string;
  campo: string;
  tipo: string;
  tamano: number;
}): Promise<RespuestaPrepararCambioFoto> {
  const { supabase, userId } = await exigirAdmin();
  const r = esquemaPrepararCambioFoto.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const bloqueo = await revisarAsociado(supabase, userId, r.data.asociadoId);
  if (bloqueo) return { ok: false, error: bloqueo };
  if (!(await dentroDelLimite("admin-cambiar-foto", userId, 20, 60 * 60))) {
    return { ok: false, error: "Hiciste muchos cambios seguidos. Intenta de nuevo en una hora." };
  }
  const solicitudId = await afiliacionVigenteDe(r.data.asociadoId);
  if (!solicitudId) return { ok: false, error: "El asociado no tiene una afiliación aprobada con fotos." };
  const subida = await crearSubidaCambioFoto(solicitudId, r.data.campo, r.data.tipo);
  if (!subida) return { ok: false, error: "No pudimos preparar la subida. Intenta de nuevo." };
  return { ok: true, ...subida };
}

/**
 * Paso 2: verifica la foto subida y la registra con admin_cambiar_foto_afiliacion (con la
 * sesión del admin). La foto anterior se conserva: queda visible en «Cambios».
 */
export async function guardarCambioFotoAfiliacion(entrada: {
  asociadoId: string;
  campo: string;
  ruta: string;
  motivo: string;
}): Promise<RespuestaCambioFoto> {
  const { supabase, userId } = await exigirAdmin();
  const r = esquemaGuardarCambioFoto.safeParse(entrada);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const { asociadoId, campo, ruta, motivo } = r.data;

  const solicitudId = await afiliacionVigenteDe(asociadoId);
  if (!solicitudId) return { error: "El asociado no tiene una afiliación aprobada con fotos." };
  const malo = await verificarFotoSubida(solicitudId, campo, ruta);
  if (malo) return { error: malo };

  const { error } = await supabase.rpc("admin_cambiar_foto_afiliacion", {
    p_asociado_id: asociadoId,
    p_campo: campo,
    p_ruta: ruta,
    p_motivo: motivo,
  });
  if (error) {
    const conocido = MENSAJES_CAMBIO_FOTO.find((m) => error.message?.includes(m));
    if (!conocido) registrar("error", { evento: "cambio_foto_afiliacion_fallo", codigo: error.code, mensaje: error.message });
    // El archivo quedó sin usar: se borra para no acumular.
    await borrarFotoAfiliacion(ruta);
    return { error: conocido ? `${conocido}.` : "No pudimos guardar la foto. Intenta de nuevo." };
  }
  registrar("info", { evento: "cambio_foto_afiliacion", asociadoId, campo, admin: userId });
  revalidatePath(`/admin/asociados/${asociadoId}`);
  revalidatePath("/admin/cambios");
  return { mensaje: "Foto actualizada. La anterior quedó en «Cambios»." };
}
