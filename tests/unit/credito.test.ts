/**
 * Formato de la tasa de interés mensual (lib/credito.ts). Las tasas por
 * grado y porcentaje las prueba supabase/tests/03_trigger_monto_solicitud.sql.
 */
import { describe, expect, it } from "vitest";
import { formatTasa } from "@/lib/credito";

describe("formatTasa", () => {
  it.each([
    [0.079, "7,9 %"],
    [0.06, "6 %"],
    [0.0505, "5,05 %"],
    [0.03740741, "3,74 %"],
    [0.05395349, "5,4 %"],
  ])("%d → %s", (tasa, texto) => {
    expect(formatTasa(tasa)).toBe(texto);
  });

  it("acepta la tasa como texto (Postgres puede devolver numeric como string)", () => {
    expect(formatTasa("0.06333333" as unknown as number)).toBe("6,33 %");
  });
});
