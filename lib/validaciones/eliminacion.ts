import { z } from "zod";

/**
 * «Eliminar definitivamente» (admin). Un solo juego de esquemas para cliente y
 * servidor. El motivo usa los mismos topes que la base (5 a 300).
 */

const motivo = z
  .string({ error: "Escribe el motivo." })
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(5, { error: "El motivo debe tener entre 5 y 300 caracteres." })
      .max(300, { error: "El motivo debe tener entre 5 y 300 caracteres." }),
  );

export const CAMPOS_PEDIR_ELIMINACION = ["motivo", "entiendo"] as const;
export type CampoPedirEliminacion = (typeof CAMPOS_PEDIR_ELIMINACION)[number];

/** Paso 1: motivo + casilla «entiendo que no se puede deshacer». */
export const esquemaPedirEliminacion = z.object({
  asociadoId: z.uuid({ error: "Falta el asociado." }),
  motivo,
  entiendo: z.literal("on", { error: "Marca la casilla para continuar." }),
});

/** Paso 2: el código de 6 números que llegó al correo del admin. */
export const esquemaCodigoEliminacion = z
  .string({ error: "Escribe el código de 6 números." })
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[0-9]{6}$/, { error: "El código tiene 6 números." }));

export const esquemaConfirmarEliminacion = z.object({
  asociadoId: z.uuid({ error: "Falta el asociado." }),
  solicitudId: z.uuid({ error: "Pide un código nuevo." }),
  codigo: esquemaCodigoEliminacion,
});

/** Reintento de la limpieza (Storage / Auth) de una eliminación ya ejecutada: no pide el código otra vez. */
export const esquemaReintentoEliminacion = z.object({
  asociadoId: z.uuid({ error: "Falta el asociado." }),
  solicitudId: z.uuid({ error: "Pide un código nuevo." }),
});
