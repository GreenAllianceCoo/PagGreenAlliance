/**
 * «Escribir por WhatsApp» del detalle de afiliación (piezas 3e/3i, D-08 ·
 * P-95 aprobado el 2026-09-27, docs/diseno/pedidos.md). Funciones puras: sin
 * `server-only`, sin llamadas de red — solo arman el enlace `wa.me` con el
 * número normalizado y el mensaje prellenado.
 */

/** Primer nombre de un nombre completo («Andrea Milena Suárez» → «Andrea»). */
export function primerNombre(nombreCompleto: string): string {
  const primero = nombreCompleto.trim().split(/\s+/)[0];
  return primero || nombreCompleto;
}

/**
 * Normaliza un celular a los 12 dígitos que espera `wa.me` (57 + 10 dígitos
 * que empiezan por 3). Devuelve `null` si no es un celular colombiano válido:
 * el botón debe quedar deshabilitado en ese caso (pieza 3i, estado
 * DESHABILITADO), nunca abrir un enlace roto.
 *
 * Admite espacios, guiones y un «+» delante (formatos que a veces llegan de
 * copiar/pegar), aunque el formulario de afiliación ya guarda el celular
 * limpio (`lib/validaciones/comunes.ts`, regex `/^3[0-9]{9}$/`).
 */
export function normalizarCelularColombiano(celular: string | null | undefined): string | null {
  if (!celular) return null;
  const soloDigitos = celular.replace(/\D/g, "");

  // Ya viene con el 57 delante: 12 dígitos, el 3° (primero del celular) es "3".
  if (soloDigitos.length === 12 && soloDigitos.startsWith("57") && soloDigitos[2] === "3") {
    return soloDigitos;
  }
  // Celular colombiano «pelado»: 10 dígitos que empiezan por 3.
  if (soloDigitos.length === 10 && soloDigitos.startsWith("3")) {
    return `57${soloDigitos}`;
  }
  return null;
}

/** Mensaje inicial cordial en tuteo, con el primer nombre interpolado (texto exacto de 3e/3i). */
export function mensajeWhatsappAfiliacion(nombreCompleto: string): string {
  return (
    `Hola ${primerNombre(nombreCompleto)}, soy del equipo de la cooperativa Green Alliance. ` +
    `Te escribimos por tu solicitud de afiliación, ¿tienes un momento?`
  );
}

/**
 * Enlace `https://wa.me/57<celular>?text=<mensaje>` listo para abrir en
 * pestaña nueva, o `null` si el celular no es válido (el botón debe
 * deshabilitarse con el motivo visible, en vez de abrir un enlace roto).
 */
export function enlaceWhatsappAfiliacion(
  celular: string | null | undefined,
  nombreCompleto: string,
): string | null {
  const numero = normalizarCelularColombiano(celular);
  if (!numero) return null;
  const mensaje = encodeURIComponent(mensajeWhatsappAfiliacion(nombreCompleto));
  return `https://wa.me/${numero}?text=${mensaje}`;
}
