import { z } from "zod";
import { esquemaCedula, esquemaCelular, esquemaCorreo, textoDe } from "./comunes";

/** Valores del enum public.grado_policial (mismo orden que en la base). */
export const GRADOS = ["PP", "PT", "SI", "IT", "OF"] as const;
export type CodigoGrado = (typeof GRADOS)[number];

/** Texto opcional: sin espacios sobrantes; vacío → null. */
function textoOpcional(maximo: number, mensaje: string) {
  return z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(maximo, { error: mensaje }))
    .transform((v) => (v === "" ? null : v));
}

/**
 * Formulario «Deseo afiliarme» (docs/spec-afiliacion-y-login.md §2).
 * Mismo esquema en el navegador (antes de enviar) y en la Server Action.
 * Los límites coinciden con los `check` de public.solicitudes_afiliacion.
 */
export const esquemaAfiliacion = z.object({
  nombre: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, { error: "Escribe tus nombres y apellidos." })
        .min(3, { error: "El nombre debe tener al menos 3 caracteres." })
        .max(120, { error: "El nombre puede tener máximo 120 caracteres." }),
    ),
  cedula: esquemaCedula,
  grado_id: z.enum(GRADOS, { error: "Selecciona tu grado." }),
  unidad: textoOpcional(120, "La unidad puede tener máximo 120 caracteres."),
  celular: esquemaCelular,
  email: esquemaCorreo,
  mensaje: textoOpcional(500, "El mensaje puede tener máximo 500 caracteres."),
  acepto_datos: z.literal(true, {
    error: "Debes autorizar el tratamiento de tus datos para enviar la solicitud.",
  }),
});

export type DatosAfiliacion = z.output<typeof esquemaAfiliacion>;
export type CampoAfiliacion = keyof z.input<typeof esquemaAfiliacion>;

/** Convierte el FormData del formulario en la entrada del esquema. */
export function leerFormularioAfiliacion(formData: FormData) {
  return {
    nombre: textoDe(formData, "nombre"),
    cedula: textoDe(formData, "cedula"),
    grado_id: textoDe(formData, "grado_id"),
    unidad: textoDe(formData, "unidad"),
    celular: textoDe(formData, "celular"),
    email: textoDe(formData, "email"),
    mensaje: textoDe(formData, "mensaje"),
    acepto_datos: formData.get("acepto_datos") === "on",
  };
}

export type EntradaAfiliacion = ReturnType<typeof leerFormularioAfiliacion>;
