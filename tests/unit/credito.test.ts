/**
 * Cálculo del crédito (lib/credito.ts), copia de public.calcular_credito().
 * Los valores esperados salen de la base local (supabase/tests/03_trigger_monto_solicitud.sql
 * comprueba los mismos casos del lado de Postgres).
 */
import { describe, expect, it } from "vitest";
import { calcularCredito, formatTasa } from "@/lib/credito";

// Tasas de la migración 20260923160000: round(cuota_mensual / capacidad_maxima, 8).
const TASAS = {
  PP: { "50": 0.079, "100": 0.06 },
  PT: { "50": 0.05076923, "100": 0.03740741 },
  SI: { "50": 0.082, "100": 0.082 },
  IT: { "50": 0.0505, "100": 0.0505 },
  OF: { "50": 0.05395349, "100": 0.06333333 },
} as const;

describe("calcularCredito · tope completo de cada rango", () => {
  // [grado, porcentaje, tope, interés de la tabla, cuota, total]
  it.each([
    ["PP", "50", 1000000, 79000, 412334, 1237000],
    ["PP", "100", 2100000, 126000, 826000, 2478000],
    ["PT", "50", 1300000, 66000, 499334, 1498000],
    ["PT", "100", 2700000, 101000, 1001000, 3003000],
    ["SI", "50", 1500000, 123000, 623000, 1869000],
    ["SI", "100", 3000000, 246000, 1246000, 3738000],
    ["IT", "50", 2000000, 101000, 767667, 2303000],
    ["IT", "100", 4000000, 202000, 1535334, 4606000],
    ["OF", "50", 2150000, 116000, 832667, 2498000],
    ["OF", "100", 4200000, 266000, 1666000, 4998000],
  ] as const)("%s %s%% (%i) → interés %i, cuota %i, total %i", (grado, porcentaje, tope, interes, cuota, total) => {
    expect(calcularCredito(tope, TASAS[grado][porcentaje], 3)).toEqual({
      interesMensual: interes,
      cuotaMensual: cuota,
      totalAPagar: total,
    });
  });
});

describe("calcularCredito · montos parciales (proporcional al monto)", () => {
  it.each([
    [500000, 0.079, 39500, 206167, 618500],
    [1350000, 0.03740741, 50500, 500500, 1501500],
    [1000000, 0.06333333, 63333, 396667, 1189999],
    [100000, 0.05395349, 5395, 38729, 116185],
    [750000, 0.05076923, 38077, 288077, 864231],
  ])("monto %i a tasa %d → interés %i, cuota %i, total %i", (monto, tasa, interes, cuota, total) => {
    expect(calcularCredito(monto, tasa, 3)).toEqual({
      interesMensual: interes,
      cuotaMensual: cuota,
      totalAPagar: total,
    });
  });

  it("tres cuotas cubren el total", () => {
    const { cuotaMensual, totalAPagar } = calcularCredito(1000000, 0.079, 3);
    expect(cuotaMensual * 3).toBeGreaterThanOrEqual(totalAPagar);
    expect(cuotaMensual * 3 - totalAPagar).toBeLessThan(3);
  });
});

describe("formatTasa", () => {
  it.each([
    [0.079, "7,9 %"],
    [0.0505, "5,05 %"],
    [0.03740741, "3,74 %"],
  ])("%d → %s", (tasa, texto) => {
    expect(formatTasa(tasa)).toBe(texto);
  });
});
