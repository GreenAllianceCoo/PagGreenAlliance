import { z } from "zod";
import { textoDe } from "./comunes";

/** Casillas del número de boleta del sorteo (`numero-1` … `numero-6`), igual que el código de /ingresar. */
export const LONGITUD_BOLETA = 6;
export const MENSAJE_NUMERO_BOLETA_INVALIDO = "Escribe los 6 números de tu boleta.";

export const esquemaNumeroBoleta = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{6}$/, { error: MENSAJE_NUMERO_BOLETA_INVALIDO }));

/** Une las 6 casillas del formulario en un solo número. */
export function leerNumeroBoleta(formData: FormData) {
  return Array.from({ length: LONGITUD_BOLETA }, (_, i) => textoDe(formData, `numero-${i + 1}`)).join("");
}
