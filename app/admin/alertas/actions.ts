"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { registrar } from "@/lib/servidor/registro";
import { textoDe } from "@/lib/validaciones/comunes";
import { esquemaMarcarAlerta } from "@/lib/validaciones/admin";

export type EstadoMarcarAlerta = { error?: string; mensaje?: string };

/**
 * «Marcar atendida» de la bandeja de alertas (spec-requerimientos-ricardo §6,
 * pieza 3m). Solo admin (exigirAdmin + la RPC lo vuelve a comprobar); la RPC
 * guarda quién y cuándo. Si otro admin ya la atendió, se avisa.
 */
export async function marcarAlertaAtendida(
  _previo: EstadoMarcarAlerta,
  formData: FormData,
): Promise<EstadoMarcarAlerta> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaMarcarAlerta.safeParse({ alertaId: textoDe(formData, "alertaId") });
  if (!resultado.success) return { error: "Datos inválidos." };

  const { error } = await supabase.rpc("admin_marcar_alerta_atendida", { p_alerta_id: resultado.data.alertaId });
  if (error) {
    if (error.message?.includes("ya estaba atendida")) {
      return { error: "Esta alerta ya estaba atendida." };
    }
    registrar("error", { evento: "admin_marcar_alerta_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos marcar la alerta. Intenta de nuevo." };
  }

  revalidatePath("/admin/alertas");
  return { mensaje: "Alerta atendida." };
}
