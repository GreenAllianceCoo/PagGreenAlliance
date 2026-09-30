import type { PasoSolicitud } from "@/lib/mock";
import {
  formatearFechaCorta,
  formatearFechaLarga,
  hoyBogota,
  mesesYDiasEntre,
  sumarMeses,
  textoMesesYDias,
  type FechaISO,
} from "@/lib/fechas";
import { TEXTO_SIN_CUPO_CORTO } from "@/lib/gradosCatalogo";

/**
 * Convierte las filas de Supabase en lo que muestra /cuenta.
 * Funciones puras (sin Supabase) para poder probarlas.
 */

/** 1000000 → «$ 1.000.000». */
export function formatearPesos(valor: number | string) {
  return `$ ${Math.round(Number(valor)).toLocaleString("es-CO")}`;
}

/** Fecha corta en hora de Colombia: «23 sept». */
export function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return undefined;
  return new Date(fecha).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
}

export type FilaSolicitud = {
  estado: "pendiente" | "aprobado" | "rechazado";
  monto_solicitado: number | string;
  porcentaje_devolucion: "50" | "100";
  plazo_meses: number;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  /** §12.2: fecha (AAAA-MM-DD) en que el admin marcó el desembolso; null = aún no desembolsado. */
  fecha_desembolso?: string | null;
};

/**
 * Conteo regresivo del plazo del crédito (spec-requerimientos-ricardo §3.10 y
 * §12.2, R-07 cerrado): los 3 meses cuentan desde el DESEMBOLSO
 * (`fecha_desembolso`). Antes del desembolso no hay conteo.
 */
export type ConteoCredito = {
  desde: FechaISO;
  hasta: FechaISO;
  hastaTexto: string;
  mesesRestantes: number;
  diasRestantes: number;
  /** «2 meses y 5 días» o «0 días». */
  faltaTexto: string;
  vencido: boolean;
};

export type VistaSolicitud = {
  estadoTexto: string;
  monto: string;
  modalidad: string;
  plazo: string;
  pasos: PasoSolicitud[];
  /** Solo para una solicitud aprobada; null en las demás. */
  conteo: ConteoCredito | null;
};

/** Conteo de un crédito desembolsado: fecha_desembolso + plazo_meses (3), en días de Colombia. */
export function conteoCredito(fila: FilaSolicitud, hoy: FechaISO = hoyBogota()): ConteoCredito | null {
  if (fila.estado !== "aprobado" || !fila.fecha_desembolso || !fila.plazo_meses) return null;
  const desde = fila.fecha_desembolso.slice(0, 10);
  const hasta = sumarMeses(desde, fila.plazo_meses);
  const restante = mesesYDiasEntre(hoy, hasta);
  return {
    desde,
    hasta,
    hastaTexto: formatearFechaLarga(hasta),
    mesesRestantes: restante.meses,
    diasRestantes: restante.dias,
    faltaTexto: textoMesesYDias(restante),
    vencido: restante.meses === 0 && restante.dias === 0,
  };
}

/**
 * Pasos Enviada → En revisión → Aprobada → Desembolso. §12.2: una aprobada
 * queda «Aprobado · pendiente de desembolso» hasta que el admin marca el
 * desembolso; entonces el paso «Desembolso» se completa y arranca el conteo.
 * Tampoco hay diseño para rechazada: el tercer paso pasa a llamarse «Rechazada».
 */
export function vistaSolicitud(fila: FilaSolicitud, hoy: FechaISO = hoyBogota()): VistaSolicitud {
  const enviada = formatearFecha(fila.fecha_solicitud);
  const respuesta = formatearFecha(fila.fecha_respuesta);

  let estadoTexto: string;
  let pasos: PasoSolicitud[];
  if (fila.estado === "aprobado") {
    const desembolsada = Boolean(fila.fecha_desembolso);
    estadoTexto = desembolsada ? "Desembolsado" : "Aprobado · pendiente de desembolso";
    pasos = [
      { etiqueta: "Enviada", estado: "hecho", fecha: enviada },
      { etiqueta: "En revisión", estado: "hecho" },
      { etiqueta: "Aprobada", estado: "hecho", fecha: respuesta },
      desembolsada
        ? { etiqueta: "Desembolso", estado: "hecho", fecha: formatearFechaCorta(fila.fecha_desembolso!.slice(0, 10)) }
        : { etiqueta: "Desembolso", estado: "actual" },
    ];
  } else if (fila.estado === "rechazado") {
    estadoTexto = "Rechazada";
    pasos = [
      { etiqueta: "Enviada", estado: "hecho", fecha: enviada },
      { etiqueta: "En revisión", estado: "hecho" },
      { etiqueta: "Rechazada", estado: "actual", fecha: respuesta },
      { etiqueta: "Desembolso", estado: "pendiente" },
    ];
  } else {
    estadoTexto = "En revisión";
    pasos = [
      { etiqueta: "Enviada", estado: "hecho", fecha: enviada },
      { etiqueta: "En revisión", estado: "actual" },
      { etiqueta: "Aprobada", estado: "pendiente" },
      { etiqueta: "Desembolso", estado: "pendiente" },
    ];
  }

  return {
    estadoTexto,
    monto: formatearPesos(fila.monto_solicitado),
    modalidad: `${fila.porcentaje_devolucion}%`,
    plazo: `${fila.plazo_meses} ${fila.plazo_meses === 1 ? "mes" : "meses"}`,
    pasos,
    conteo: conteoCredito(fila, hoy),
  };
}

/**
 * Tope más alto del grado (entre 50 % y 100 %). `sinCupo` = el grado existe
 * pero no tiene grupo de crédito (IJ, militares): «Sin cupo configurado».
 */
export function textoTope(
  topes: { capacidad_maxima: number | string }[] | null | undefined,
  opciones: { sinCupo?: boolean } = {},
) {
  if (opciones.sinCupo) return TEXTO_SIN_CUPO_CORTO;
  if (!topes || topes.length === 0) return "Sin grado asignado";
  const maximo = Math.max(...topes.map((t) => Number(t.capacidad_maxima)));
  return formatearPesos(maximo);
}
