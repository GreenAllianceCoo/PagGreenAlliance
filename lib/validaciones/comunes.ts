import { z } from "zod";

/**
 * Reglas y normalización compartidas por cliente y servidor.
 * La normalización se hace dentro del esquema (transform/preprocess), así que
 * el servidor siempre guarda el valor limpio aunque el cliente no valide.
 */

/** Quita espacios, puntos y guiones: «1.234.567 890» → «1234567890». */
export function normalizarCedula(valor: string) {
  return valor.replace(/[\s.\-]/g, "");
}

/**
 * Quita espacios, puntos, guiones y paréntesis, y el indicativo de Colombia
 * si viene: «+57 300 123 4567» → «3001234567».
 */
export function normalizarCelular(valor: string) {
  const digitos = valor.replace(/[\s.\-()]/g, "");
  if (digitos.startsWith("+57")) return digitos.slice(3);
  if (digitos.length === 12 && digitos.startsWith("57")) return digitos.slice(2);
  return digitos;
}

/** Correo sin espacios y en minúsculas. */
export function normalizarCorreo(valor: string) {
  return valor.trim().toLowerCase();
}

/** Lee un campo de texto de un FormData ("" si no viene o no es texto). */
export function textoDe(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

export const MENSAJES = {
  cedulaVacia: "Escribe tu número de cédula.",
  cedulaFormato: "La cédula debe tener solo números, entre 6 y 10 dígitos.",
  celularVacio: "Escribe tu número de celular.",
  celularFormato: "El celular debe tener 10 dígitos y empezar por 3.",
  correoVacio: "Escribe tu correo electrónico.",
  correoFormato: "Revisa el correo: debe ser como nombre@correo.com.",
} as const;

/** Cédula colombiana: solo números, 6 a 10 dígitos (se normaliza antes). */
export const esquemaCedula = z
  .string({ error: MENSAJES.cedulaVacia })
  .transform(normalizarCedula)
  .pipe(
    z
      .string()
      .min(1, { error: MENSAJES.cedulaVacia })
      .regex(/^[0-9]{6,10}$/, { error: MENSAJES.cedulaFormato }),
  );

/** Celular colombiano: 10 dígitos que empiezan por 3 (se normaliza antes). */
export const esquemaCelular = z
  .string({ error: MENSAJES.celularVacio })
  .transform(normalizarCelular)
  .pipe(
    z
      .string()
      .min(1, { error: MENSAJES.celularVacio })
      .regex(/^3[0-9]{9}$/, { error: MENSAJES.celularFormato }),
  );

/** Correo en minúsculas con formato válido. */
export const esquemaCorreo = z
  .string({ error: MENSAJES.correoVacio })
  .transform(normalizarCorreo)
  .pipe(
    z
      .string()
      .min(1, { error: MENSAJES.correoVacio })
      .max(254, { error: MENSAJES.correoFormato })
      .pipe(z.email({ error: MENSAJES.correoFormato })),
  );

/** Primer mensaje de error de cada campo (para mostrar bajo cada control). */
export function erroresPorCampo<T extends string>(error: z.ZodError): Partial<Record<T, string>> {
  const errores: Partial<Record<T, string>> = {};
  for (const issue of error.issues) {
    const campo = issue.path[0];
    if (typeof campo === "string" && !(campo in errores)) {
      errores[campo as T] = issue.message;
    }
  }
  return errores;
}
