// Dashboard del asesor (4.8): `asesor_metricas_dashboard()` (migración 20261001000000).
// Solo conteos de SUS clientes; nada personal. Sin `server-only`: se prueba sin Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import { conteosPorClave, numeroSeguro } from "@/lib/admin/metricas";

export type MetricasAsesor = {
  clientesTotal: number;
  clientesPorEstadoCredito: { pendiente: number; aprobado: number; rechazado: number; sin_solicitud: number };
  creditosPendientes: number;
  /** Por estado de afiliación: pendiente, contactado, aprobada, rechazada (solo las claves que existan). */
  afiliacionesPorEstado: Record<string, number>;
  afiliacionesReferidasMes: number;
  /** Sus clientes por estado del proceso ejecutivo (clave `sin_proceso` si no tienen). */
  porEstadoProceso: Record<string, number>;
};

/** `null` (no puede atender hoy o la RPC falló) => null. */
export function normalizarMetricasAsesor(crudo: unknown): MetricasAsesor | null {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;
  const r = crudo as Record<string, unknown>;
  const e = conteosPorClave(r.clientes_por_estado_credito);
  return {
    clientesTotal: numeroSeguro(r.clientes_total),
    clientesPorEstadoCredito: {
      pendiente: e.pendiente ?? 0,
      aprobado: e.aprobado ?? 0,
      rechazado: e.rechazado ?? 0,
      sin_solicitud: e.sin_solicitud ?? 0,
    },
    creditosPendientes: numeroSeguro(r.creditos_pendientes),
    afiliacionesPorEstado: conteosPorClave(r.afiliaciones_por_estado),
    afiliacionesReferidasMes: numeroSeguro(r.afiliaciones_referidas_mes),
    porEstadoProceso: conteosPorClave(r.por_estado_proceso),
  };
}

export async function cargarMetricasAsesor(supabase: SupabaseClient): Promise<MetricasAsesor | null> {
  const { data, error } = await supabase.rpc("asesor_metricas_dashboard");
  if (error) return null;
  return normalizarMetricasAsesor(data);
}
