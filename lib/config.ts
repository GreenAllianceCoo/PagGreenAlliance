/**
 * Datos de configuración de la cooperativa que aún no están confirmados.
 * Reemplazar los valores entre corchetes cuando la cooperativa los confirme.
 */

// Número de WhatsApp de la cooperativa (sin +57). NEXT_PUBLIC_WHATSAPP lo reemplaza si existe.
const WHATSAPP_DIGITOS = (process.env.NEXT_PUBLIC_WHATSAPP || "3117241942").replace(/\D/g, "");

/** Número para mostrar: «311 724 1942». */
export const WHATSAPP_NUMERO = WHATSAPP_DIGITOS.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");

/**
 * Enlace https://wa.me/57<NÚMERO> (mapa de botones §2–§4). Si la variable no
 * existe o no es un número de 10 dígitos, `null`: se muestra el texto sin enlace.
 */
export function enlaceWhatsapp(numero: string | undefined) {
  const digitos = (numero ?? "").replace(/\D/g, "");
  return /^[0-9]{10}$/.test(digitos) ? `https://wa.me/57${digitos}` : null;
}

export const WHATSAPP_URL = enlaceWhatsapp(WHATSAPP_DIGITOS);

/** Número de la cooperativa (318 389 4034) que se usa SOLO si no hay ninguno configurado arriba. */
const WHATSAPP_RESPALDO = "3183894034";

/** §13.1: mensaje corto prellenado del pie de página. */
export const MENSAJE_WHATSAPP_PIE = "Hola, quiero información sobre Green Alliance";

/** Enlace wa.me con el mensaje prellenado (null si el número no es válido). */
export function enlaceWhatsappConMensaje(numero: string | undefined, mensaje: string) {
  const base = enlaceWhatsapp(numero);
  return base ? `${base}?text=${encodeURIComponent(mensaje)}` : null;
}

/** Enlace del pie: el número configurado o, si falta, el de la cooperativa (573183894034). */
export const WHATSAPP_URL_PIE = enlaceWhatsappConMensaje(WHATSAPP_DIGITOS || WHATSAPP_RESPALDO, MENSAJE_WHATSAPP_PIE);

// Tiempo de respuesta a una solicitud de afiliación (confirmado por la cooperativa).
export const TIEMPO_RESPUESTA = "poco tiempo";

// Correo de contacto público.
export const CORREO_CONTACTO = "soporte@greenallianceco.com";

// Texto legal de vigilancia (confirmado por la cooperativa el 25-sep).
export const TEXTO_VIGILANCIA = "Vigilada por Supersolidaria";
