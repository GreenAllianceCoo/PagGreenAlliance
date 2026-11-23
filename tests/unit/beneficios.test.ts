/**
 * Convenios B5: Beneficios para el asociado (docs/spec-convenios.md §B5).
 * Ciudad desde las sedes, «Nuevo», filtros y registro de eventos con Supabase
 * simulado (nunca toca una base real).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { registrarEventoBeneficio } from "@/app/cuenta/beneficios/actions";
import {
  ciudadDeSede,
  ciudadesDeConvenio,
  esNueva,
  esquemaFiltrosBeneficios,
  filtrarBeneficios,
  opcionesDeFiltros,
  TODO_EL_PAIS,
} from "@/lib/beneficios/beneficios";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("ciudad desde las sedes", () => {
  it("toma el último tramo y salta el departamento", () => {
    expect(ciudadDeSede("Calle 140 # 11-45, Torre HHC, consultorio 313, Bogotá")).toBe("Bogotá");
    expect(ciudadDeSede("Villa de Leyva, Boyacá")).toBe("Villa de Leyva");
    expect(ciudadDeSede("Cra 27 # 36-14, Bucaramanga, Santander")).toBe("Bucaramanga");
    expect(ciudadDeSede("Av. 68 # 1-2, Bogotá D.C.")).toBe("Bogotá");
    expect(ciudadDeSede("Medellín")).toBe("Medellín");
  });
  it("sin una ciudad legible devuelve null", () => {
    expect(ciudadDeSede("Calle 10 # 5-20")).toBeNull();
    expect(ciudadDeSede("  ")).toBeNull();
  });
  it("convenio sin sedes o sin ciudad legible = «Todo el país»; sin repetir", () => {
    expect(ciudadesDeConvenio([])).toEqual([TODO_EL_PAIS]);
    expect(ciudadesDeConvenio(["Calle 1 # 2-3"])).toEqual([TODO_EL_PAIS]);
    expect(ciudadesDeConvenio(["Calle 1, Bogotá", "Calle 2, Bogotá D.C.", "Villa de Leyva, Boyacá"])).toEqual(["Bogotá", "Villa de Leyva"]);
  });
});

describe("«Nuevo»", () => {
  const ahora = new Date("2026-11-21T15:00:00Z");
  it("solo los últimos 7 días", () => {
    expect(esNueva("2026-11-15T15:00:01Z", ahora)).toBe(true);
    expect(esNueva("2026-11-14T15:00:00Z", ahora)).toBe(false);
    expect(esNueva("no es fecha", ahora)).toBe(false);
  });
});

describe("filtros", () => {
  const lista = [
    { id: "1", convenioId: A, convenioNombre: "Óptica", especialidad: "Salud visual", ciudades: ["Bogotá"] },
    { id: "2", convenioId: B, convenioNombre: "Agencia", especialidad: "Viajes", ciudades: [TODO_EL_PAIS] },
    { id: "3", convenioId: A, convenioNombre: "Óptica", especialidad: "Salud visual", ciudades: ["Bogotá", "Tunja"] },
  ];
  it("esquema: ignora valores inválidos", () => {
    expect(esquemaFiltrosBeneficios.parse({ aliado: "x", categoria: " Viajes ", ciudad: "" })).toEqual({
      aliado: undefined,
      categoria: "Viajes",
      ciudad: undefined,
    });
  });
  it("aliado, categoría y ciudad (Todo el país entra en cualquier ciudad)", () => {
    expect(filtrarBeneficios(lista, { aliado: A }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(filtrarBeneficios(lista, { categoria: "Viajes" }).map((p) => p.id)).toEqual(["2"]);
    expect(filtrarBeneficios(lista, { ciudad: "Tunja" }).map((p) => p.id)).toEqual(["2", "3"]);
    expect(filtrarBeneficios(lista, {}).map((p) => p.id)).toEqual(["1", "2", "3"]);
  });
  it("opciones sin repetir y sin «Todo el país» en ciudades", () => {
    expect(opcionesDeFiltros(lista)).toEqual({
      aliados: [
        { id: B, nombre: "Agencia" },
        { id: A, nombre: "Óptica" },
      ],
      categorias: ["Salud visual", "Viajes"],
      ciudades: ["Bogotá", "Tunja"],
    });
  });
});

describe("registrarEventoBeneficio", () => {
  const rpc = vi.fn();
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "u" } } }) },
      rpc,
    } as never);
  });

  it("llama a la RPC con la publicación y el tipo", async () => {
    await registrarEventoBeneficio(A, "whatsapp");
    expect(rpc).toHaveBeenCalledWith("registrar_evento_publicacion", { p_publicacion: A, p_tipo: "whatsapp" });
  });
  it("datos inválidos: no llama", async () => {
    await registrarEventoBeneficio("x", "vista");
    await registrarEventoBeneficio(A, "otro" as "vista");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("si la RPC falla no lanza", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "no disponible" } });
    await expect(registrarEventoBeneficio(A, "vista")).resolves.toBeUndefined();
  });
});
