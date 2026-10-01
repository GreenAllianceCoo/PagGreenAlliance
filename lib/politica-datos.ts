/**
 * Versión vigente de la política de tratamiento de datos (publicada en /politica-de-datos).
 * TODO(backend): `solicitudes_afiliacion` solo guarda `acepto_datos_at` (fecha), no la versión
 * aceptada. Para el auditor: guardar esta constante junto con la fecha al enviar la afiliación
 * (columna nueva, p. ej. `version_politica_datos`) cuando se autorice una migración.
 */
export const VERSION_POLITICA_DATOS = "1.0";
export const VIGENTE_DESDE_POLITICA_DATOS = "1 de octubre de 2026";
