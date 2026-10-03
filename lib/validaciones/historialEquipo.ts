import { z } from "zod";

/** Filas por página del «Historial del equipo». */
export const FILAS_HISTORIAL = 25;

const fechaOpcional = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v))
  .optional()
  .catch(undefined);

/**
 * Filtros de /admin/historial (vienen de la URL, así que NUNCA fallan: un valor
 * inválido simplemente se ignora). `persona` es el id de un perfil; las fechas
 * son días de Colombia (AAAA-MM-DD) y se incluyen ambas; `pagina` empieza en 1.
 * Si «desde» es posterior a «hasta», se intercambian.
 */
export const esquemaFiltrosHistorial = z
  .object({
    persona: z.uuid().optional().catch(undefined),
    desde: fechaOpcional,
    hasta: fechaOpcional,
    pagina: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  })
  .transform((f) => {
    const [desde, hasta] = f.desde && f.hasta && f.desde > f.hasta ? [f.hasta, f.desde] : [f.desde, f.hasta];
    return { persona: f.persona, desde, hasta, pagina: f.pagina ?? 1 };
  });

export type FiltrosHistorial = z.output<typeof esquemaFiltrosHistorial>;
