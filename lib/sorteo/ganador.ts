import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nombreMes } from "@/lib/sorteo/fecha";

/**
 * Ganador visible del sorteo (spec §12.10): «Ganador del sorteo de <mes>:
 * <GRADO> <Nombre>». SOLO grado y nombre: nunca cédula ni número de boleta.
 * La RPC `ganador_sorteo_vigente()` devuelve el sorteo del mes en curso o del
 * anterior y solo a asociados activos; sin fila, no hay ganador que mostrar.
 */
export type GanadorSorteo = { mesTexto: string; grado: string; nombre: string };

export async function cargarGanadorSorteo(supabase: SupabaseClient): Promise<GanadorSorteo | null> {
  const { data } = await supabase.rpc("ganador_sorteo_vigente").maybeSingle();
  const fila = data as { mes: string; grado: string; nombre: string } | null;
  if (!fila?.nombre) return null;
  const numeroMes = Number(String(fila.mes).slice(5, 7));
  return { mesTexto: nombreMes(numeroMes), grado: fila.grado, nombre: fila.nombre };
}
