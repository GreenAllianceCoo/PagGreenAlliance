"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { textoDe } from "@/lib/validaciones/comunes";

export type EstadoPlataforma = { error?: string; mensaje?: string };

/** Textos de las funciones de la base listos para mostrar. */
const MENSAJES_DE_LA_BASE = [
  "El mensaje debe tener entre 5 y 300 caracteres",
  "El título debe tener entre 3 y 80 caracteres",
  "El mensaje debe tener entre 5 y 1000 caracteres",
  "El aviso no existe o ya estaba retirado",
];

function mensajeDeError(evento: string, error: { code?: string; message?: string }) {
  const conocido = MENSAJES_DE_LA_BASE.find((m) => error.message?.includes(m));
  if (!conocido) registrar("error", { evento, codigo: error.code, mensaje: error.message });
  return conocido ? `${conocido}.` : "No pudimos guardar el cambio. Intenta de nuevo.";
}

function limpiar(texto: string) {
  return texto.replace(/\r\n/g, "\n").trim();
}

/**
 * «Pausar el ingreso de asociados» / «Reanudar» (pedido de Sebas, 18-oct):
 * solo admin, por la RPC admin_cambiar_pausa_cuenta (deja historial). Campos:
 * `pausada` («true» / «false») y `mensaje` opcional (5 a 300) que ve el asociado.
 */
export async function cambiarPausaCuenta(_previo: EstadoPlataforma, formData: FormData): Promise<EstadoPlataforma> {
  const { supabase, userId } = await exigirAdmin();
  const pausada = textoDe(formData, "pausada");
  if (pausada !== "true" && pausada !== "false") return { error: "Elige una acción válida." };
  const mensaje = limpiar(textoDe(formData, "mensaje"));
  if (mensaje && (mensaje.length < 5 || mensaje.length > 300)) {
    return { error: "El mensaje debe tener entre 5 y 300 caracteres." };
  }
  if (!(await dentroDelLimite("admin-pausa-cuenta", userId, 20, 60 * 60))) {
    return { error: "Hiciste muchos cambios seguidos. Intenta de nuevo más tarde." };
  }

  const { error } = await supabase.rpc("admin_cambiar_pausa_cuenta", {
    p_pausada: pausada === "true",
    p_mensaje: pausada === "true" ? mensaje || null : null,
  });
  if (error) return { error: mensajeDeError("admin_pausa_cuenta_fallo", error) };

  registrar("info", { evento: "admin_pausa_cuenta", actor_id: userId, pausada: pausada === "true" });
  revalidatePath("/admin/plataforma");
  return {
    mensaje:
      pausada === "true"
        ? "Ingreso de asociados pausado. Los asociados ven el aviso de pausa."
        : "Ingreso de asociados reanudado.",
  };
}

/** «Publicar aviso»: título (3 a 80) y mensaje (5 a 1000) por admin_crear_aviso. */
export async function crearAviso(_previo: EstadoPlataforma, formData: FormData): Promise<EstadoPlataforma> {
  const { supabase, userId } = await exigirAdmin();
  const titulo = limpiar(textoDe(formData, "titulo")).replace(/\s+/g, " ");
  const mensaje = limpiar(textoDe(formData, "mensaje"));
  if (titulo.length < 3 || titulo.length > 80) return { error: "El título debe tener entre 3 y 80 caracteres." };
  if (mensaje.length < 5 || mensaje.length > 1000) return { error: "El mensaje debe tener entre 5 y 1000 caracteres." };
  if (!(await dentroDelLimite("admin-crear-aviso", userId, 10, 60 * 60))) {
    return { error: "Publicaste muchos avisos seguidos. Intenta de nuevo más tarde." };
  }

  const { error } = await supabase.rpc("admin_crear_aviso", { p_titulo: titulo, p_mensaje: mensaje });
  if (error) return { error: mensajeDeError("admin_crear_aviso_fallo", error) };

  revalidatePath("/admin/plataforma");
  return { mensaje: "Aviso publicado. Cada asociado lo verá la próxima vez que entre." };
}

/** «Retirar»: el aviso deja de mostrarse a quien todavía no lo ha visto. */
export async function desactivarAviso(_previo: EstadoPlataforma, formData: FormData): Promise<EstadoPlataforma> {
  const { supabase } = await exigirAdmin();
  const avisoId = textoDe(formData, "avisoId");
  if (!/^[0-9a-f-]{36}$/i.test(avisoId)) return { error: "Falta el aviso." };

  const { error } = await supabase.rpc("admin_desactivar_aviso", { p_aviso_id: avisoId });
  if (error) return { error: mensajeDeError("admin_desactivar_aviso_fallo", error) };

  revalidatePath("/admin/plataforma");
  return { mensaje: "Aviso retirado." };
}
