import { z } from "zod";
import { esquemaCedula, textoDe } from "./comunes";

/** Paso 1 de /ingresar: la cédula. */
export const esquemaIngresoCedula = z.object({ cedula: esquemaCedula });

export const MENSAJE_NIT_VACIO = "Escribe el NIT de tu empresa.";
export const MENSAJE_NIT_FORMATO = "Revisa el NIT: solo números, con o sin puntos y guion (p. ej. 902.038.118-7).";

/**
 * NIT de la empresa en convenio (docs/spec-convenios.md, decisión 1). Acepta
 * «902038118», «902.038.118-7» y «9020381187». Con guion, el dígito de
 * verificación se descarta y queda la base; sin guion se mandan los dígitos
 * tal cual y correo_por_nit() decide si el último es el DV (solo si coincide).
 */
export function normalizarNit(valor: string) {
  const limpio = valor.trim();
  if (!/^[0-9. -]*$/.test(limpio)) return "";
  const base = limpio.includes("-") ? limpio.split("-")[0] : limpio;
  return base.replace(/[^0-9]/g, "");
}

export const esquemaNit = z
  .string({ error: MENSAJE_NIT_VACIO })
  .refine((v) => v.trim() !== "", { error: MENSAJE_NIT_VACIO })
  .refine((v) => /^[0-9. -]{6,20}$/.test(v.trim()), { error: MENSAJE_NIT_FORMATO })
  .transform(normalizarNit)
  .pipe(z.string().regex(/^[0-9]{6,11}$/, { error: MENSAJE_NIT_FORMATO }));

/** Paso 1 de /ingresar/convenio: el NIT. */
export const esquemaIngresoNit = z.object({ nit: esquemaNit });

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
