import { z } from "zod";
import { esquemaCedula, textoDe } from "./comunes";

/** Paso 1 de /ingresar: la cédula. */
export const esquemaIngresoCedula = z.object({ cedula: esquemaCedula });

export const LONGITUD_CODIGO = 6;
export const MENSAJE_CODIGO_INVALIDO = "El código no es válido o ya venció";
/**
 * F-02: mensaje cuando se supera el tope de intentos de verificación (por
 * cédula o por IP, ver lib/ingreso/servidor.ts#dentroDelLimiteDeVerificacion).
 * Vive aquí (sin `server-only`) porque tanto la Server Action como el
 * formulario cliente lo necesitan: la acción para devolverlo, el formulario
 * para reconocerlo y obligar a pedir un código nuevo.
 */
export const MENSAJE_LIMITE_VERIFICACION =
  "Escribiste muchos códigos equivocados. Pide un código nuevo para volver a intentar.";

/** Paso 2: código de 6 dígitos (las casillas se envían como codigo-1 … codigo-6). */
export const esquemaCodigo = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{6}$/, { error: MENSAJE_CODIGO_INVALIDO }));

/** Une las 6 casillas del formulario en un solo código. */
export function leerCodigo(formData: FormData) {
  return Array.from({ length: LONGITUD_CODIGO }, (_, i) => textoDe(formData, `codigo-${i + 1}`)).join("");
}
