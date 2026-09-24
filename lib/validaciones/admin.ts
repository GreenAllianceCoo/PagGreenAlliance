import { z } from "zod";
import { esquemaCedula, esquemaCorreo, textoDe } from "./comunes";

/**
 * Esquemas del panel /admin. Mismo patrón que el resto del proyecto: un solo
 * esquema por acción, usado en la Server Action (no hay formularios de admin
 * en un cliente separado que necesite repetir la validación, pero se deja
 * aquí para que cualquier componente cliente lo reutilice si hace falta).
 */

// ---------------------------------------------------------------------------
// Afiliaciones
// ---------------------------------------------------------------------------

/** Estados a los que el admin puede mover una solicitud (sin «pendiente»: es el inicial). */
export const ESTADOS_AFILIACION_ADMIN = ["contactado", "rechazada"] as const;

export const esquemaCambiarEstadoAfiliacion = z.object({
  id: z.uuid({ error: "Falta el id de la solicitud." }),
  estado: z.enum(ESTADOS_AFILIACION_ADMIN, { error: "Elige un estado válido." }),
});

export const esquemaAprobarAfiliacion = z.object({
  id: z.uuid({ error: "Falta el id de la solicitud." }),
});

// ---------------------------------------------------------------------------
// Solicitudes de crédito
// ---------------------------------------------------------------------------

const esquemaMotivoRechazo = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, { error: "Escribe el motivo del rechazo (mínimo 3 caracteres)." })
      .max(500, { error: "El motivo puede tener máximo 500 caracteres." }),
  );

/** «Aprobar» / «Rechazar» de /admin/creditos (P-06: el motivo es obligatorio al rechazar). */
export const esquemaResolverCredito = z.discriminatedUnion("decision", [
  z.object({ id: z.uuid(), decision: z.literal("aprobado") }),
  z.object({ id: z.uuid(), decision: z.literal("rechazado"), motivo: esquemaMotivoRechazo }),
]);

// ---------------------------------------------------------------------------
// Asesores
// ---------------------------------------------------------------------------

const esquemaNombrePropio = (mensajeVacio: string) =>
  z
    .string({ error: mensajeVacio })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, { error: mensajeVacio })
        .min(2, { error: "Debe tener al menos 2 caracteres." })
        .max(60, { error: "Puede tener máximo 60 caracteres." })
        .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/, { error: "Solo letras y espacios." }),
    );

/** «Registrar asesor» de /admin/asesores. */
export const esquemaCrearAsesor = z.object({
  cedula: esquemaCedula,
  nombres: esquemaNombrePropio("Escribe los nombres."),
  apellidos: esquemaNombrePropio("Escribe los apellidos."),
  correo: esquemaCorreo,
});
export type CampoCrearAsesor = keyof z.input<typeof esquemaCrearAsesor>;

export function leerFormularioAsesor(formData: FormData) {
  return {
    cedula: textoDe(formData, "cedula"),
    nombres: textoDe(formData, "nombres"),
    apellidos: textoDe(formData, "apellidos"),
    correo: textoDe(formData, "correo"),
  };
}
