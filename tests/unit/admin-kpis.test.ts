/**
 * `lib/admin/kpis.ts`: el rango del mes calendario en hora de Colombia
 * (sin depender de la zona horaria del servidor donde corran las pruebas)
 * y el cálculo de los 4 KPI del panel de créditos, con Supabase simulado
 * (nunca habla con una base real).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cargarKpisAdmin, rangoMesColombia } from "@/lib/admin/kpis";

describe("rangoMesColombia", () => {
  it("con una fecha a media mañana en Bogotá, da el 1.º del mes 00:00 (05:00 UTC) hasta el 1.º del mes siguiente", () => {
    // 2026-09-27T15:00:00Z = 2026-09-27T10:00:00 en Bogotá (UTC-5).
    const { inicio, fin } = rangoMesColombia(new Date("2026-09-27T15:00:00Z"));
    expect(inicio).toBe("2026-09-01T05:00:00.000Z");
    expect(fin).toBe("2026-10-01T05:00:00.000Z");
  });

  it("una hora UTC que todavía es el mes anterior en Bogotá no adelanta el mes", () => {
    // 2026-10-01T02:00:00Z (UTC) es 2026-09-30T21:00:00 en Bogotá: sigue
    // siendo septiembre para alguien que mira el reloj en Bogotá.
    const { inicio, fin } = rangoMesColombia(new Date("2026-10-01T02:00:00Z"));
    expect(inicio).toBe("2026-09-01T05:00:00.000Z");
    expect(fin).toBe("2026-10-01T05:00:00.000Z");
  });

  it("diciembre pasa correctamente al 1.º de enero del año siguiente", () => {
    const { inicio, fin } = rangoMesColombia(new Date("2026-12-15T15:00:00Z"));
    expect(inicio).toBe("2026-12-01T05:00:00.000Z");
    expect(fin).toBe("2027-01-01T05:00:00.000Z");
  });
});

/**
 * Cliente de Supabase simulado: cada llamada a `.from()` consume la
 * siguiente respuesta de la lista, en el mismo orden en que
 * `cargarKpisAdmin` hace sus 4 consultas (creditosPendientes,
 * afiliacionesPendientes, aprobadosEsteMes, montoAprobado). Los métodos de
 * filtro (`select`/`eq`/`gte`/`lt`) son thenable: se pueden encadenar como
 * el builder real y el `await` final resuelve con la respuesta simulada.
 */
function crearSupabaseFalso(respuestas: Array<{ count?: number | null; data?: unknown[] | null; error?: unknown }>) {
  let indice = 0;
  const from = vi.fn(() => {
    const resultado = respuestas[indice++];
    const encadenable: Record<string, unknown> = {};
    encadenable.select = vi.fn(() => encadenable);
    encadenable.eq = vi.fn(() => encadenable);
    encadenable.gte = vi.fn(() => encadenable);
    encadenable.lt = vi.fn(() => encadenable);
    encadenable.then = (resolve: (valor: unknown) => void) => resolve(resultado);
    return encadenable;
  });
  return { from };
}

describe("cargarKpisAdmin", () => {
  it("junta los 3 conteos y suma los montos de las filas aprobadas este mes", async () => {
    const supabase = crearSupabaseFalso([
      { count: 3, error: null }, // creditosPendientes
      { count: 5, error: null }, // afiliacionesPendientes
      { count: 2, error: null }, // aprobadosEsteMes
      { data: [{ monto_solicitado: 500000 }, { monto_solicitado: "1000000" }], error: null }, // montoAprobado
    ]);
    const kpis = await cargarKpisAdmin(supabase as never);
    expect(kpis).toEqual({
      creditosPendientes: 3,
      afiliacionesPendientes: 5,
      aprobadosEsteMes: 2,
      montoAprobadoEsteMes: 1500000,
    });
  });

  it("un conteo o una suma sin filas (o con error) no rompe: quedan en 0, no en undefined", async () => {
    const supabase = crearSupabaseFalso([
      { count: null, error: { message: "algo falló" } },
      { count: null, error: null },
      { count: null, error: null },
      { data: null, error: null },
    ]);
    const kpis = await cargarKpisAdmin(supabase as never);
    expect(kpis).toEqual({
      creditosPendientes: 0,
      afiliacionesPendientes: 0,
      aprobadosEsteMes: 0,
      montoAprobadoEsteMes: 0,
    });
  });
});
