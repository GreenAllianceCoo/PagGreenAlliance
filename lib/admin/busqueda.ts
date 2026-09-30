/**
 * Búsqueda por nombre o cédula del panel de administración (pieza 2d):
 * filtro en el cliente sobre la lista que ya cargó la página (mismo criterio
 * que `lib/asesor/resumen.ts#filtrarClientes`: sin acentos ni mayúsculas).
 * No es una consulta nueva a la base: la auditoría (docs/auditorias/
 * 2026-09-25-backend-rediseno-c-plus.md) solo propone un índice opcional de
 * rendimiento para cuando la búsqueda SÍ vaya al servidor.
 */

/** Quita tildes y pasa a minúsculas para que «Peña» encuentre «pena». */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** ¿La fila coincide con la búsqueda por nombre o cédula? Cadena vacía = todo coincide. */
export function coincideBusqueda(busqueda: string, nombre: string, cedula: string): boolean {
  const normalizada = normalizarTexto(busqueda.trim());
  if (!normalizada) return true;
  return normalizarTexto(nombre).includes(normalizada) || cedula.replace(/\D/g, "").includes(normalizada.replace(/\D/g, ""));
}
