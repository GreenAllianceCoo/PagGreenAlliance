// Dashboard del admin (4.7): conteos y sumas que calcula la base con
// `admin_metricas_dashboard()` (migración 20261001000000). Sin datos personales.
// Sin `server-only` a propósito: recibe el cliente por parámetro y se prueba sin Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetricasAdmin = {
  asociadosActivos: number;
  asociadosPorGrado: Record<string, number>;
  asociadosPorInstitucion: Record<string, number>;
  afiliacionesPendientes: number;
  creditosPendientes: number;
  /** Pesos COP del mes calendario en hora de Bogotá. */
  montoSolicitadoMes: number;
  montoAprobadoMes: number;
  inscritosSorteoMes: number;
  /** §13.3: asociados activos por estado del proceso ejecutivo (clave `sin_proceso` si no tienen). */
  porEstadoProceso: Record<string, number>;
  /** Desembolsos del mes calendario en Bogotá (por fecha_desembolso). */
  desembolsosMes: { conteo: number; monto: number };
};

export function numeroSeguro(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function conteosPorClave(v: unknown): Record<string, number> {
  const salida: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v)) salida[k] = numeroSeguro(n);
  }
  return salida;
}

/** Convierte el jsonb de la RPC. `null` (no es admin o falló) => null. */
export function normalizarMetricasAdmin(crudo: unknown): MetricasAdmin | null {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;
  const r = crudo as Record<string, unknown>;
  return {
    asociadosActivos: numeroSeguro(r.asociados_activos),
    asociadosPorGrado: conteosPorClave(r.asociados_por_grado),
    asociadosPorInstitucion: conteosPorClave(r.asociados_por_institucion),
    afiliacionesPendientes: numeroSeguro(r.afiliaciones_pendientes),
    creditosPendientes: numeroSeguro(r.creditos_pendientes),
    montoSolicitadoMes: numeroSeguro(r.monto_solicitado_mes),
    montoAprobadoMes: numeroSeguro(r.monto_aprobado_mes),
    inscritosSorteoMes: numeroSeguro(r.inscritos_sorteo_mes),
    porEstadoProceso: conteosPorClave(r.por_estado_proceso),
    desembolsosMes: {
      conteo: numeroSeguro((r.desembolsos_mes as Record<string, unknown> | null | undefined)?.conteo),
      monto: numeroSeguro((r.desembolsos_mes as Record<string, unknown> | null | undefined)?.monto),
    },
  };
}

/** Usa el cliente de SESIÓN del admin (nunca service role). null si no es admin o la RPC falla. */
export async function cargarMetricasAdmin(supabase: SupabaseClient): Promise<MetricasAdmin | null> {
  const { data, error } = await supabase.rpc("admin_metricas_dashboard");
  if (error) return null;
  return normalizarMetricasAdmin(data);
}
