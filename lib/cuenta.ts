import { formatTasa } from "@/lib/credito";
import type { PasoSolicitud } from "@/lib/mock";

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
  tasa_interes_mensual: number | string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
};

export type VistaSolicitud = {
  estadoTexto: string;
  monto: string;
  modalidad: string;
  plazo: string;
  /** Tasa de interés mensual guardada en la solicitud (la cuota no se calcula). */
  tasa: string;
  pasos: PasoSolicitud[];
};

/**
 * Pasos Enviada → En revisión → Aprobada → Desembolso.
 * TODO(pendiente-spec): la base no tiene estado de desembolso; una aprobada
 * queda con «Desembolso» como paso actual. Tampoco hay diseño para rechazada:
 * el tercer paso pasa a llamarse «Rechazada».
 */
export function vistaSolicitud(fila: FilaSolicitud): VistaSolicitud {
  const enviada = formatearFecha(fila.fecha_solicitud);
  const respuesta = formatearFecha(fila.fecha_respuesta);

  let estadoTexto: string;
  let pasos: PasoSolicitud[];
  if (fila.estado === "aprobado") {
    estadoTexto = "Aprobada";
    pasos = [
      { etiqueta: "Enviada", estado: "hecho", fecha: enviada },
      { etiqueta: "En revisión", estado: "hecho" },
      { etiqueta: "Aprobada", estado: "hecho", fecha: respuesta },
      { etiqueta: "Desembolso", estado: "actual" },
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
    tasa: formatTasa(Number(fila.tasa_interes_mensual)),
    pasos,
  };
}

/** Tope más alto del grado (entre 50 % y 100 %). */
export function textoTope(topes: { capacidad_maxima: number | string }[] | null | undefined) {
  if (!topes || topes.length === 0) return "Sin grado asignado";
  const maximo = Math.max(...topes.map((t) => Number(t.capacidad_maxima)));
  return formatearPesos(maximo);
}
