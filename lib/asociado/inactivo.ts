/**
 * Cuenta dada de baja (spec-requerimientos-ricardo §12.6). Constantes puras,
 * sin servidor: las usan la pantalla de ingreso y las Server Actions.
 */

/** Texto exacto de la spec y de la base (triggers de crédito, alertas y boletas). */
export const MENSAJE_CUENTA_INACTIVA = "Tu cuenta está inactiva. Comunícate con la cooperativa.";

/** Ruta que cierra la sesión del usuario inactivo y lo lleva a /ingresar con el aviso. */
export const RUTA_CUENTA_INACTIVA = "/api/cuenta-inactiva";

/** Parámetro de /ingresar que muestra el aviso: `/ingresar?cuenta=inactiva`. */
export const PARAMETRO_CUENTA_INACTIVA = "inactiva";
