import { z } from "zod";
import { TAMANO_MAXIMO_FOTO_CARNE, TIPOS_FOTO_CARNE } from "@/lib/fotoCarne";

/** Esquemas de la foto del carné (el navegador y el servidor usan los mismos). */

export const esquemaPrepararFotoCarne = z.object({
  tipo: z.enum(TIPOS_FOTO_CARNE, { error: "La foto debe ser JPG, PNG o WEBP." }),
  tamano: z
    .number({ error: "No pudimos leer el tamaño de la foto." })
    .int()
    .min(1, { error: "El archivo está vacío." })
    .max(TAMANO_MAXIMO_FOTO_CARNE, { error: "La foto pesa más de 5 MB." }),
});

export const esquemaGuardarFotoCarne = z.object({
  ruta: z
    .string({ error: "Falta la foto." })
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, { error: "La foto no es válida." }),
});
