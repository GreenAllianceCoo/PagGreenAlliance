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

// Tiempo de respuesta a una solicitud de afiliación (confirmado por la cooperativa).
export const TIEMPO_RESPUESTA = "4 horas o menos";

// Correo de contacto público.
export const CORREO_CONTACTO = "soporte@greenallianceco.com";

// Texto legal de vigilancia (confirmado por la cooperativa el 25-sep).
export const TEXTO_VIGILANCIA = "Vigilada por Supersolidaria";
