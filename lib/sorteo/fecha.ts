/**
 * Fechas del sorteo mensual, en la zona horaria de Colombia (America/Bogota).
 * Funciones puras (sin `server-only`): las usa tanto `/cuenta` (Server
 * Component) como las pruebas unitarias. Deben coincidir con la lógica de
 * `supabase/migrations/20260924000500_sorteo_mensual.sql`
 * (`extract(day from (now() at time zone 'America/Bogota'))`).
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export type FechaBogota = { anio: number; mes: number; dia: number };

/** Año, mes (1–12) y día de HOY en la zona horaria de Colombia. */
export function fechaBogota(ahora: Date = new Date()): FechaBogota {
  const formateador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const partes = formateador.formatToParts(ahora);
  const numero = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return { anio: numero("year"), mes: numero("month"), dia: numero("day") };
}

/**
 * true del día 1 al 5 de cada mes, hora de Colombia. Es la MISMA regla que
 * `public.sorteo_ventana_abierta()` en la base: se recalcula en el cliente
 * (vía este helper en un Server Component) solo para decidir qué texto
 * mostrar en el botón; la base es quien de verdad manda al participar o
 * confirmar (nunca se confía solo en esto para autorizar nada).
 */
export function ventanaSorteoAbierta(ahora: Date = new Date()): boolean {
  const { dia } = fechaBogota(ahora);
  return dia >= 1 && dia <= 5;
}

/** «octubre» a partir del número de mes (1–12). */
export function nombreMes(mes: number): string {
  return MESES[((mes - 1) % 12 + 12) % 12] ?? "";
}

/** Mes del sorteo en curso («sorteo de octubre»), según la fecha de Colombia. */
export function mesSorteoActual(ahora: Date = new Date()): string {
  return nombreMes(fechaBogota(ahora).mes);
}

/**
 * «1 de octubre»: la próxima apertura de la ventana. Se usa cuando la
 * ventana ya cerró (día 6 en adelante), así que siempre es el mes siguiente.
 */
export function textoProximaApertura(ahora: Date = new Date()): string {
  const { mes } = fechaBogota(ahora);
  const siguiente = mes === 12 ? 1 : mes + 1;
  return `1 de ${nombreMes(siguiente)}`;
}
