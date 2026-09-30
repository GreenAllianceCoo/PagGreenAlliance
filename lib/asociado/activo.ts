import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * §12.6: ¿el usuario en sesión sigue activo? Se consulta en el servidor en
 * cada carga y en cada acción del asociado, así una sesión vieja de alguien
 * dado de baja queda inservible. Si la columna no se puede leer se deja pasar:
 * la base también lo bloquea (triggers de crédito, alertas y boletas).
 */
export async function asociadoActivo(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("perfiles").select("activo").eq("id", userId).maybeSingle();
  return data?.activo !== false;
}
