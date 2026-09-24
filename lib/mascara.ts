/**
 * Enmascarado de correos para mostrar en pantalla sin revelar el correo completo.
 * Funciones puras (sin secretos): se pueden probar y usar en cualquier lado.
 */

const PUNTOS = "•••";

/** Deja 1 o 2 caracteres visibles de una parte del correo (usuario o dominio). */
function visible(parte: string) {
  const largo = parte.length <= 2 ? 1 : 2;
  return parte.slice(0, largo);
}

/**
 * Enmascara también el dominio (no solo el usuario): «juan.perez@policia.gov.co»
 * → «ju•••@po•••.co». F-01: los correos de los asociados son institucionales
 * (`@policia.gov.co`, `@buzonejercito.mil.co`, `@ejercito.mil.co`), muy pocos
 * dominios distintos entre sí solo por el segundo nivel (`gov` / `mil`). Si se
 * mostrara el dominio completo, o incluso solo enmascarado sin ocultar ese
 * segundo nivel, se podría distinguir un correo real de uno de relleno con
 * solo mirar el patrón. Por eso aquí se oculta también el segundo nivel y
 * solo queda visible el primer bloque del dominio (parcial) y el TLD final
 * (`.co`, `.com`): el mismo formato para reales y de relleno (ver
 * `correoDeRelleno`).
 */
export function enmascararCorreo(correo: string) {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1) return `${PUNTOS}`;
  const usuario = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);

  const partesDominio = dominio.split(".").filter(Boolean);
  if (partesDominio.length < 2) return `${visible(usuario)}${PUNTOS}@${PUNTOS}`;
  const tld = partesDominio[partesDominio.length - 1];
  const dominioEnmascarado = `${visible(partesDominio[0])}${PUNTOS}.${tld}`;

  return `${visible(usuario)}${PUNTOS}@${dominioEnmascarado}`;
}

const LETRAS = "abcdefghijklmnopqrstuvwxyz";

/**
 * Dominios reales de correo de los asociados (F-01): todos institucionales.
 * Los administradores usan gmail, pero no entran por /ingresar con cédula,
 * así que no hace falta mezclarlo aquí: mezclarlo solo le daría al relleno
 * una forma (gmail) que un asociado real nunca tendría, y sería igual de
 * delator que antes.
 */
export const DOMINIOS_ASOCIADOS = ["policia.gov.co", "buzonejercito.mil.co", "ejercito.mil.co"];

/**
 * Correo de relleno «de mentira» para una cédula que NO está registrada.
 * El login no puede revelar si la cédula existe (spec §1): el paso 2 siempre
 * debe mostrar un correo con la misma pinta que uno real. En vez de duplicar
 * la lógica de máscara, se arma un correo falso (usuario + dominio real de
 * la cooperativa) y se le aplica la MISMA función `enmascararCorreo`: así el
 * resultado es indistinguible por construcción, no solo por casualidad.
 * Todo sale de bytes pseudoaleatorios estables (HMAC de la cédula en el
 * servidor): la misma cédula siempre muestra lo mismo y no cambia entre
 * recargas, pero nadie más puede predecirlo sin el secreto.
 */
export function correoDeRelleno(bytes: Uint8Array) {
  const total = bytes.length > 0 ? bytes.length : 1;
  // Usuarios reales suelen ser "nombre.apellido": 3 a 8 letras (siempre > 2,
  // para que `visible()` muestre 2 caracteres, igual que un nombre real).
  const largoUsuario = 3 + (bytes[0] % 6);
  let usuario = "";
  for (let i = 0; i < largoUsuario; i++) {
    usuario += LETRAS[bytes[(i + 1) % total] % LETRAS.length];
  }
  const dominio = DOMINIOS_ASOCIADOS[bytes[(largoUsuario + 1) % total] % DOMINIOS_ASOCIADOS.length];
  return enmascararCorreo(`${usuario}@${dominio}`);
}
