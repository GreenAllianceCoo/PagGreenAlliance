import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mensaje de las Server Actions cuando un admin pausó el ingreso de asociados. */
export const MENSAJE_CUENTA_PAUSADA = "La plataforma está en pausa. Vuelve a intentarlo más tarde.";

/**
 * ¿Está pausado el ingreso para quien llama? (estado_pausa_cuenta(), solo true
 * para el rol asociado). proxy.ts lo aplica a todo /cuenta; las acciones que
 * también se empaquetan fuera de /cuenta (p. ej. actualizarTelefono) lo
 * comprueban aquí (RS-M1). Si la consulta falla, no se bloquea (igual que el proxy).
 */
export async function cuentaPausada(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("estado_pausa_cuenta").maybeSingle<{ pausada: boolean }>();
  return Boolean(data?.pausada);
}
