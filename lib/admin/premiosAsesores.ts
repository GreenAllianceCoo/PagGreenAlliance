import type { SupabaseClient } from "@supabase/supabase-js";
import { indexarPremiosAdmin, type FilaAdminPremios, type PremiosDeAsesor } from "@/lib/asesor/premios";
import { registrar } from "@/lib/servidor/registro";

/** Premios, clics y ganadores por asesor (admin_premios_asesores). Vacío si falla (queda en el registro). */
export async function listarPremiosAsesores(supabase: SupabaseClient): Promise<Map<string, PremiosDeAsesor>> {
  const { data, error } = await supabase.rpc("admin_premios_asesores");
  if (error) {
    registrar("error", { evento: "admin_premios_asesores_fallo", codigo: error.code, mensaje: error.message });
    return new Map();
  }
  return indexarPremiosAdmin(data as FilaAdminPremios[] | null);
}
