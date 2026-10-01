import { describe, expect, it } from "vitest";
import { correoInstitucionalValido } from "@/lib/validaciones/dominiosInstitucionales";
import { esquemaCambiarEstadoAsociado, esquemaMarcarDesembolso, esquemaRealizarSorteo } from "@/lib/validaciones/admin";

describe("correo institucional por institución (§12.3)", () => {
  it.each([
    ["a@policia.gov.co", "policia", true],
    ["A@CORREO.Policia.gov.co", "policia", true],
    ["a@buzonejercito.mil.co", "ejercito", true],
    ["a@ejercito.mil.co", "ejercito", true],
    ["a@ejercito.mil.co", "policia", false],
    ["a@policia.gov.co", "ejercito", false],
    ["a@otro.policia.gov.co", "policia", false],
    ["a@mindefensa.gov.co", "ejercito", false],
    ["sin-arroba", "policia", false],
    ["@policia.gov.co", "policia", false],
  ] as const)("%s en %s → %s", (correo, inst, esperado) => {
    expect(correoInstitucionalValido(correo, inst)).toBe(esperado);
  });
});

describe("esquemas admin §12", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  it("desembolso: fecha opcional, no futura", () => {
    expect(esquemaMarcarDesembolso.safeParse({ id }).success).toBe(true);
    expect(esquemaMarcarDesembolso.safeParse({ id, fecha: "" }).success).toBe(true);
    expect(esquemaMarcarDesembolso.safeParse({ id, fecha: "2020-01-15" }).success).toBe(true);
    expect(esquemaMarcarDesembolso.safeParse({ id, fecha: "2999-01-01" }).success).toBe(false);
    expect(esquemaMarcarDesembolso.safeParse({ id, fecha: "basura" }).success).toBe(false);
    expect(esquemaMarcarDesembolso.safeParse({ id: "x" }).success).toBe(false);
  });
  it("baja/reactivación: motivo de 5 a 300 caracteres", () => {
    const ok = esquemaCambiarEstadoAsociado.safeParse({ asociadoId: id, activo: "false", motivo: "  Se retiró   voluntariamente " });
    expect(ok.success && ok.data.activo === false && ok.data.motivo === "Se retiró voluntariamente").toBe(true);
    expect(esquemaCambiarEstadoAsociado.safeParse({ asociadoId: id, activo: "true", motivo: "abc" }).success).toBe(false);
    expect(esquemaCambiarEstadoAsociado.safeParse({ asociadoId: id, activo: "true", motivo: "x".repeat(301) }).success).toBe(false);
    expect(esquemaCambiarEstadoAsociado.safeParse({ asociadoId: id, activo: "quizá", motivo: "motivo válido" }).success).toBe(false);
  });
  it("sorteo: mes AAAA-MM o AAAA-MM-01", () => {
    expect(esquemaRealizarSorteo.parse({ mes: "2026-10" }).mes).toBe("2026-10-01");
    expect(esquemaRealizarSorteo.parse({ mes: "2026-10-01" }).mes).toBe("2026-10-01");
    expect(esquemaRealizarSorteo.safeParse({ mes: "2026-13" }).success).toBe(false);
    expect(esquemaRealizarSorteo.safeParse({ mes: "" }).success).toBe(false);
  });
});
