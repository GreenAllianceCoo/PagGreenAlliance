import { z } from "zod";
import { normalizarCelular, textoDe } from "./comunes";

/**
 * Esquemas de /admin/convenios (5.9 / P-68). Los límites repiten los check de
 * la migración 20261002000000 y 20260929100600 para que el error salga por
 * campo y no como un fallo genérico de la base.
 */

/** Tamaño máximo del logo: igual que el límite del bucket `convenios-logos`. */
export const LOGO_TAMANO_MAXIMO = 1024 * 1024; // 1 MB
export const LOGO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
const EXTENSION_POR_TIPO: Record<(typeof LOGO_TIPOS)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const texto = (max: number, mensajeMax: string) =>
  z
    .string()
    .transform((v) => v.trim().replace(/[ \t]+/g, " "))
    .pipe(z.string().max(max, { error: mensajeMax }));

const textoOpcional = (max: number, mensajeMax: string) =>
  texto(max, mensajeMax).transform((v) => (v === "" ? null : v));

/** Una entrada por línea, sin vacías ni repetidas. */
function lineas(valor: string) {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const crudo of valor.split(/\r?\n/)) {
    const linea = crudo.trim().replace(/[ \t]+/g, " ");
    if (linea && !vistas.has(linea)) {
      vistas.add(linea);
      salida.push(linea);
    }
  }
  return salida;
}

const listaDeLineas = (maxItems: number, maxLargo: number, nombre: string) =>
  z
    .string()
    .transform(lineas)
    .pipe(
      z
        .array(z.string().max(maxLargo, { error: `Cada ${nombre} puede tener máximo ${maxLargo} caracteres.` }))
        .max(maxItems, { error: `Máximo ${maxItems} (una por línea).` }),
    );

/** Ruta del sitio (/convenios/…) o https; sin «..» ni espacios. */
const esquemaUrlMedio = (etiqueta: string) =>
  textoOpcional(500, `${etiqueta}: máximo 500 caracteres.`).pipe(
    z
      .string()
      .nullable()
      .refine((v) => v === null || (/^(\/convenios\/|https:\/\/)[^\s]+$/.test(v) && !v.includes("..")), {
        error: `${etiqueta}: usa una ruta /convenios/… o un enlace https://…`,
      }),
  );

const esquemaOrden = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .regex(/^[0-9]{1,5}$/, { error: "El orden es un número entre 0 y 10000." })
      .transform(Number)
      .pipe(z.number().int().min(0, { error: "El orden es un número entre 0 y 10000." }).max(10000, { error: "El orden es un número entre 0 y 10000." })),
  );

const esquemaWhatsappConvenio = z
  .string()
  .transform((v) => normalizarCelular(v.trim()))
  .pipe(
    z
      .string()
      .refine((v) => v === "" || /^3[0-9]{9}$/.test(v), { error: "El WhatsApp debe tener 10 dígitos y empezar por 3." })
      .transform((v) => (v === "" ? null : v)),
  );

const esquemaNitConvenio = textoOpcional(30, "El NIT puede tener máximo 30 caracteres.").pipe(
  z
    .string()
    .nullable()
    .refine((v) => v === null || /^[0-9][0-9.\-]*[0-9]$/.test(v) || /^[0-9]$/.test(v), {
      error: "El NIT solo lleva números, puntos y guion (p. ej. 902.038.118-7).",
    }),
);

/** Campos de datos del convenio (sin id ni logo). */
const camposConvenio = {
  nombreEmpresa: texto(120, "El nombre puede tener máximo 120 caracteres.").pipe(
    z.string().min(1, { error: "Escribe el nombre de la empresa." }),
  ),
  nit: esquemaNitConvenio,
  especialidad: texto(80, "La especialidad puede tener máximo 80 caracteres.").pipe(
    z.string().min(1, { error: "Escribe la especialidad (p. ej. Tecnología)." }),
  ),
  emoji: textoOpcional(16, "El emoji puede tener máximo 16 caracteres."),
  descripcion: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(1000, { error: "La descripción puede tener máximo 1000 caracteres." }))
    .transform((v) => (v === "" ? null : v)),
  servicios: listaDeLineas(20, 120, "servicio"),
  sedes: listaDeLineas(10, 200, "sede"),
  telefonoContacto: esquemaWhatsappConvenio,
  orden: esquemaOrden,
  videoUrl: esquemaUrlMedio("Video"),
  pdfUrl: esquemaUrlMedio("PDF"),
  pdfTamano: textoOpcional(20, "El tamaño del PDF puede tener máximo 20 caracteres."),
};

export const esquemaGuardarConvenio = z
  .object({
    id: z.uuid({ error: "Convenio no válido." }).nullable(),
    ...camposConvenio,
    visible: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.pdfUrl && !v.pdfTamano) {
      ctx.addIssue({ code: "custom", path: ["pdfTamano"], message: "Indica el tamaño del PDF (p. ej. 3 MB)." });
    }
  });

export type CampoConvenio = keyof typeof camposConvenio | "id" | "visible" | "logo";
export type DatosConvenio = z.output<typeof esquemaGuardarConvenio>;

/** Lo que escribió el admin, tal cual, para devolverlo si hay error. */
export function leerFormularioConvenio(formData: FormData) {
  return {
    id: textoDe(formData, "id"),
    nombreEmpresa: textoDe(formData, "nombreEmpresa"),
    nit: textoDe(formData, "nit"),
    especialidad: textoDe(formData, "especialidad"),
    emoji: textoDe(formData, "emoji"),
    descripcion: textoDe(formData, "descripcion"),
    servicios: textoDe(formData, "servicios"),
    sedes: textoDe(formData, "sedes"),
    telefonoContacto: textoDe(formData, "telefonoContacto"),
    orden: textoDe(formData, "orden") || "100",
    videoUrl: textoDe(formData, "videoUrl"),
    pdfUrl: textoDe(formData, "pdfUrl"),
    pdfTamano: textoDe(formData, "pdfTamano"),
    visible: formData.get("visible") === "on",
  };
}

/** Prepara la entrada para el esquema (`id` vacío = convenio nuevo). */
export function entradaGuardarConvenio(entrada: ReturnType<typeof leerFormularioConvenio>) {
  return { ...entrada, id: entrada.id === "" ? null : entrada.id };
}

export const esquemaIdConvenio = z.object({ id: z.uuid({ error: "Convenio no válido." }) });

export const esquemaVisibilidadConvenio = z.object({
  id: z.uuid({ error: "Convenio no válido." }),
  visible: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const esquemaMoverConvenio = z.object({
  id: z.uuid({ error: "Convenio no válido." }),
  direccion: z.enum(["subir", "bajar"]),
});

/**
 * Valida el archivo del logo (tipo y tamaño) y devuelve la extensión. Se usa en
 * el servidor; el navegador solo lo anticipa con `accept`. `ok:false` trae el
 * mensaje para el campo.
 */
export function validarLogo(archivo: { type: string; size: number }):
  | { ok: true; extension: string; tipo: (typeof LOGO_TIPOS)[number] }
  | { ok: false; mensaje: string } {
  const tipo = LOGO_TIPOS.find((t) => t === archivo.type);
  if (!tipo) return { ok: false, mensaje: "El logo debe ser PNG, JPG o WebP." };
  if (archivo.size <= 0) return { ok: false, mensaje: "El archivo del logo está vacío." };
  if (archivo.size > LOGO_TAMANO_MAXIMO) return { ok: false, mensaje: "El logo puede pesar máximo 1 MB." };
  return { ok: true, extension: EXTENSION_POR_TIPO[tipo], tipo };
}

/** Comprueba que los primeros bytes corresponden al tipo declarado (no basta con el Content-Type del navegador). */
export function bytesCoincidenConTipo(bytes: Uint8Array, tipo: (typeof LOGO_TIPOS)[number]): boolean {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  switch (tipo) {
    case "image/png":
      return empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return empieza(0xff, 0xd8, 0xff);
    case "image/webp":
      return empieza(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
}

