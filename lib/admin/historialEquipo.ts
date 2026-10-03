import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";
import { FILAS_HISTORIAL, type FiltrosHistorial } from "@/lib/validaciones/historialEquipo";
import { vistaEventoEquipo, type EventoEquipo, type FilaHistorialEquipo } from "./historialEquipoTexto";

/**
 * «Historial del equipo» (solo admin): una página de eventos de
 * public.admin_historial_equipo(), ya redactados en español, y el total para paginar.
 */
export async function cargarHistorialEquipo(
  supabase: SupabaseClient,
  filtros: FiltrosHistorial,
): Promise<{ eventos: EventoEquipo[]; total: number; error: boolean }> {
  const { data, error } = await supabase.rpc("admin_historial_equipo", {
    p_actor: filtros.persona ?? null,
    p_desde: filtros.desde ?? null,
    p_hasta: filtros.hasta ?? null,
    p_limite: FILAS_HISTORIAL,
    p_pagina: filtros.pagina,
  });
  if (error) {
    registrar("error", { evento: "admin_historial_equipo_fallo", codigo: error.code, mensaje: error.message });
    return { eventos: [], total: 0, error: true };
  }
  const filas = (data ?? []) as FilaHistorialEquipo[];
  return { eventos: filas.map(vistaEventoEquipo), total: Number(filas[0]?.total ?? 0), error: false };
}
