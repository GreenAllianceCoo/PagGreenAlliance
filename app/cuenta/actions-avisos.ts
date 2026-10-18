"use server";

import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

/**
 * «Entendido» del aviso que el asociado ve al entrar (/admin/plataforma).
 * La base solo lo marca si el aviso existe y le corresponde a quien llama
 * (marcar_aviso_visto); nunca falla hacia la UI: en el peor caso, lo vuelve a ver.
 */
export async function marcarAvisoVisto(avisoId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(avisoId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_aviso_visto", { p_aviso_id: avisoId });
  if (error) registrar("error", { evento: "marcar_aviso_visto_fallo", codigo: error.code, mensaje: error.message });
}
