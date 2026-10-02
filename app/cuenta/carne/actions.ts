"use server";

import { revalidatePath } from "next/cache";
import { asociadoActivo } from "@/lib/asociado/activo";
import { crearSubidaFotoCarne, quitarFotoCarneDe, registrarFotoCarneSubida } from "@/lib/carneFoto";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";
import { esquemaGuardarFotoCarne, esquemaPrepararFotoCarne } from "@/lib/validaciones/fotoCarne";

export type EstadoRegenerar = { ok?: boolean; error?: string };

/** «Regenerar código»: el QR anterior deja de valer. Solo el propio asociado (RPC security definer). */
export async function regenerarCodigoCarne(): Promise<EstadoRegenerar> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión terminó. Vuelve a ingresar." };
  if (!(await asociadoActivo(supabase, user.id))) return { error: "No se pudo regenerar el código." };

  const { data, error } = await supabase.rpc("regenerar_carne_token");
  if (error || !data) {
    // Sin error de base = la RPC rechazó por el tope (1 por minuto) o por no ser asociado activo.
    if (error) registrar("error", { evento: "carne_regenerar_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No se pudo regenerar el código. Espera un minuto e intenta de nuevo." };
  }
  revalidatePath("/cuenta/carne");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Foto del carné (pedido de Sebas, 2-oct): cambiar / volver a la selfie de afiliación
// ---------------------------------------------------------------------------

export type RespuestaPrepararFoto = { ok: true; ruta: string; token: string; bucket: string } | { ok: false; error: string };
export type EstadoFotoCarne = { ok?: boolean; error?: string };

/** Sesión + asociado activo; devuelve el id o el mensaje de error. */
async function asociadoEnSesion(): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión terminó. Vuelve a ingresar." };
  if (!(await asociadoActivo(supabase, user.id))) return { error: "No se pudo cambiar la foto." };
  return { id: user.id };
}

/** Paso 1: URL firmada para que el navegador suba la foto directo a Storage (no pasa por la Server Action). */
export async function prepararFotoCarne(entrada: { tipo: string; tamano: number }): Promise<RespuestaPrepararFoto> {
  const r = esquemaPrepararFotoCarne.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const quien = await asociadoEnSesion();
  if ("error" in quien) return { ok: false, error: quien.error };
  if (!(await dentroDelLimite("foto-carne-subida", quien.id, 10, 60 * 60))) {
    return { ok: false, error: "Intentaste muchas veces seguidas. Prueba de nuevo en un rato." };
  }
  const subida = await crearSubidaFotoCarne(quien.id, r.data.tipo);
  if (!subida) return { ok: false, error: "No pudimos preparar la subida. Intenta de nuevo." };
  return { ok: true, ...subida };
}

/** Paso 2: el servidor verifica el archivo subido y lo liga al asociado en sesión. */
export async function guardarFotoCarne(entrada: { ruta: string }): Promise<EstadoFotoCarne> {
  const r = esquemaGuardarFotoCarne.safeParse(entrada);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const quien = await asociadoEnSesion();
  if ("error" in quien) return { error: quien.error };
  const resultado = await registrarFotoCarneSubida(quien.id, r.data.ruta);
  if (!resultado.ok) return { error: resultado.error };
  revalidatePath("/cuenta/carne");
  revalidatePath("/cuenta");
  return { ok: true };
}

/** «Usar mi selfie de afiliación»: quita la foto propia. */
export async function quitarFotoCarne(): Promise<EstadoFotoCarne> {
  const quien = await asociadoEnSesion();
  if ("error" in quien) return { error: quien.error };
  const resultado = await quitarFotoCarneDe(quien.id);
  if (!resultado.ok) return { error: resultado.error };
  revalidatePath("/cuenta/carne");
  revalidatePath("/cuenta");
  return { ok: true };
}
