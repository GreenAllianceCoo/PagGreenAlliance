// Copia de public.calcular_credito() (migración 20260923160000). La base es la
// que manda: esta copia solo sirve para la vista previa del formulario. Si
// cambias la regla, cámbiala en los dos lados; tests/unit/credito.test.ts
// compara los valores de la tabla.

export const MONTO_MINIMO = 100000;

export type CalculoCredito = {
  interesMensual: number;
  cuotaMensual: number;
  totalAPagar: number;
};

/**
 * interés mensual = round(monto × tasa)
 * total a pagar   = monto + interés mensual × plazo
 * cuota mensual   = ceil(total / plazo)
 *
 * `monto` en pesos enteros; `tasa` como fracción (0.079 = 7,9 %) con hasta 8 decimales.
 * Se trabaja con enteros para que el redondeo sea el mismo que el de Postgres.
 */
export function calcularCredito(monto: number, tasa: number, plazo: number): CalculoCredito {
  const escala = 100_000_000;
  const tasaEntera = Math.round(tasa * escala);
  const interesMensual = Math.floor((monto * tasaEntera + escala / 2) / escala);
  const totalAPagar = monto + interesMensual * plazo;
  const cuotaMensual = Math.ceil(totalAPagar / plazo);
  return { interesMensual, cuotaMensual, totalAPagar };
}

/** 0.0505 → "5,05 %" */
export function formatTasa(tasa: number) {
  return `${(tasa * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}
