import { z } from "zod";
import { TAMANO_MAXIMO_COMPROBANTE, TIPOS_COMPROBANTE } from "@/lib/comprobantes";

/**
 * Esquemas del comprobante de desembolso (cliente y servidor usan los mismos).
 * La ruta se valida contra la solicitud en el servidor (`rutaEsDeSolicitud`).
 */

export const esquemaPrepararComprobante = z.object({
  solicitudId: z.uuid({ error: "Falta el id de la solicitud." }),
  tipo: z.enum(TIPOS_COMPROBANTE, { error: "El comprobante debe ser una imagen JPG, PNG o WEBP, o un PDF." }),
  tamano: z
    .number({ error: "No pudimos leer el tamaño del archivo." })
    .int()
    .min(1, { error: "El archivo está vacío." })
    .max(TAMANO_MAXIMO_COMPROBANTE, { error: "El comprobante pesa más de 5 MB." }),
});

export const esquemaRegistrarComprobante = z.object({
  solicitudId: z.uuid({ error: "Falta el id de la solicitud." }),
  ruta: z
    .string({ error: "Falta el archivo del comprobante." })
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/, { error: "El archivo del comprobante no es válido." }),
});

export const esquemaVerComprobante = z.object({
  solicitudId: z.uuid({ error: "Falta el id de la solicitud." }),
});
