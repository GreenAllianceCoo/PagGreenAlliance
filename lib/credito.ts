import { MENSAJE_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
// Reglas del crédito que la app necesita conocer. La base las vuelve a
// validar (trigger chk_monto_solicitud, migración 20260923173355).

export const MONTO_MINIMO = 100000;

/** Límites de «Editar condiciones» (los mismos de admin_editar_condiciones_credito). */
export const MONTO_MAXIMO_EDICION = 1_000_000_000;
export const TOTAL_MAXIMO_EDICION = 2_000_000_000;
export const PLAZO_MAXIMO_MESES = 60;

/** Valor de un porcentaje entero entre los de 50 % y 100 % (cupo o tasa), en línea recta. */
export function interpolarPorcentaje(valor50: number, valor100: number, porcentaje: number) {
  return valor50 + ((valor100 - valor50) * (porcentaje - 50)) / 50;
}

/** Paso del deslizador de monto (COP): el servidor también exige múltiplos de este valor (F-06). */
export const PASO_MONTO = 50000;

/** Porcentajes del cupo que el asociado puede elegir (decisión del dueño, nov-2026): múltiplos de 10. */
export const PORCENTAJES_CREDITO = [50, 60, 70, 80, 90, 100] as const;
export type PorcentajeCredito = (typeof PORCENTAJES_CREDITO)[number];

/** ¿Es uno de los 6 porcentajes permitidos? Acepta el texto exacto del formulario («60») o el número. */
export function esPorcentajeCredito(valor: unknown): valor is PorcentajeCredito | `${PorcentajeCredito}` {
  return PORCENTAJES_CREDITO.some((p) => valor === p || valor === String(p));
}

/** Lo mínimo de un paquete de `grados_credito` que hace falta para el cupo (sin tasa). */
type PaqueteCupo = { porcentaje: string | number; capacidad_maxima: number };

/**
 * Cupo (tope en pesos) para un porcentaje elegido: 50 % y 100 % son los de su
 * fila de `grados_credito`; de 60 % a 90 % se interpola en línea recta entre
 * los dos y se redondea al peso, igual que el trigger chk_monto_solicitud
 * (`round(cupo interpolado)`). undefined si falta la fila de 50 % o la de 100 %,
 * o si el porcentaje no es uno de los 6 permitidos.
 */
export function cupoParaPorcentaje(paquetes: readonly PaqueteCupo[], porcentaje: number): number | undefined {
  if (!esPorcentajeCredito(porcentaje)) return undefined;
  const de = (p: number) => paquetes.find((f) => Number(f.porcentaje) === p)?.capacidad_maxima;
  const cupo50 = de(50);
  const cupo100 = de(100);
  if (cupo50 === undefined || cupo100 === undefined) return undefined;
  return Math.round(interpolarPorcentaje(Number(cupo50), Number(cupo100), porcentaje));
}

/**
 * Máximo del deslizador para un cupo: el múltiplo de $50.000 más alto que no lo
 * supera (redondeo hacia abajo). El servidor acepta exactamente ese valor
 * (monto ≤ cupo y múltiplo de $50.000), así que nunca se ofrece algo que se rechace.
 */
export function montoMaximoParaCupo(cupo: number) {
  return Math.floor(cupo / PASO_MONTO) * PASO_MONTO;
}

/** Una opción del selector de porcentaje: su cupo y el máximo que permite el deslizador. */
export type OpcionCredito = { porcentaje: PorcentajeCredito; cupo: number; montoMaximo: number };

/** Las 6 opciones (50 % → 100 %) del grupo; [] si falta la fila de 50 % o la de 100 %. */
export function opcionesCredito(paquetes: readonly PaqueteCupo[]): OpcionCredito[] {
  const opciones: OpcionCredito[] = [];
  for (const porcentaje of PORCENTAJES_CREDITO) {
    const cupo = cupoParaPorcentaje(paquetes, porcentaje);
    if (cupo === undefined) return [];
    opciones.push({ porcentaje, cupo, montoMaximo: montoMaximoParaCupo(cupo) });
  }
  return opciones;
}

/** Total sugerido: monto + plazo × interés mensual a miles (misma fórmula de los cupos de `grados_credito`). */
export function totalSugerido(monto: number, tasaMensual: number, plazoMeses: number) {
  return monto + plazoMeses * Math.round((monto * tasaMensual) / 1000) * 1000;
}

/** Tasa de interés mensual guardada como fracción: 0.0505 → "5,05 %" */
export function formatTasa(tasa: number) {
  return `${(Number(tasa) * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}

/** Texto de la regla de Sebas (spec-requerimientos-ricardo §8). */
export const MENSAJE_CREDITO_SOLO_OPERANDO = "Podrás pedir tu crédito cuando tu proceso esté operando";
/** §12.6: mismo texto que el trigger de crédito de la base para inactivos (20260930200400). */
export const MENSAJE_CREDITO_INACTIVO = MENSAJE_CUENTA_INACTIVA;
export const MENSAJE_CREDITO_SIN_GRADO =
  "Tu perfil aún no tiene un grado asignado. Habla con la cooperativa para poder solicitar un crédito.";
export const MENSAJE_CREDITO_PENDIENTE =
  "Ya tienes una solicitud pendiente de revisión. Espera la respuesta antes de enviar una nueva.";
export const MENSAJE_CREDITO_SIN_TOPES =
  "Aún no hay topes de crédito configurados para tu grado. Habla con la cooperativa.";

export type MotivoNoSolicitar = "inactivo" | "sin_grado" | "sin_cupo" | "no_operando" | "pendiente" | "sin_topes";

export type ReglaSolicitarCredito =
  | { puedeSolicitar: true; motivo: null; mensaje: null }
  | { puedeSolicitar: false; motivo: MotivoNoSolicitar; mensaje: string };

/**
 * ¿Puede el asociado pedir un crédito? (servidor: /cuenta, /cuenta/solicitar
 * y la acción `crearSolicitud`; la base lo vuelve a exigir con su trigger).
 * Orden: activo → grado → cupo del grado → proceso «operando» → sin pendiente → topes.
 */
export function reglaSolicitarCredito(datos: {
  activo: boolean | null | undefined;
  tieneGrado: boolean;
  /** false = grado sin grupo de crédito (IJ, militares). */
  tieneCupo: boolean;
  /** Mensaje del grado sin cupo (MENSAJE_SIN_CUPO de lib/gradosCatalogo.ts). */
  mensajeSinCupo: string;
  estadoProceso: string | null | undefined;
  tienePendiente: boolean;
  cantidadTopes: number;
}): ReglaSolicitarCredito {
  const no = (motivo: MotivoNoSolicitar, mensaje: string) =>
    ({ puedeSolicitar: false, motivo, mensaje }) as const;
  // `activo` null/undefined = columna aún no aplicada: se trata como activo (default true en la base).
  if (datos.activo === false) return no("inactivo", MENSAJE_CREDITO_INACTIVO);
  if (!datos.tieneGrado) return no("sin_grado", MENSAJE_CREDITO_SIN_GRADO);
  if (!datos.tieneCupo) return no("sin_cupo", datos.mensajeSinCupo);
  if (datos.estadoProceso !== "operando") return no("no_operando", MENSAJE_CREDITO_SOLO_OPERANDO);
  if (datos.tienePendiente) return no("pendiente", MENSAJE_CREDITO_PENDIENTE);
  if (datos.cantidadTopes === 0) return no("sin_topes", MENSAJE_CREDITO_SIN_TOPES);
  return { puedeSolicitar: true, motivo: null, mensaje: null };
}
