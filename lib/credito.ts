import { MENSAJE_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
// Reglas del crédito que la app necesita conocer. La base las vuelve a
// validar (trigger chk_monto_solicitud, migración 20260923173355).

export const MONTO_MINIMO = 100000;

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
