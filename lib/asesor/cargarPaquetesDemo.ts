import "server-only";
import { registrar } from "@/lib/servidor/registro";
import type { createClient } from "@/lib/supabase/server";
import { GRADOS, PAQUETES_DEMO, type CodigoGrado, type PaqueteDemo } from "@/lib/asesor/datosDemo";

/**
 * Topes de `grados_credito` agrupados por grado para la cuenta de
 * demostración (/asesor/demo y /admin/demo). Solo LEE la tabla de referencia;
 * si falla o viene vacía, usa la copia de lib/asesor/datosDemo.ts.
 */
export async function cargarPaquetesDemo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  evento: string,
): Promise<Record<CodigoGrado, PaqueteDemo[]>> {
  const { data: filas, error } = await supabase
    .from("grados_credito")
    .select("grado, porcentaje, capacidad_maxima, tasa_interes_mensual, plazo_meses")
    .order("grado", { ascending: true })
    .order("porcentaje", { ascending: true });

  if (error) {
    registrar("error", { evento, codigo: error.code, mensaje: error.message });
  }

  const paquetesPorGrado = { ...PAQUETES_DEMO } as Record<CodigoGrado, PaqueteDemo[]>;
  if (filas && filas.length > 0) {
    const agrupados = {} as Record<CodigoGrado, PaqueteDemo[]>;
    for (const fila of filas) {
      const grado = fila.grado as CodigoGrado;
      if (!GRADOS.includes(grado)) continue;
      (agrupados[grado] ??= []).push({
        porcentaje: fila.porcentaje as "50" | "100",
        capacidad_maxima: Number(fila.capacidad_maxima),
        tasa_interes_mensual: Number(fila.tasa_interes_mensual),
        plazo_meses: Number(fila.plazo_meses),
      });
    }
    // Solo se reemplaza la copia local por grados que sí trajo la base.
    Object.assign(paquetesPorGrado, agrupados);
  }
  return paquetesPorGrado;
}
