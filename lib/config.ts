/**
 * Datos de configuración de la cooperativa que aún no están confirmados.
 * Reemplazar los valores entre corchetes cuando la cooperativa los confirme.
 */

// TODO(pendiente-spec): número de WhatsApp. Se lee de NEXT_PUBLIC_WHATSAPP (sin +57).
export const WHATSAPP_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP || "[NÚMERO]";

/**
 * Enlace https://wa.me/57<NÚMERO> (mapa de botones §2–§4). Si la variable no
 * existe o no es un número de 10 dígitos, `null`: se muestra el texto sin enlace.
 */
export function enlaceWhatsapp(numero = process.env.NEXT_PUBLIC_WHATSAPP) {
  const digitos = (numero ?? "").replace(/\D/g, "");
  return /^[0-9]{10}$/.test(digitos) ? `https://wa.me/57${digitos}` : null;
}

export const WHATSAPP_URL = enlaceWhatsapp();

// TODO(pendiente-spec): días hábiles de respuesta a una solicitud de afiliación.
export const DIAS_RESPUESTA = "[N]";

// TODO(pendiente-spec): correo de contacto público.
export const CORREO_CONTACTO = "[correo]@greenallianceco.com";

// TODO(pendiente-spec): texto legal de vigilancia.
export const TEXTO_VIGILANCIA = "[Vigilada por Supersolidaria — confirmar]";
