/**
 * Convenios B4: el admin oculta / vuelve a mostrar publicaciones
 * (docs/spec-convenios.md §B4). Esquemas, filtros, texto del historial y
 * Server Actions con Supabase simulado (nunca toca una base real).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/servidor", () => ({ exigirAdmin: vi.fn() }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { exigirAdmin } from "@/lib/admin/servidor";
import { revalidatePath } from "next/cache";
import { mostrarPublicacion, ocultarPublicacion } from "@/app/admin/convenios/publicaciones/actions";
import { filtrarPublicaciones } from "@/lib/admin/publicacionesConvenio";
import { describirEventoEquipo } from "@/lib/admin/historialEquipoTexto";
import {
  esquemaFiltrosPublicaciones,
  esquemaOcultarPublicacion,
  MENSAJE_MOTIVO_LARGO,
} from "@/lib/validaciones/publicacionesConvenio";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

type Llamada = { metodo: string; args: unknown[] };

/** Cadena .from().update().eq().is()/.not().select().maybeSingle() que registra las llamadas. */
function supabaseFalso(resultado: { data: unknown; error: unknown }) {
  const llamadas: Llamada[] = [];
  const cadena: Record<string, unknown> = {};
  for (const metodo of ["from", "update", "eq", "is", "not", "select"]) {
    cadena[metodo] = (...args: unknown[]) => {
      llamadas.push({ metodo, args });
      return cadena;
    };
  }
  cadena.maybeSingle = async () => resultado;
  return { supabase: cadena, llamadas };
}

describe("filtros de publicaciones", () => {
  it("acepta filtros válidos y descarta los inválidos sin fallar", () => {
    expect(esquemaFiltrosPublicaciones.parse({ convenio: UUID, tipo: "catalogo", estado: "oculta" })).toEqual({
      convenio: UUID,
      tipo: "catalogo",
      estado: "oculta",
    });
    expect(esquemaFiltrosPublicaciones.parse({ convenio: "x", tipo: "otro", estado: "" })).toEqual({
      convenio: undefined,
      tipo: undefined,
      estado: undefined,
    });
    expect(esquemaFiltrosPublicaciones.parse({})).toEqual({ convenio: undefined, tipo: undefined, estado: undefined });
  });

  it("filtra por convenio, tipo y estado a la vez", () => {
    const lista = [
      { id: "a", convenioId: UUID, tipo: "promocion" as const, estado: "publicada" as const },
      { id: "b", convenioId: UUID, tipo: "catalogo" as const, estado: "oculta" as const },
      { id: "c", convenioId: UUID2, tipo: "promocion" as const, estado: "oculta" as const },
    ];
    expect(filtrarPublicaciones(lista, {}).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(filtrarPublicaciones(lista, { convenio: UUID }).map((p) => p.id)).toEqual(["a", "b"]);
    expect(filtrarPublicaciones(lista, { estado: "oculta" }).map((p) => p.id)).toEqual(["b", "c"]);
    expect(filtrarPublicaciones(lista, { convenio: UUID2, tipo: "promocion", estado: "oculta" }).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("esquemaOcultarPublicacion", () => {
  it("motivo opcional: vacío o espacios = null; recorta", () => {
    expect(esquemaOcultarPublicacion.parse({ id: UUID, motivo: "   " })).toEqual({ id: UUID, motivo: null });
    expect(esquemaOcultarPublicacion.parse({ id: UUID, motivo: "  Imagen engañosa " })).toEqual({ id: UUID, motivo: "Imagen engañosa" });
  });
  it("rechaza motivos de más de 200 caracteres", () => {
    const r = esquemaOcultarPublicacion.safeParse({ id: UUID, motivo: "a".repeat(201) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(MENSAJE_MOTIVO_LARGO);
    expect(esquemaOcultarPublicacion.safeParse({ id: UUID, motivo: "a".repeat(200) }).success).toBe(true);
  });
});

describe("historial del equipo: publicaciones", () => {
  it("describe ocultar y volver a mostrar", () => {
    expect(describirEventoEquipo({ tipo: "publicacion", objetivo: "Óptica Sol", detalle: "ocultada", extra: "2x1 en monturas" })).toBe(
      "Ocultó «2x1 en monturas» de Óptica Sol",
    );
    expect(describirEventoEquipo({ tipo: "publicacion", objetivo: "Óptica Sol", detalle: "mostrada", extra: "2x1 en monturas" })).toBe(
      "Volvió a mostrar «2x1 en monturas» de Óptica Sol",
    );
  });
});

describe("ocultarPublicacion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("oculta solo si no estaba oculta, con el motivo recortado, y refresca Beneficios y el panel", async () => {
    const { supabase, llamadas } = supabaseFalso({ data: { titulo: "2x1" }, error: null });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase, userId: "admin", nombre: "Admin" } as never);
    const r = await ocultarPublicacion({}, form({ id: UUID, motivo: "  No corresponde  " }));
    expect(r.mensaje).toBe("«2x1» quedó oculta.");
    expect(r.listo).toBeTypeOf("number");
    const update = llamadas.find((l) => l.metodo === "update")?.args[0] as Record<string, unknown>;
    expect(update.oculta_motivo).toBe("No corresponde");
    expect(typeof update.oculta_en).toBe("string");
    expect(llamadas).toContainEqual({ metodo: "is", args: ["oculta_en", null] });
    expect(llamadas).toContainEqual({ metodo: "eq", args: ["id", UUID] });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(["/admin/convenios/publicaciones", "/convenio", `/convenio/${UUID}`, "/cuenta/beneficios"]),
    );
  });

  it("sin motivo manda null", async () => {
    const { supabase, llamadas } = supabaseFalso({ data: { titulo: "2x1" }, error: null });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase, userId: "admin", nombre: "Admin" } as never);
    await ocultarPublicacion({}, form({ id: UUID }));
    expect((llamadas.find((l) => l.metodo === "update")?.args[0] as Record<string, unknown>).oculta_motivo).toBeNull();
  });

  it("motivo largo o id inválido: error sin tocar la base", async () => {
    const { supabase, llamadas } = supabaseFalso({ data: null, error: null });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase, userId: "admin", nombre: "Admin" } as never);
    expect(await ocultarPublicacion({}, form({ id: UUID, motivo: "x".repeat(201) }))).toEqual({ error: MENSAJE_MOTIVO_LARGO });
    expect(await ocultarPublicacion({}, form({ id: "nope" }))).toEqual({ error: "Datos inválidos." });
    expect(llamadas).toHaveLength(0);
  });

  it("ya oculta o inexistente: avisa; error de base: mensaje genérico", async () => {
    let falso = supabaseFalso({ data: null, error: null });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase: falso.supabase, userId: "admin", nombre: "Admin" } as never);
    expect((await ocultarPublicacion({}, form({ id: UUID }))).error).toMatch(/ya estaba oculta/);
    falso = supabaseFalso({ data: null, error: { code: "42501", message: "rls" } });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase: falso.supabase, userId: "admin", nombre: "Admin" } as never);
    expect(await ocultarPublicacion({}, form({ id: UUID }))).toEqual({ error: "No pudimos ocultarla. Intenta de nuevo." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("mostrarPublicacion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("vuelve a mostrar solo si estaba oculta y limpia el motivo", async () => {
    const { supabase, llamadas } = supabaseFalso({ data: { titulo: "Catálogo" }, error: null });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase, userId: "admin", nombre: "Admin" } as never);
    const r = await mostrarPublicacion({}, form({ id: UUID }));
    expect(r.mensaje).toBe("«Catálogo» se volvió a mostrar.");
    expect(llamadas.find((l) => l.metodo === "update")?.args[0]).toEqual({ oculta_en: null, oculta_motivo: null });
    expect(llamadas).toContainEqual({ metodo: "not", args: ["oculta_en", "is", null] });
    expect(revalidatePath).toHaveBeenCalledWith("/cuenta/beneficios");
  });

  it("id inválido o ya visible: error", async () => {
    const { supabase } = supabaseFalso({ data: null, error: null });
    vi.mocked(exigirAdmin).mockResolvedValue({ supabase, userId: "admin", nombre: "Admin" } as never);
    expect(await mostrarPublicacion({}, form({ id: "x" }))).toEqual({ error: "Datos inválidos." });
    expect((await mostrarPublicacion({}, form({ id: UUID }))).error).toMatch(/ya se estaba mostrando/);
  });
});
