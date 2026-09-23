/**
 * Datos de ejemplo del diseño. Las páginas los reciben como props para que
 * `ga-funcionalidad-botones` los reemplace por datos reales (cookies, Supabase).
 * Nunca importar este archivo desde lógica de producción.
 */

import type { EstadoPaso } from "@/components/ui/PasosSolicitud";

/** Correo enmascarado que se muestra en /ingresar/codigo y /afiliacion/enviada. */
export const CORREO_ENMASCARADO_EJEMPLO = "ju•••@correo.com";

/** Dígitos de ejemplo que el diseño muestra en las casillas del código. */
export const OTP_EJEMPLO = ["4", "8", "1"];

/** Tiempo restante para reenviar el código (formato m:ss). */
export const TIEMPO_REENVIO_EJEMPLO = "0:45";

/** Datos del asociado en /cuenta. */
export const ASOCIADO_EJEMPLO = {
  nombre: "[Nombre]",
  tope: "[TOPE]",
  /** Solo lectura en «Mis datos» (la base impide cambiarlos). */
  cedula: "[CÉDULA]",
  grado: "[Grado]",
  /** Único dato editable en «Mis datos» (`perfiles.telefono`). */
  telefono: "3001234567",
};

export type PasoSolicitud = {
  etiqueta: string;
  estado: EstadoPaso;
  fecha?: string;
};

/** Última solicitud de crédito del asociado en /cuenta. */
export const SOLICITUD_EJEMPLO = {
  estadoTexto: "En revisión",
  monto: "$ [MONTO]",
  modalidad: "50%",
  plazo: "[PLAZO]",
  pasos: [
    { etiqueta: "Enviada", estado: "hecho", fecha: "[fecha]" },
    { etiqueta: "En revisión", estado: "actual", fecha: "[fecha]" },
    { etiqueta: "Aprobada", estado: "pendiente" },
    { etiqueta: "Desembolso", estado: "pendiente" },
  ] satisfies PasoSolicitud[],
};

export type Convenio = {
  emoji: string;
  nombre: string;
  /** Nombre corto que usa el diseño de /cuenta. */
  nombreCorto: string;
  especialidad: string;
};

/** Convenios (spec §3). Luego vienen de la tabla `convenios`. */
export const CONVENIOS_EJEMPLO: Convenio[] = [
  { emoji: "📱", nombre: "AMB Móvil S.A.S.", nombreCorto: "AMB Móvil", especialidad: "Tecnología" },
  { emoji: "✈️", nombre: "Locos por los Viajes S.A.S.", nombreCorto: "Locos por los Viajes", especialidad: "Viajes y turismo" },
  { emoji: "🦷", nombre: "Dr. Ribero Dental Group", nombreCorto: "Dr. Ribero Dental", especialidad: "Odontología estética" },
  { emoji: "🏞️", nombre: "Racing Tours Villa de Leyva", nombreCorto: "Racing Tours", especialidad: "Tours en Villa de Leyva" },
  { emoji: "🛂", nombre: "Dream & Go Visas", nombreCorto: "Dream & Go Visas", especialidad: "Trámite de visas" },
];

export type Grado = { id: string; nombre: string };

/** Opciones del select «Grado». Luego vienen de `grados_credito`. */
export const GRADOS_EJEMPLO: Grado[] = [];

/** Cifras de la landing (pendientes de confirmar con la cooperativa). */
export const ESTADISTICAS_EJEMPLO = {
  asociados: "+200",
  creditosAprobados: "[N]",
  tiempoRespuesta: "[TIEMPO]",
  /** El diseño de celular abrevia el placeholder a «[T]» por falta de espacio. */
  tiempoRespuestaCorto: "[T]",
};

export type Testimonio = { texto: string; autor: string };

export const TESTIMONIOS_EJEMPLO: Testimonio[] = [
  {
    texto: "[Testimonio real de un asociado: qué necesitaba y qué logró.]",
    autor: "[Nombre], [grado] · asociado desde [año]",
  },
  {
    texto: "[Testimonio real de un asociado: qué necesitaba y qué logró.]",
    autor: "[Nombre], [grado] · asociado desde [año]",
  },
];
