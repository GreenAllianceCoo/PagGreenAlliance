import { z } from "zod";
import { esquemaCedula, textoDe } from "./comunes";

/** «Buscar cliente por cédula» (/asesor, pieza 3l): 6 a 10 dígitos, se normaliza (puntos y espacios). */
export const esquemaBuscarCliente = z.object({ cedula: esquemaCedula });

export function leerBuscarCliente(formData: FormData) {
  return { cedula: textoDe(formData, "cedula") };
}
