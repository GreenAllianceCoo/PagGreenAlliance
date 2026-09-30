import "server-only";
import { registrar } from "@/lib/servidor/registro";
import type { createClient } from "@/lib/supabase/server";
import { GRADOS, type CodigoGrado, type PaqueteDemo } from "@/lib/asesor/datosDemo";

/**
 * Topes de `grados_credito` agrupados por grado para la cuenta de
 * demostración (/asesor/demo y /admin/demo). Solo LEE la tabla de referencia.
 * RS-08: si la RPC falla o viene vacía devuelve `null` (la pantalla muestra
 * un error); NO hay copia de respaldo con cifras (ni tasa) en el código.
 * La tasa ya no se puede leer por la API (migración 20260930100100): sale de
 * la RPC `tabla_credito_con_tasa()`, que solo responde a asesores (o admins
 * que atienden) y admins; a cualquier otro le devuelve 0 filas.
 */
export async function cargarPaquetesDemo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  evento: string,
): Promise<Record<CodigoGrado, PaqueteDemo[]> | null> {
  // Mismas 5 columnas (grado, porcentaje, capacidad_maxima, tasa_interes_mensual, plazo_meses), ya ordenadas.
  const { data: filas, error } = await supabase.rpc("tabla_credito_con_tasa");

  if (error) {
    registrar("error", { evento, codigo: error.code, mensaje: error.message });
    return null;
  }

  const lista = (filas ?? []) as {
    grado: string;
    porcentaje: string;
    capacidad_maxima: number | string;
    tasa_interes_mensual: number | string;
    plazo_meses: number | string;
  }[];
  const agrupados = {} as Record<CodigoGrado, PaqueteDemo[]>;
  for (const fila of lista) {
    const grado = fila.grado as CodigoGrado;
    if (!GRADOS.includes(grado)) continue;
    (agrupados[grado] ??= []).push({
      porcentaje: fila.porcentaje as "50" | "100",
      capacidad_maxima: Number(fila.capacidad_maxima),
      tasa_interes_mensual: Number(fila.tasa_interes_mensual),
      plazo_meses: Number(fila.plazo_meses),
    });
  }
  if (Object.keys(agrupados).length === 0) {
    registrar("error", { evento, mensaje: "tabla_credito_con_tasa sin filas" });
    return null;
  }
  return agrupados;
}
