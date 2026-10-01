import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { vistaPremios, type FilaMisPremios, type VistaPremios } from "@/lib/asesor/premios";
import { registrar } from "@/lib/servidor/registro";

/** Premios del asesor en sesión (mis_premios_asesor). null = no puede atender o falló (queda en el registro). */
export async function cargarPremiosAsesor(supabase: SupabaseClient): Promise<VistaPremios | null> {
  const { data, error } = await supabase.rpc("mis_premios_asesor");
  if (error) {
    registrar("error", { evento: "mis_premios_asesor_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return vistaPremios(data as FilaMisPremios[] | null);
}
