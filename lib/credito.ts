// Reglas del crédito que la app necesita conocer. La base las vuelve a
// validar (trigger chk_monto_solicitud, migración 20260923173355).

export const MONTO_MINIMO = 100000;

/** Tasa de interés mensual guardada como fracción: 0.0505 → "5,05 %" */
export function formatTasa(tasa: number) {
  return `${(Number(tasa) * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}
