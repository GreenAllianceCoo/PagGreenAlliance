/**
 * Catálogo de grados (spec-requerimientos-ricardo §1, migración
 * 20260929100100_catalogo_grados.sql). Funciones puras: sirven en el
 * navegador (filtrar el selector por institución) y en el servidor
 * (validar la afiliación y buscar el cupo de crédito).
 *
 * Dos conceptos distintos:
 *  - GRADO de la persona: texto con FK a `grados.codigo` (17 grados + «OF»
 *    heredado). Es lo que se guarda en perfiles.grado y en la afiliación.
 *  - GRUPO de crédito: el enum `grado_policial` (PP, PT, SI, IT, OF). Dice
 *    qué fila de `grados_credito` aplica. `grupo_credito = null` = el grado
 *    todavía no tiene cupo (IJ y militares SLP–SP).
 */

import type { CodigoInstitucion } from "@/lib/validaciones/instituciones";

/** Valores del enum public.grado_policial = grupos de crédito (mismo orden que en la base). */
export const GRUPOS_CREDITO = ["PP", "PT", "SI", "IT", "OF"] as const;
export type GrupoCredito = (typeof GRUPOS_CREDITO)[number];

export type GradoCatalogo = {
  codigo: string;
  nombre: string;
  policia: boolean;
  ejercito: boolean;
  /** null = sin cupo de crédito configurado (no puede pedir crédito todavía). */
  grupoCredito: GrupoCredito | null;
  orden: number;
  /** false = grado heredado (OF): existe para datos antiguos, no se ofrece en /afiliacion. */
  seleccionable: boolean;
};

/** Texto de la spec §1 para los grados sin cifras en la presentación. */
export const MENSAJE_SIN_CUPO =
  "Tu grado todavía no tiene cupo de crédito configurado; tu asesor te contactará";

/** Texto corto para listas y tarjetas (panel del asesor, tope en /cuenta). */
export const TEXTO_SIN_CUPO_CORTO = "Sin cupo configurado";

export function esGrupoCredito(valor: unknown): valor is GrupoCredito {
  return typeof valor === "string" && (GRUPOS_CREDITO as readonly string[]).includes(valor);
}

/** Convierte una fila cruda de `public.grados` en GradoCatalogo (tolerante a columnas faltantes). */
export function filaAGrado(fila: Record<string, unknown>): GradoCatalogo {
  return {
    codigo: String(fila.codigo ?? ""),
    nombre: String(fila.nombre ?? fila.codigo ?? ""),
    policia: fila.policia === true,
    ejercito: fila.ejercito === true,
    grupoCredito: esGrupoCredito(fila.grupo_credito) ? fila.grupo_credito : null,
    orden: Number(fila.orden ?? 0),
    seleccionable: fila.seleccionable !== false,
  };
}

/** ¿El grado se ofrece para esa institución? */
export function gradoAplicaA(grado: GradoCatalogo, institucion: CodigoInstitucion): boolean {
  return institucion === "policia" ? grado.policia : grado.ejercito;
}

/**
 * Opciones del selector «Grado» para una institución: solo los
 * seleccionables, en el orden del catálogo. Sin institución → lista vacía
 * (el selector se muestra deshabilitado hasta elegir la institución).
 */
export function gradosDeInstitucion(
  catalogo: GradoCatalogo[],
  institucion: CodigoInstitucion | "" | null | undefined,
): GradoCatalogo[] {
  if (institucion !== "policia" && institucion !== "ejercito") return [];
  return catalogo
    .filter((g) => g.seleccionable && gradoAplicaA(g, institucion))
    .sort((a, b) => a.orden - b.orden);
}

/**
 * Si la persona cambia la institución y el grado elegido ya no aplica, el
 * selector se limpia (spec §1). Devuelve el grado que debe quedar ("" = limpiar).
 */
export function gradoTrasCambiarInstitucion(
  catalogo: GradoCatalogo[],
  institucion: CodigoInstitucion | "",
  gradoActual: string,
): string {
  if (!gradoActual) return "";
  return gradosDeInstitucion(catalogo, institucion).some((g) => g.codigo === gradoActual) ? gradoActual : "";
}

/** Nombre completo del grado («TE» → «Teniente»), o el código si no está en el catálogo. */
export function nombreDeGrado(catalogo: GradoCatalogo[], codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return catalogo.find((g) => g.codigo === codigo)?.nombre ?? codigo;
}
