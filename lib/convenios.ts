/**
 * Empresas en convenio (docs/spec-afiliacion-y-login.md §3).
 * Decisión del 23-sep: por ahora son FIJAS (no se leen de la tabla `convenios`)
 * y se muestran en la landing y en la sección #convenios de /cuenta.
 * TODO(pendiente-spec): especialidad exacta de AMB Móvil y Racing Tours.
 */

export type Convenio = {
  emoji: string;
  nombre: string;
  /** Nombre corto que usa el diseño de /cuenta. */
  nombreCorto: string;
  especialidad: string;
};

export const CONVENIOS: Convenio[] = [
  { emoji: "📱", nombre: "AMB Móvil S.A.S.", nombreCorto: "AMB Móvil", especialidad: "Tecnología" },
  { emoji: "✈️", nombre: "Locos por los Viajes S.A.S.", nombreCorto: "Locos por los Viajes", especialidad: "Viajes y turismo" },
  { emoji: "🦷", nombre: "Dr. Ribero Dental Group", nombreCorto: "Dr. Ribero Dental", especialidad: "Odontología estética" },
  { emoji: "🏞️", nombre: "Racing Tours Villa de Leyva", nombreCorto: "Racing Tours", especialidad: "Tours en Villa de Leyva" },
  { emoji: "🛂", nombre: "Dream & Go Visas", nombreCorto: "Dream & Go Visas", especialidad: "Trámite de visas" },
];
