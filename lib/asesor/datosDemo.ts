// Datos de la cuenta de demostración del asesor (spec-fase-2.md §5).
// «Es solo de la aplicación (...), no guarda nada en la base». Todo lo de
// este archivo es ficticio a propósito: no debe parecerse a datos reales.

// Los «grados» del simulador son los GRUPOS de crédito (PP, PT, SI, IT, OF):
// las filas de grados_credito, no los 17 grados del catálogo `grados`.
import { GRUPOS_CREDITO, type GrupoCredito as CodigoGrado } from "@/lib/gradosCatalogo";
import { MONTO_MINIMO, formatTasa } from "@/lib/credito";

/** §12.1: el grupo OF solo queda por datos antiguos; ningún grado seleccionable lo usa, así que el simulador no lo ofrece. */
export const GRADOS: readonly CodigoGrado[] = GRUPOS_CREDITO.filter((g) => g !== "OF");
export type { CodigoGrado };

/** «Cliente» de ejemplo que se le muestra a la persona interesada. Nunca es un dato real. */
export const CLIENTE_DEMO = {
  nombre: "Cliente de ejemplo",
  cedula: "0000000000",
  telefono: "3000000000",
};

/** Un paquete (50 % o 100 %) de `grados_credito` para un grado. */
export type PaqueteDemo = {
  porcentaje: "50" | "100";
  capacidad_maxima: number;
  tasa_interes_mensual: number;
  plazo_meses: number;
};

/**
 * RS-08: aquí NO hay copia de respaldo de `grados_credito`. Este archivo lo
 * importan componentes cliente (`"use client"`), y cualquier cifra que
 * tenga — sobre todo la tasa de interés — viajaría en el JavaScript público
 * del navegador. Los paquetes (con la tasa) llegan SOLO como prop desde el
 * servidor, leídos con la RPC `tabla_credito_con_tasa()`
 * (lib/asesor/cargarPaquetesDemo.ts). Si la RPC falla, la demo muestra un
 * error; no inventa cifras.
 */

/** Nombre para mostrar de cada código de grado (mismo TODO(pendiente-spec) que /afiliacion y /cuenta). */
export const NOMBRE_GRADO: Record<CodigoGrado, string> = {
  PP: "PP",
  PT: "PT",
  SI: "SI",
  IT: "IT",
  OF: "OF",
  IJ: "IJ",
  CT: "CT",
  MY: "MY",
  TC: "TC",
};

/** Tope más alto (entre 50 % y 100 %) del grado elegido, para la tarjeta «Tope disponible». */
export function topeMaximoDemo(paquetes: PaqueteDemo[]): number {
  if (paquetes.length === 0) return 0;
  return Math.max(...paquetes.map((p) => p.capacidad_maxima));
}

export { formatTasa, MONTO_MINIMO };
