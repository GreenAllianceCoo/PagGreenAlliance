"use server";

import { revalidatePath } from "next/cache";
import { asociadoActivo } from "@/lib/asociado/activo";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

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
