/**
 * Piezas del confeti de la celebración (paso 3 del modal del sorteo).
 * Función pura y determinista (sin `Math.random`) para poder probarla: la
 * «aleatoriedad» sale de un seno con semilla, no del reloj.
 */
export type PiezaConfeti = {
  id: number;
  /** Posición horizontal, 0–100 (%). */
  izquierda: number;
  /** Retraso antes de empezar a caer (s). */
  retraso: number;
  /** Duración de la caída (s). */
  duracion: number;
  color: string;
  /** Rotación inicial (grados). */
  rotacion: number;
};

/** Verde y dorado de la marca (app/globals.css: --ga-verde, --ga-verde-oscuro, --ga-ambar). */
export const COLORES_CONFETI = ["#1e6652", "#14493a", "#e0a33a"];

function pseudoAleatorio(semilla: number) {
  const x = Math.sin(semilla * 999.7) * 10000;
  return x - Math.floor(x);
}

/**
 * `cantidad` piezas de confeti, o ninguna si `prefiereMenosMovimiento` es
 * true (así no hay nada que animar: la pantalla queda estática sin más).
 */
export function generarConfeti(cantidad: number, prefiereMenosMovimiento: boolean): PiezaConfeti[] {
  if (prefiereMenosMovimiento || cantidad <= 0) return [];
  return Array.from({ length: cantidad }, (_, i) => ({
    id: i,
    izquierda: Math.min(100, Math.max(0, (i / cantidad) * 100 + (pseudoAleatorio(i) * 10 - 5))),
    retraso: Number((pseudoAleatorio(i + 1) * 0.6).toFixed(2)),
    duracion: Number((1.5 + pseudoAleatorio(i + 2) * 1.2).toFixed(2)),
    color: COLORES_CONFETI[i % COLORES_CONFETI.length],
    rotacion: Math.round(pseudoAleatorio(i + 3) * 360),
  }));
}
