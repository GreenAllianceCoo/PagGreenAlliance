/**
 * Enmascarado de correos para mostrar en pantalla sin revelar el correo completo.
 * Funciones puras (sin secretos): se pueden probar y usar en cualquier lado.
 */

const PUNTOS = "•••";

/** «juan.perez@correo.com» → «ju•••@correo.com». */
export function enmascararCorreo(correo: string) {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1) return `${PUNTOS}`;
  const usuario = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);
  const visibles = usuario.length <= 2 ? 1 : 2;
  return `${usuario.slice(0, visibles)}${PUNTOS}@${dominio}`;
}

const LETRAS = "abcdefghijklmnopqrstuvwxyz";
const DOMINIOS_COMUNES = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"];

/**
 * Correo enmascarado «de relleno» para una cédula que NO está registrada.
 * El login no puede revelar si la cédula existe (spec §1), así que el paso 2
 * muestra un correo con la misma forma. Se deriva de bytes pseudoaleatorios
 * estables (HMAC de la cédula en el servidor): la misma cédula siempre muestra
 * lo mismo y no cambia entre recargas.
 */
export function correoDeRelleno(bytes: Uint8Array) {
  const a = LETRAS[bytes[0] % LETRAS.length];
  const b = LETRAS[bytes[1] % LETRAS.length];
  const dominio = DOMINIOS_COMUNES[bytes[2] % DOMINIOS_COMUNES.length];
  return `${a}${b}${PUNTOS}@${dominio}`;
}
