import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type KpisAdmin = {
  creditosPendientes: number;
  afiliacionesPendientes: number;
  aprobadosEsteMes: number;
  montoAprobadoEsteMes: number;
};

/**
 * Límites del mes calendario ACTUAL en hora de Colombia (America/Bogota),
 * como par `[inicio, fin)` en UTC listo para comparar con columnas
 * `timestamptz` (`>= inicio` y `< fin`; `fin` es el día 1 del mes
 * siguiente, límite exclusivo).
 *
 * Colombia no tiene horario de verano: su desfase es siempre UTC-5, así
 * que basta restarle 5 horas a "ahora" para saber qué año y mes ve alguien
 * en Bogotá en este instante (sin depender de Intl ni de la zona horaria
 * del servidor donde corra esto).
 */
export function rangoMesColombia(ahora: Date = new Date()): { inicio: string; fin: string } {
  const bogota = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);
  const anio = bogota.getUTCFullYear();
  const mes = bogota.getUTCMonth(); // 0-11

  // El día 1 del mes a las 00:00 en Bogotá (UTC-5) equivale a las 05:00 UTC.
  const inicio = new Date(Date.UTC(anio, mes, 1, 5, 0, 0));
  const fin = new Date(Date.UTC(anio, mes + 1, 1, 5, 0, 0));
  return { inicio: inicio.toISOString(), fin: fin.toISOString() };
}

/**
 * Los 4 KPI del panel de administración (pieza 2d), siempre exactos sin
 * importar qué pestaña (estado) esté viendo el admin: 3 conteos ligeros
 * (`count: 'exact', head: true`, no traen filas) más una suma sobre las
 * pocas filas aprobadas este mes. Usa el cliente de SESIÓN del admin (RLS
 * vía `es_admin()`), nunca el de service role.
 */
export async function cargarKpisAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<KpisAdmin> {
  const { inicio, fin } = rangoMesColombia();

  const [creditosPendientes, afiliacionesPendientes, aprobadosEsteMes, montoAprobado] = await Promise.all([
    supabase.from("solicitudes_credito").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("solicitudes_afiliacion").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase
      .from("solicitudes_credito")
      .select("id", { count: "exact", head: true })
      .eq("estado", "aprobado")
      .gte("fecha_respuesta", inicio)
      .lt("fecha_respuesta", fin),
    // Sin `head: true`: se necesitan los montos para sumarlos. Son pocas
    // filas (las aprobadas de ESTE mes, ya filtradas por estado y fecha),
    // no toda la tabla.
    supabase
      .from("solicitudes_credito")
      .select("monto_solicitado")
      .eq("estado", "aprobado")
      .gte("fecha_respuesta", inicio)
      .lt("fecha_respuesta", fin),
  ]);

  const montoAprobadoEsteMes = (montoAprobado.data ?? []).reduce(
    (acumulado, fila) => acumulado + Number((fila as { monto_solicitado: number | string }).monto_solicitado),
    0,
  );

  return {
    creditosPendientes: creditosPendientes.count ?? 0,
    afiliacionesPendientes: afiliacionesPendientes.count ?? 0,
    aprobadosEsteMes: aprobadosEsteMes.count ?? 0,
    montoAprobadoEsteMes,
  };
}
