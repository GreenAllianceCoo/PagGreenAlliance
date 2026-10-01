/**
 * Orden de los convenios (puro, sin servidor): subir/bajar una posición.
 * Devuelve SOLO las filas cuyo `orden` cambia, con la numeración renormalizada
 * de 10 en 10 (así dos convenios con el mismo `orden` también se resuelven).
 */
export type ItemOrden = { id: string; orden: number };

export const SALTO_ORDEN = 10;

export function reordenarConvenios(lista: ItemOrden[], id: string, direccion: "subir" | "bajar"): ItemOrden[] {
  const i = lista.findIndex((c) => c.id === id);
  if (i === -1) return [];
  const j = direccion === "subir" ? i - 1 : i + 1;
  if (j < 0 || j >= lista.length) return [];
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia
    .map((c, k) => ({ id: c.id, orden: (k + 1) * SALTO_ORDEN }))
    .filter((nuevo) => lista.find((c) => c.id === nuevo.id)?.orden !== nuevo.orden);
}
