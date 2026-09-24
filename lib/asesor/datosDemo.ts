// Datos de la cuenta de demostración del asesor (spec-fase-2.md §5).
// «Es solo de la aplicación (...), no guarda nada en la base». Todo lo de
// este archivo es ficticio a propósito: no debe parecerse a datos reales.

import { GRADOS, type CodigoGrado } from "@/lib/validaciones/afiliacion";
import { MONTO_MINIMO, formatTasa } from "@/lib/credito";

export { GRADOS };
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
 * Copia de los topes de `grados_credito` (migración 20260922000000), por si
 * `/asesor/demo` no logra leerlos de la base (o para las pruebas unitarias,
 * que no hablan con Supabase). La página siempre intenta leer la tabla real
 * primero: son datos públicos de referencia, no de un cliente.
 */
export const PAQUETES_DEMO: Record<CodigoGrado, PaqueteDemo[]> = {
  PP: [
    { porcentaje: "50", capacidad_maxima: 1000000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
    { porcentaje: "100", capacidad_maxima: 2100000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
  ],
  PT: [
    { porcentaje: "50", capacidad_maxima: 1300000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
    { porcentaje: "100", capacidad_maxima: 2700000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
  ],
  SI: [
    { porcentaje: "50", capacidad_maxima: 1500000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
    { porcentaje: "100", capacidad_maxima: 3000000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
  ],
  IT: [
    { porcentaje: "50", capacidad_maxima: 2000000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
    { porcentaje: "100", capacidad_maxima: 4000000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
  ],
  OF: [
    { porcentaje: "50", capacidad_maxima: 2150000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
    { porcentaje: "100", capacidad_maxima: 4200000, tasa_interes_mensual: 0.079, plazo_meses: 3 },
  ],
};

/** Nombre para mostrar de cada código de grado (mismo TODO(pendiente-spec) que /afiliacion y /cuenta). */
export const NOMBRE_GRADO: Record<CodigoGrado, string> = {
  PP: "PP",
  PT: "PT",
  SI: "SI",
  IT: "IT",
  OF: "OF",
};

/** Tope más alto (entre 50 % y 100 %) del grado elegido, para la tarjeta «Tope disponible». */
export function topeMaximoDemo(paquetes: PaqueteDemo[]): number {
  if (paquetes.length === 0) return 0;
  return Math.max(...paquetes.map((p) => p.capacidad_maxima));
}

export { formatTasa, MONTO_MINIMO };
