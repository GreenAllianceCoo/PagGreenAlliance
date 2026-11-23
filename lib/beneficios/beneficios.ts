import { z } from "zod";
import type { TipoPublicacion } from "@/lib/convenio/publicaciones";

/**
 * Beneficios para el asociado (docs/spec-convenios.md §B5): funciones puras
 * (sin base) para la ciudad de cada convenio, los filtros y la etiqueta «Nuevo».
 */

/** Los convenios sin sedes salen en «Todo el país». */
export const TODO_EL_PAIS = "Todo el país";
export const DIAS_NUEVO = 7;

const DEPARTAMENTOS = new Set(
  [
    "amazonas", "antioquia", "arauca", "atlantico", "bolivar", "boyaca", "caldas", "caqueta", "casanare", "cauca",
    "cesar", "choco", "cordoba", "cundinamarca", "guainia", "guaviare", "huila", "la guajira", "guajira", "magdalena",
    "meta", "narino", "norte de santander", "putumayo", "quindio", "risaralda", "san andres", "santander", "sucre",
    "tolima", "valle", "valle del cauca", "vaupes", "vichada", "colombia",
  ],
);

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** «Bogotá D.C.», «bogota» → «Bogotá». */
function normalizarCiudad(ciudad: string) {
  const limpia = ciudad.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (/^bogot[aá](?![a-z])/i.test(limpia)) return "Bogotá";
  return limpia;
}

/**
 * Ciudad de una sede escrita a mano: el último tramo después de una coma, salvo
 * que sea un departamento («Villa de Leyva, Boyacá» → «Villa de Leyva»).
 * Sin comas no hay forma segura de saberla: null.
 */
export function ciudadDeSede(sede: string): string | null {
  const tramos = sede
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tramos.length === 0) return null;
  if (tramos.length === 1) {
    const unico = tramos[0]!;
    // Una sola palabra o frase corta sin números: se toma como ciudad («Villa de Leyva»).
    return /\d|#/.test(unico) ? null : normalizarCiudad(unico);
  }
  let i = tramos.length - 1;
  while (i > 0 && DEPARTAMENTOS.has(sinTildes(tramos[i]!).replace(/\s*d\.?\s*c\.?$/, ""))) i -= 1;
  const candidato = tramos[i]!;
  if (/\d|#/.test(candidato)) return null;
  return normalizarCiudad(candidato);
}

/** Ciudades de un convenio, sin repetir; sin sedes (o sin ciudad legible) = «Todo el país». */
export function ciudadesDeConvenio(sedes: string[]): string[] {
  const ciudades = [...new Set(sedes.map(ciudadDeSede).filter((c): c is string => Boolean(c)))];
  return ciudades.length > 0 ? ciudades : [TODO_EL_PAIS];
}

/** Publicada en los últimos 7 días. */
export function esNueva(creadaEn: string, ahora = new Date()) {
  const t = Date.parse(creadaEn);
  return Number.isFinite(t) && ahora.getTime() - t < DIAS_NUEVO * 86_400_000;
}

const opcional = (max: number) =>
  z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.string().max(max).optional())
    .catch(undefined);

export const esquemaFiltrosBeneficios = z.object({
  aliado: z
    .preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), z.uuid().optional())
    .catch(undefined),
  categoria: opcional(80),
  ciudad: opcional(80),
});
export type FiltrosBeneficios = z.output<typeof esquemaFiltrosBeneficios>;

export type ItemFiltrable = {
  convenioId: string;
  especialidad: string;
  ciudades: string[];
};

/** Un convenio de «Todo el país» aparece en cualquier ciudad que se elija. */
export function filtrarBeneficios<T extends ItemFiltrable>(lista: T[], f: FiltrosBeneficios): T[] {
  return lista.filter(
    (p) =>
      (!f.aliado || p.convenioId === f.aliado) &&
      (!f.categoria || p.especialidad === f.categoria) &&
      (!f.ciudad || p.ciudades.includes(f.ciudad) || p.ciudades.includes(TODO_EL_PAIS)),
  );
}

/** Opciones de los filtros a partir de lo que hay publicado (sin repetir, en orden alfabético). */
export function opcionesDeFiltros(lista: (ItemFiltrable & { convenioNombre: string })[]) {
  const aliados = new Map<string, string>();
  const categorias = new Set<string>();
  const ciudades = new Set<string>();
  for (const p of lista) {
    aliados.set(p.convenioId, p.convenioNombre);
    if (p.especialidad) categorias.add(p.especialidad);
    for (const c of p.ciudades) if (c !== TODO_EL_PAIS) ciudades.add(c);
  }
  const orden = (a: string, b: string) => a.localeCompare(b, "es");
  return {
    aliados: [...aliados].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => orden(a.nombre, b.nombre)),
    categorias: [...categorias].sort(orden),
    ciudades: [...ciudades].sort(orden),
  };
}

/** Resumen corto de una publicación activa (para el detalle del convenio en /cuenta). */
export type ResumenPublicacion = { id: string; titulo: string; tipo: TipoPublicacion; beneficio: string | null };
