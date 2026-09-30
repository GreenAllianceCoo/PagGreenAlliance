/**
 * Fechas de calendario («AAAA-MM-DD») en hora de Colombia. Funciones puras
 * (sin Supabase) que siguen las mismas reglas de la base:
 *  - `hoyBogota()` = `(now() at time zone 'America/Bogota')::date`;
 *  - `sumarMeses()` = `(fecha + interval 'N months')::date` de Postgres, que
 *    ajusta al último día del mes cuando el día no existe (31-ene + 1 mes =
 *    28/29-feb). Así el conteo que se ve en pantalla coincide con el que la
 *    base usa para habilitar los botones (mi_proceso_ejecutivo()).
 */

export type FechaISO = string;

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si el texto es una fecha real «AAAA-MM-DD» (rechaza 2026-02-30). */
export function esFechaISO(texto: string): boolean {
  const partes = PATRON_FECHA.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= diasDelMes(anio, mes);
}

function partesDe(fecha: FechaISO): [number, number, number] {
  const partes = PATRON_FECHA.exec(fecha);
  if (!partes) throw new Error(`Fecha inválida: ${fecha}`);
  return [Number(partes[1]), Number(partes[2]), Number(partes[3])];
}

function aISO(anio: number, mes: number, dia: number): FechaISO {
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function diasDelMes(anio: number, mes: number) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Fecha de hoy en Colombia: «2026-09-30». */
export function hoyBogota(ahora: Date = new Date()): FechaISO {
  // en-CA formatea como AAAA-MM-DD.
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/** Día (en Colombia) de un instante guardado como timestamptz. */
export function fechaBogotaDeInstante(instante: string): FechaISO {
  return hoyBogota(new Date(instante));
}

/** fecha + N meses con la regla de Postgres (ajusta al último día del mes). */
export function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const [anio, mes, dia] = partesDe(fecha);
  const total = anio * 12 + (mes - 1) + meses;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  return aISO(nuevoAnio, nuevoMes, Math.min(dia, diasDelMes(nuevoAnio, nuevoMes)));
}

/** Días entre dos fechas (hasta − desde); negativo si `hasta` es anterior. */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  const [a1, m1, d1] = partesDe(desde);
  const [a2, m2, d2] = partesDe(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Meses completos y días sueltos que faltan de `desde` a `hasta`
 * (0 y 0 si `hasta` ya pasó). Se cuenta con `sumarMeses` para que «faltan
 * 2 meses» signifique lo mismo que en la base.
 */
export function mesesYDiasEntre(desde: FechaISO, hasta: FechaISO): { meses: number; dias: number } {
  if (diasEntre(desde, hasta) <= 0) return { meses: 0, dias: 0 };
  let meses = 0;
  while (diasEntre(sumarMeses(desde, meses + 1), hasta) >= 0) meses += 1;
  return { meses, dias: diasEntre(sumarMeses(desde, meses), hasta) };
}

/** «30 meses y 12 días», «1 mes», «5 días», «0 días». */
export function textoMesesYDias({ meses, dias }: { meses: number; dias: number }): string {
  const partes: string[] = [];
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  if (dias > 0 || meses === 0) partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
  return partes.join(" y ");
}

/** «15 de octubre de 2026» (la fecha es de calendario: se formatea en UTC para no correrla un día). */
export function formatearFechaLarga(fecha: FechaISO): string {
  const [anio, mes, dia] = partesDe(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** «15 oct» (corta, sin año). */
export function formatearFechaCorta(fecha: FechaISO): string {
  const [anio, mes, dia] = partesDe(fecha);
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** «jun 2026» (mes corto sin punto + año), para el carné «Tu camino a la estabilidad». */
export function formatearMesAnio(fecha: FechaISO): string {
  const [anio, mes] = partesDe(fecha);
  const nombre = new Date(Date.UTC(anio, mes - 1, 1))
    .toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" })
    .replace(".", "");
  return `${nombre} ${anio}`;
}
