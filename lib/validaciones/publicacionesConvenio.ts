import { z } from "zod";

/** Filtros de /admin/convenios/publicaciones (docs/spec-convenios.md §B4). Lo que no valga se ignora. */
export const ESTADOS_FILTRO = ["publicada", "programada", "vencida", "oculta"] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined), esquema.optional()).catch(undefined);

export const esquemaFiltrosPublicaciones = z.object({
  convenio: opcional(z.uuid()),
  tipo: opcional(z.enum(["promocion", "catalogo"])),
  estado: opcional(z.enum(ESTADOS_FILTRO)),
});
export type FiltrosPublicaciones = z.output<typeof esquemaFiltrosPublicaciones>;

export const MOTIVO_OCULTAR_MAX = 200;
export const MENSAJE_MOTIVO_LARGO = `El motivo puede tener hasta ${MOTIVO_OCULTAR_MAX} caracteres.`;

export const esquemaOcultarPublicacion = z.object({
  id: z.uuid(),
  motivo: z
    .string()
    .trim()
    .max(MOTIVO_OCULTAR_MAX, MENSAJE_MOTIVO_LARGO)
    .transform((m) => (m === "" ? null : m)),
});

export const esquemaMostrarPublicacion = z.object({ id: z.uuid() });
