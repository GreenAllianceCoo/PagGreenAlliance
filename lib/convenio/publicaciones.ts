import { z } from "zod";

/**
 * Publicaciones de la empresa en convenio (docs/spec-convenios.md §B1, §B3).
 * Puras: las usan el panel (cliente y servidor) y las pruebas. Los límites
 * repiten los check y el trigger de la migración 20261121000000 para que el
 * error salga por campo y no como un fallo genérico de la base.
 */

export type TipoPublicacion = "promocion" | "catalogo";
export type EstadoPublicacion = "programada" | "publicada" | "vencida" | "oculta";

export const BUCKET_PUBLICACIONES = "convenios-publicaciones";
export const TOPE_POR_TIPO: Record<TipoPublicacion, number> = { promocion: 10, catalogo: 5 };
export const NOMBRE_TIPO: Record<TipoPublicacion, { uno: string; varios: string; nuevo: string }> = {
  promocion: { uno: "promoción", varios: "promociones", nuevo: "Nueva promoción" },
  catalogo: { uno: "catálogo", varios: "catálogos", nuevo: "Nuevo catálogo" },
};

/** Peso máximo de la imagen que elige el convenio (antes de reducirla en el navegador). */
export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024;
/** Peso máximo de la imagen que llega a la Server Action (ya reducida); el límite de las acciones es 3 MB. */
export const IMAGEN_SUBIDA_MAX_BYTES = 2.5 * 1024 * 1024;
export const IMAGEN_LADO_MAX_PX = 1600;
export const IMAGEN_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const PDF_MAX_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGENES_CATALOGO = 10;
export const DIAS_MAX_PROMOCION = 366;

export type Publicacion = {
  id: string;
  tipo: TipoPublicacion;
  titulo: string;
  descripcion: string | null;
  beneficio: string | null;
  imagenes: string[];
  pdfPath: string | null;
  iniciaEl: string | null;
  terminaEl: string | null;
  ocultaEn: string | null;
  ocultaMotivo: string | null;
  creadaEn: string;
};

/** Fecha de hoy en Bogotá como «AAAA-MM-DD» (igual que public.hoy_bogota()). */
export function hoyBogota(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** Estado que ve el convenio. Oculta gana a todo; luego las fechas (las «AAAA-MM-DD» se comparan como texto). */
export function estadoPublicacion(
  p: Pick<Publicacion, "ocultaEn" | "iniciaEl" | "terminaEl">,
  hoy = hoyBogota(),
): EstadoPublicacion {
  if (p.ocultaEn) return "oculta";
  if (p.iniciaEl && p.iniciaEl > hoy) return "programada";
  if (p.terminaEl && p.terminaEl < hoy) return "vencida";
  return "publicada";
}

/** Cuenta para el tope: no ocultas y no vencidas (publicadas + programadas), igual que el trigger. */
export function cuentaParaTope(p: Pick<Publicacion, "ocultaEn" | "terminaEl">, hoy = hoyBogota()) {
  return !p.ocultaEn && (!p.terminaEl || p.terminaEl >= hoy);
}

export function activasPorTipo(publicaciones: Publicacion[], hoy = hoyBogota()): Record<TipoPublicacion, number> {
  const cuenta = { promocion: 0, catalogo: 0 };
  for (const p of publicaciones) if (cuentaParaTope(p, hoy)) cuenta[p.tipo] += 1;
  return cuenta;
}

/** «12 de diciembre» / «12 dic. 2026» para mostrar fechas «AAAA-MM-DD» sin corrimiento de zona. */
export function fechaCorta(iso: string, conAnio = false) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const textoLimpio = (v: string) => v.trim().replace(/[ \t]+/g, " ");
const fechaOpcional = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.union([z.literal("").transform(() => null), z.string().regex(FECHA, { error: "Fecha no válida." })]));

export type CampoPublicacion = "titulo" | "descripcion" | "beneficio" | "iniciaEl" | "terminaEl" | "archivos";

/**
 * Datos de texto y fechas de una publicación (los archivos se validan aparte).
 * `hoy` permite probar con una fecha fija.
 */
export function esquemaPublicacion(hoy = hoyBogota()) {
  return z
    .object({
      tipo: z.enum(["promocion", "catalogo"], { error: "Tipo de publicación no válido." }),
      titulo: z
        .string()
        .transform(textoLimpio)
        .pipe(
          z
            .string()
            .min(3, { error: "Escribe un título de al menos 3 letras." })
            .max(80, { error: "El título puede tener máximo 80 caracteres." }),
        ),
      descripcion: z
        .string()
        .transform((v) => v.trim())
        .pipe(z.string().max(600, { error: "La descripción puede tener máximo 600 caracteres." }))
        .transform((v) => (v === "" ? null : v)),
      beneficio: z
        .string()
        .transform(textoLimpio)
        .pipe(z.string().max(30, { error: "El beneficio puede tener máximo 30 caracteres." }))
        .transform((v) => (v === "" ? null : v)),
      iniciaEl: fechaOpcional,
      terminaEl: fechaOpcional,
    })
    .superRefine((v, ctx) => {
      const error = (campo: CampoPublicacion, message: string) => ctx.addIssue({ code: "custom", path: [campo], message });
      if (v.tipo === "promocion") {
        if (!v.descripcion) error("descripcion", "Cuenta en qué consiste la promoción.");
        if (!v.iniciaEl) error("iniciaEl", "Elige desde cuándo aplica.");
        if (!v.terminaEl) error("terminaEl", "Elige hasta cuándo aplica.");
      } else if (v.beneficio) {
        error("beneficio", "El beneficio solo va en las promociones.");
      }
      if (v.iniciaEl && v.terminaEl && v.terminaEl < v.iniciaEl) {
        error("terminaEl", "La fecha final no puede ser antes de la inicial.");
      }
      if (v.terminaEl && v.terminaEl < hoy) error("terminaEl", "La fecha final ya pasó.");
      if (v.tipo === "promocion" && v.iniciaEl && v.terminaEl && diasEntre(v.iniciaEl, v.terminaEl) > DIAS_MAX_PROMOCION) {
        error("terminaEl", "Una promoción puede durar máximo un año.");
      }
    });
}

export type DatosPublicacion = z.output<ReturnType<typeof esquemaPublicacion>>;

/** Lo que escribió el convenio, tal cual, para devolverlo si hay error. */
export function leerFormularioPublicacion(formData: FormData) {
  const texto = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    tipo: texto("tipo"),
    titulo: texto("titulo"),
    descripcion: texto("descripcion"),
    beneficio: texto("beneficio"),
    iniciaEl: texto("iniciaEl"),
    terminaEl: texto("terminaEl"),
  };
}

/** Error del archivo elegido (antes de subirlo); null si sirve. */
export function errorDeImagen(archivo: { type: string; size: number }): string | null {
  if (!IMAGEN_TIPOS.includes(archivo.type as (typeof IMAGEN_TIPOS)[number])) return "Usa imágenes JPG, PNG o WebP.";
  if (archivo.size <= 0) return "La imagen está vacía.";
  if (archivo.size > IMAGEN_MAX_BYTES) return "Cada imagen puede pesar máximo 5 MB.";
  return null;
}

export function errorDePdf(archivo: { type: string; size: number }): string | null {
  if (archivo.type !== "application/pdf") return "El catálogo debe ser un archivo PDF.";
  if (archivo.size <= 0) return "El PDF está vacío.";
  if (archivo.size > PDF_MAX_BYTES) return "El PDF puede pesar máximo 15 MB.";
  return null;
}

/**
 * Archivos que exige cada tipo (igual que convenio_publicaciones_tipo_chk):
 * promoción = 1 imagen; catálogo = 1 PDF o de 1 a 10 imágenes.
 */
export function errorDeArchivos(tipo: TipoPublicacion, imagenes: number, pdf: boolean): string | null {
  if (tipo === "promocion") {
    if (pdf) return "La promoción lleva una imagen, no un PDF.";
    return imagenes === 1 ? null : "La promoción lleva una imagen.";
  }
  if (pdf) return imagenes === 0 ? null : "El catálogo lleva un PDF o imágenes, no los dos.";
  if (imagenes < 1) return "Sube un PDF o al menos una imagen.";
  if (imagenes > MAX_IMAGENES_CATALOGO) return `Máximo ${MAX_IMAGENES_CATALOGO} imágenes.`;
  return null;
}

/** true si la ruta es de esta publicación: <convenio>/<publicación>/<archivo>. */
export function rutaEsDeLaPublicacion(ruta: string, convenioId: string, publicacionId: string) {
  return new RegExp(`^${convenioId}/${publicacionId}/[A-Za-z0-9._-]{1,80}$`).test(ruta) && !ruta.includes("..");
}
