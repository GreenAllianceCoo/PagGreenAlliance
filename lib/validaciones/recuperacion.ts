import { z } from "zod";
import { esquemaCedula, esquemaCelular, esquemaCorreo } from "./comunes";

/**
 * Recuperación de acceso (contrato, fase 2). Un solo juego de esquemas para
 * cliente y servidor.
 */

/** Respuesta ÚNICA de /ingresar/recuperar (anti-enumeración S-06): exista o no la cédula. */
export const MENSAJE_RECUPERACION_RECIBIDA =
  "Si los datos coinciden, la cooperativa te contactará para verificar tu identidad.";

/** Motivo de 5 a 300 caracteres (los mismos topes que la base). */
const esquemaMotivo = (mensajeVacio: string) =>
  z
    .string({ error: mensajeVacio })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(5, { error: "El motivo debe tener entre 5 y 300 caracteres." })
        .max(300, { error: "El motivo debe tener entre 5 y 300 caracteres." }),
    );

// ---------------------------------------------------------------------------
// Formulario público /ingresar/recuperar
// ---------------------------------------------------------------------------

export const CAMPOS_RECUPERACION = ["cedula", "correo", "celular", "motivo"] as const;
export type CampoRecuperacion = (typeof CAMPOS_RECUPERACION)[number];

export const esquemaRecuperacion = z.object({
  cedula: esquemaCedula,
  correo: esquemaCorreo,
  celular: esquemaCelular,
  motivo: esquemaMotivo("Cuéntanos brevemente qué pasó."),
});

// ---------------------------------------------------------------------------
// Admin: «Cambiar correo de ingreso» y «Rechazar» una solicitud
// ---------------------------------------------------------------------------

export const CAMPOS_CAMBIAR_CORREO_ADMIN = ["asociadoId", "correo", "motivo"] as const;
export type CampoCambiarCorreoAdmin = (typeof CAMPOS_CAMBIAR_CORREO_ADMIN)[number];

export const esquemaCambiarCorreoAdmin = z.object({
  asociadoId: z.uuid({ error: "Falta el asociado." }),
  correo: esquemaCorreo,
  motivo: esquemaMotivo("Escribe el motivo."),
});

export const esquemaRechazarRecuperacion = z.object({
  solicitudId: z.uuid({ error: "Falta la solicitud." }),
  motivo: esquemaMotivo("Escribe el motivo."),
});
export type CampoRechazarRecuperacion = "solicitudId" | "motivo";
