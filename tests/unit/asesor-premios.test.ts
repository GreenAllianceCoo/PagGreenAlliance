import { describe, expect, it } from "vitest";
import { ganadoresPorMeta, indexarPremiosAdmin, metaDeClic, vistaPremios } from "@/lib/asesor/premios";

const filas = (a: string, b: string, n = 12, gano?: string) => [
  { clientes_acumulados: n, meta: 50, estado: a, ganado_at: gano ?? null },
  { clientes_acumulados: n, meta: 100, estado: b, ganado_at: null },
];

describe("vistaPremios", () => {
  it("sin filas devuelve null", () => {
    expect(vistaPremios(null)).toBeNull();
    expect(vistaPremios([])).toBeNull();
  });
  it("calcula avance y estado disponible", () => {
    const v = vistaPremios(filas("disponible", "disponible", 12))!;
    expect(v.clientesAcumulados).toBe(12);
    expect(v.premios[0]).toMatchObject({ meta: 50, porcentaje: 24, faltan: 38, etiqueta: "Disponible", ganadoTexto: null });
    expect(v.premios[1]).toMatchObject({ meta: 100, porcentaje: 12, faltan: 88 });
  });
  it("«ya fue ganado» no revela quién", () => {
    const v = vistaPremios(filas("ya_ganado", "disponible", 60))!;
    expect(v.premios[0].etiqueta).toBe("Ya fue ganado");
    expect(v.premios[0].porcentaje).toBe(100);
    expect(v.premios[0].faltan).toBe(0);
    expect(v.premios[0].ganadoTexto).toBeNull();
  });
  it("«¡Lo ganaste!» con fecha", () => {
    const v = vistaPremios(filas("ganado_por_mi", "disponible", 50, "2026-10-03T15:00:00Z"))!;
    expect(v.premios[0].etiqueta).toBe("¡Lo ganaste!");
    expect(v.premios[0].ganadoTexto).toContain("octubre");
  });
  it("estado desconocido cae a disponible y metas raras se descartan", () => {
    const v = vistaPremios([
      { clientes_acumulados: "5", meta: "50", estado: "raro", ganado_at: null },
      { clientes_acumulados: "5", meta: "7", estado: "disponible", ganado_at: null },
    ])!;
    expect(v.premios).toHaveLength(1);
    expect(v.premios[0].estado).toBe("disponible");
    expect(vistaPremios([{ clientes_acumulados: 1, meta: 7, estado: "disponible", ganado_at: null }])).toBeNull();
  });
});

describe("metaDeClic", () => {
  it("solo acepta 50 o 100", () => {
    expect(metaDeClic(50)).toBe(50);
    expect(metaDeClic("100")).toBe(100);
    expect(metaDeClic(7)).toBeNull();
    expect(metaDeClic(undefined)).toBeNull();
    expect(metaDeClic("x")).toBeNull();
  });
});

describe("premios del admin", () => {
  const mapa = indexarPremiosAdmin([
    { asesor_id: "a", clientes_acumulados: "50", clics: "3", ultimo_clic: "2026-10-01T10:00:00Z", gano_50_at: "2026-10-01T09:00:00Z", gano_100_at: null },
    { asesor_id: "b", clientes_acumulados: 10, clics: 0, ultimo_clic: null, gano_50_at: null, gano_100_at: null },
  ]);
  it("indexa por asesor", () => {
    expect(mapa.get("a")).toMatchObject({ asociados: 50, clics: 3, gano100: null });
    expect(mapa.get("b")).toMatchObject({ clics: 0, ultimoClic: null });
    expect(indexarPremiosAdmin(null).size).toBe(0);
  });
  it("dice quién ganó cada meta", () => {
    expect(ganadoresPorMeta({ a: "Ana", b: "Beto" }, mapa)).toEqual({ 50: "Ana", 100: null });
  });
});
