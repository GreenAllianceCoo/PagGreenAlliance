import { z } from "zod";
import { esquemaCedula, textoDe } from "./comunes";

/** «Buscar cliente por cédula» (/asesor, pieza 3l): 6 a 10 dígitos, se normaliza (puntos y espacios). */
export const esquemaBuscarCliente = z.object({ cedula: esquemaCedula });

export function leerBuscarCliente(formData: FormData) {
  return { cedula: textoDe(formData, "cedula") };
}

/** Mínimos de la búsqueda general (los mismos que exige la base en buscar_asociados_general). */
export const MIN_CARACTERES_BUSQUEDA = 4;
export const MAX_CARACTERES_BUSQUEDA = 60;
export const MENSAJE_BUSQUEDA_CORTA = "Escribe al menos 4 letras del nombre o 4 números de la cédula.";

/**
 * Normaliza lo escrito en la búsqueda general: sin espacios de más; si son
 * solo números (con puntos o espacios), se dejan los dígitos de la cédula.
 */
export function normalizarTextoBusqueda(valor: string) {
  const texto = valor.trim().replace(/\s+/g, " ");
  const sinSeparadores = texto.replace(/[\s.\-]/g, "");
  return /^[0-9]+$/.test(sinSeparadores) ? sinSeparadores : texto;
}

/** «Buscar asociado» (búsqueda general del asesor): nombre o cédula, 4 a 60 caracteres (cédula: 4 a 10 dígitos). */
export const esquemaBuscarGeneral = z.object({
  texto: z
    .string({ error: MENSAJE_BUSQUEDA_CORTA })
    .transform(normalizarTextoBusqueda)
    .pipe(
      z
        .string()
        .min(MIN_CARACTERES_BUSQUEDA, { error: MENSAJE_BUSQUEDA_CORTA })
        .max(MAX_CARACTERES_BUSQUEDA, { error: "Escribe menos de 60 caracteres." })
        .refine((v) => !/^[0-9]+$/.test(v) || v.length <= 10, { error: "La cédula tiene máximo 10 números." }),
    ),
});

export function leerBuscarGeneral(formData: FormData) {
  return { texto: textoDe(formData, "texto") };
}
