/**
 * Vista previa del sorteo en `/cuenta?sorteo=demo`: abre el modal con datos
 * SIMULADOS (correo enmascarado falso, código fijo "123456") para ver la
 * animación de celebración sin llamar a la base ni a Resend. Pedido de Sebas
 * (2026-09-24) para poder revisarla hoy, sin esperar al día 1 del mes.
 *
 * SOLO en desarrollo: en producción el parámetro se ignora siempre, pase lo
 * que pase en la URL. Función pura para poder probarla sin un servidor real.
 */
export function activarVistaPreviaSorteo(
  parametroSorteo: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  if (nodeEnv === "production") return false;
  return parametroSorteo === "demo";
}
