import type { CodigoInstitucion } from "@/lib/validaciones/instituciones";

/**
 * Dominios permitidos del CORREO INSTITUCIONAL por institución (spec
 * requerimientos-ricardo §12.3, R-04). Un solo módulo para el formulario
 * (cliente), el esquema zod (servidor) y las pruebas. La base valida los
 * mismos dominios en `20260930200300_dominio_correo_institucional.sql`:
 * si cambia esta lista, cambia también esa migración.
 *
 * Se compara el dominio EXACTO (sin mayúsculas), sin comodines de subdominio.
 * Policía: policia.gov.co y correo.policia.gov.co (directorio SIGEP).
 * Ejército: buzonejercito.mil.co (correo personal de los uniformados) y
 * ejercito.mil.co (dependencias; se permite por si el Ejército migra).
 */
export const DOMINIOS_INSTITUCIONALES: Record<CodigoInstitucion, readonly string[]> = {
  policia: ["policia.gov.co", "correo.policia.gov.co"],
  ejercito: ["buzonejercito.mil.co", "ejercito.mil.co"],
};

/** Mensajes de la spec §12.3 por institución. */
export const MENSAJE_DOMINIO_INSTITUCIONAL: Record<CodigoInstitucion, string> = {
  policia: "Usa tu correo institucional de la Policía (@policia.gov.co)",
  ejercito: "Usa tu correo institucional del Ejército (@buzonejercito.mil.co o @ejercito.mil.co)",
};

/** ¿El correo termina en uno de los dominios de la institución? (comparación exacta, sin mayúsculas). */
export function correoInstitucionalValido(correo: string, institucion: CodigoInstitucion): boolean {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1) return false;
  return DOMINIOS_INSTITUCIONALES[institucion].includes(limpio.slice(arroba + 1));
}
