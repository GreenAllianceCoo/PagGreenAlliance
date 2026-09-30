/** Valores del enum public.institucion_afiliacion (spec-fase-2 §2, spec-requerimientos-ricardo §2.3). */
export const INSTITUCIONES = ["policia", "ejercito"] as const;
export type CodigoInstitucion = (typeof INSTITUCIONES)[number];

export const NOMBRE_INSTITUCION: Record<CodigoInstitucion, string> = {
  policia: "Policía Nacional",
  ejercito: "Ejército Nacional",
};

export function esInstitucion(valor: unknown): valor is CodigoInstitucion {
  return valor === "policia" || valor === "ejercito";
}

/** Nombre para mostrar de una institución guardada (null si no hay). */
export function nombreInstitucion(valor: unknown): string | null {
  return esInstitucion(valor) ? NOMBRE_INSTITUCION[valor] : null;
}
