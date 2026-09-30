import type { createClient } from "@/lib/supabase/server";

/** Estados reales de `solicitudes_afiliacion.estado`. */
export const ESTADOS_AFILIACION = ["pendiente", "contactado", "aprobada", "rechazada"] as const;
export type EstadoAfiliacion = (typeof ESTADOS_AFILIACION)[number];

export function esEstadoAfiliacionValido(valor: string | undefined): valor is EstadoAfiliacion {
  return !!valor && (ESTADOS_AFILIACION as readonly string[]).includes(valor);
}

export type FilaListaAfiliacion = {
  id: string;
  nombre: string;
  cedula: string;
  grado: string;
  institucion: string;
  estado: EstadoAfiliacion;
  created_at: string;
};

/**
 * Lista de solicitudes de afiliación por estado: el mismo `select` que ya
 * usaba `/admin/afiliaciones` (sin cambios de columnas ni de filtro), solo
 * extraído aquí para que `/admin/afiliaciones/[id]` también la use como
 * lista de «hermanas» junto al detalle (pieza 3e: «lista + ficha en la misma
 * vista»). No es una consulta nueva: es la misma, reutilizada.
 */
export async function listarSolicitudesAfiliacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estado: EstadoAfiliacion,
): Promise<{ filas: FilaListaAfiliacion[]; error: boolean }> {
  const { data, error } = await supabase
    .from("solicitudes_afiliacion")
    .select("id, nombre, cedula, grado, institucion, estado, created_at")
    .eq("estado", estado)
    .order("created_at", { ascending: false });
  return { filas: (data ?? []) as FilaListaAfiliacion[], error: !!error };
}
