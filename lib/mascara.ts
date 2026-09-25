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
 * Enmascara el correo dejando solo 1 o 2 letras del usuario y ocultando el
 * dominio COMPLETO: «juan.perez@gmail.com» → «ju•••@•••».
 * F-01: desde el 25-sep la afiliación acepta correos de cualquier dominio
 * (gmail, hotmail, institucional…). Si se viera cualquier parte del dominio,
 * p. ej. «gm•••.com», se distinguiría de un correo de relleno y delataría que
 * la cédula existe. Sin dominio, un correo real y uno de relleno tienen
 * exactamente la misma forma (ver `correoDeRelleno`).
 */
export function enmascararCorreo(correo: string) {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1) return `${PUNTOS}`;
  return `${visible(limpio.slice(0, arroba))}${PUNTOS}@${PUNTOS}`;
}

const LETRAS = "abcdefghijklmnopqrstuvwxyz";

/**
 * Correo de relleno «de mentira» para una cédula que NO está registrada.
 * El login no puede revelar si la cédula existe (spec §1): el paso 2 siempre
 * debe mostrar un correo con la misma pinta que uno real. En vez de duplicar
 * la lógica de máscara, se arma un correo falso (el dominio no importa: la
 * máscara lo oculta entero) y se le aplica la MISMA función `enmascararCorreo`: así el
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
  return enmascararCorreo(`${usuario}@relleno.invalid`);
}
