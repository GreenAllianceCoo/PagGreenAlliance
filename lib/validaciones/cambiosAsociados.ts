import { z } from "zod";

/** Filas por página de «Cambios». */
export const FILAS_CAMBIOS = 25;

const fechaOpcional = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
  .optional()
  .catch(undefined);

/**
 * Filtros de /admin/cambios (vienen de la URL, así que NUNCA fallan: un valor inválido
 * se ignora). `asociado` es el id de un perfil (enlace desde su ficha); `q` busca por
 * nombre o por la cédula exacta; las fechas son días de Colombia y se incluyen ambas.
 */
export const esquemaFiltrosCambios = z
  .object({
    asociado: z.uuid().optional().catch(undefined),
    q: z
      .string()
      .transform((v) => v.trim().replace(/\s+/g, " ").slice(0, 80))
      .optional()
      .catch(undefined),
    desde: fechaOpcional,
    hasta: fechaOpcional,
    pagina: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  })
  .transform((f) => {
    const [desde, hasta] = f.desde && f.hasta && f.desde > f.hasta ? [f.hasta, f.desde] : [f.desde, f.hasta];
    return { asociado: f.asociado, q: f.q || undefined, desde, hasta, pagina: f.pagina ?? 1 };
  });

export type FiltrosCambios = z.output<typeof esquemaFiltrosCambios>;
