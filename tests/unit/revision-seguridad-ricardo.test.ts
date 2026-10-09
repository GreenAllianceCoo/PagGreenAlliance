/**
 * Correcciones de la revisión de seguridad del 30-sep (docs/auditorias/
 * 2026-09-30-seguridad-requerimientos-ricardo.md):
 *  - RS-02: aviso genérico (sin datos) al correo institucional;
 *  - RS-03: limpieza de fotos huérfanas de la afiliación (+ ruta cron con CRON_SECRET);
 *  - RS-05: exigirAdmin exige perfiles.activo.
 * Supabase, Resend y el registro se simulan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  enviarTexto: vi.fn(async () => {}),
  clienteAdmin: vi.fn(),
  perfil: null as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ host: "localhost:3000" })) }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/correo/resend", () => ({ enviarCorreoTexto: m.enviarTexto }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: m.clienteAdmin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: m.perfil, error: null }) }) }),
    }),
  })),
}));

import { avisarCorreoInstitucional, TEXTO_AVISO_INSTITUCIONAL } from "@/lib/correo/institucional";
import { cronAutorizado, EDAD_MINIMA_HUERFANAS_MS, limpiarFotosCarneHuerfanas, limpiarFotosHuerfanas } from "@/lib/afiliacion/limpiezaFotos";
import { exigirAdmin } from "@/lib/admin/servidor";
import { GET } from "@/app/api/cron/limpiar-fotos/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("RS-02 · aviso sin datos al correo institucional", () => {
  it("manda un texto fijo con enlace al sitio, sin cédula, montos ni boleta", async () => {
    vi.stubEnv("SITIO_URL", "https://app.ejemplo.co");
    await avisarCorreoInstitucional("personal@gmail.com", "Laura@Policia.gov.co");
    expect(m.enviarTexto).toHaveBeenCalledTimes(1);
    const llamada = (m.enviarTexto.mock.calls[0] as unknown as [{ para: string[]; asunto: string; texto: string }])[0];
    expect(llamada.para).toEqual(["laura@policia.gov.co"]);
    expect(llamada.texto).toContain(TEXTO_AVISO_INSTITUCIONAL);
    expect(llamada.texto).toContain("https://app.ejemplo.co/ingresar");
    // Solo el texto fijo: nada que dependa del asociado.
    expect(llamada.texto).not.toMatch(/\d{5,}/);
    expect(TEXTO_AVISO_INSTITUCIONAL).toBe("Tienes una novedad en tu cuenta de Green Alliance; ingresa para verla");
  });

  it("no manda nada si no hay institucional o es igual al personal", async () => {
    await avisarCorreoInstitucional("a@x.co", null);
    await avisarCorreoInstitucional("a@x.co", "A@X.CO");
    expect(m.enviarTexto).not.toHaveBeenCalled();
  });

  it("si Resend falla, no lanza (no bloquea la aprobación, el crédito ni el sorteo)", async () => {
    m.enviarTexto.mockRejectedValueOnce(new Error("Resend caído"));
    await expect(avisarCorreoInstitucional("a@x.co", "b@y.co")).resolves.toBeUndefined();
  });
});

const SECRETO = "s".repeat(40);
describe("RS-03 / RS-22 · cronAutorizado", () => {
  it("sin CRON_SECRET nunca autoriza", () => {
    expect(cronAutorizado("Bearer algo", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado(null, undefined)).toBe(false);
  });
  it("RS-22: un secreto de menos de 32 caracteres nunca autoriza", () => {
    expect(cronAutorizado("Bearer secreto-corto", "secreto-corto")).toBe(false);
    expect(cronAutorizado(`Bearer ${"s".repeat(31)}`, "s".repeat(31))).toBe(false);
    expect(cronAutorizado(`Bearer ${"s".repeat(32)}`, "s".repeat(32))).toBe(true);
  });
  it("solo con el Bearer exacto", () => {
    expect(cronAutorizado(`Bearer ${SECRETO}`, SECRETO)).toBe(true);
    expect(cronAutorizado("Bearer otro", SECRETO)).toBe(false);
    expect(cronAutorizado(SECRETO, SECRETO)).toBe(false);
    expect(cronAutorizado(null, SECRETO)).toBe(false);
    expect(cronAutorizado(`Bearer ${SECRETO.slice(1)}`, SECRETO)).toBe(false);
  });
});

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

/** Cliente simulado: la RPC devuelve `nombres`; se anota cada llamada a remove. */
function almacenFalso(opciones: { nombres: { name: string }[] | null; errorRpc?: string }) {
  const borrados: string[][] = [];
  const almacen = {
    remove: vi.fn(async (rutas: string[]) => {
      borrados.push(rutas);
      return { data: null, error: null };
    }),
  };
  const admin = {
    rpc: vi.fn(async () => ({
      data: opciones.nombres,
      error: opciones.errorRpc ? { message: opciones.errorRpc } : null,
    })),
    storage: { from: vi.fn(() => almacen) },
  };
  return { admin, almacen, borrados };
}

describe("RS-03 · ruta /api/cron/limpiar-fotos", () => {
  it("responde 401 y no toca la base si falta CRON_SECRET", async () => {
    const r = await GET(new Request("http://x/api/cron/limpiar-fotos", { headers: { authorization: "Bearer cualquiera" } }));
    expect(r.status).toBe(401);
    expect(m.clienteAdmin).not.toHaveBeenCalled();
  });

  it("responde 401 y no toca la base si el secreto no coincide o no viene", async () => {
    vi.stubEnv("CRON_SECRET", SECRETO);
    expect((await GET(new Request("http://x", { headers: { authorization: "Bearer mal" } }))).status).toBe(401);
    expect((await GET(new Request("http://x"))).status).toBe(401);
    expect(m.clienteAdmin).not.toHaveBeenCalled();
  });

  it("con el secreto correcto corre la limpieza (H-09: incluye fotos-carne)", async () => {
    vi.stubEnv("CRON_SECRET", SECRETO);
    m.clienteAdmin.mockReturnValue(almacenFalso({ nombres: [] }).admin);
    const r = await GET(new Request("http://x", { headers: { authorization: `Bearer ${SECRETO}` } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true,
      revisados: 0,
      borrados: 0,
      fotosCarne: { revisados: 0, borrados: 0 },
      comprobantes: { vencidos: 0, huerfanos: 0 },
    });
  });
});

describe("H-09 · limpiarFotosCarneHuerfanas (RPC fotos_carne_huerfanas)", () => {
  it("pide 500 a la RPC y borra solo rutas <asociado>/<uuid>.<ext>", async () => {
    const buena = `${ID_A}/${ID_B}.jpg`;
    const { admin, borrados } = almacenFalso({ nombres: [{ name: buena }, { name: "otra/cosa.jpg" }, { name: `${ID_A}/../x.jpg` }] });
    const r = await limpiarFotosCarneHuerfanas(admin as never);
    expect(admin.rpc).toHaveBeenCalledWith("fotos_carne_huerfanas", { p_limite: 500 });
    expect(r).toEqual({ revisados: 1, borrados: 1 });
    expect(borrados).toEqual([[buena]]);
  });
});

describe("RS-18 · limpiarFotosHuerfanas (RPC fotos_huerfanas_afiliacion)", () => {
  it("pide 500 a la RPC y borra exactamente los nombres devueltos", async () => {
    const nombres = [`solicitudes/${ID_A}/frente.jpg`, `solicitudes/${ID_B}/selfie.jpg`];
    const { admin, borrados } = almacenFalso({ nombres: nombres.map((name) => ({ name })) });
    const r = await limpiarFotosHuerfanas(admin as never);
    expect(admin.rpc).toHaveBeenCalledWith("fotos_huerfanas_afiliacion", { p_limite: 500 });
    expect(r).toEqual({ revisados: 2, borrados: 2 });
    expect(borrados).toEqual([nombres]);
  });

  it("borra en lotes de 100", async () => {
    const nombres = Array.from({ length: 250 }, (_, i) => ({ name: `solicitudes/${ID_A}/f${i}.jpg` }));
    const { admin, borrados } = almacenFalso({ nombres });
    expect(await limpiarFotosHuerfanas(admin as never)).toEqual({ revisados: 250, borrados: 250 });
    expect(borrados.map((l) => l.length)).toEqual([100, 100, 50]);
  });

  it("ignora nombres que no son solicitudes/<uuid>/archivo (nunca borra otra cosa del bucket)", async () => {
    const { admin, almacen } = almacenFalso({
      nombres: [
        { name: "otra-carpeta/x.jpg" },
        { name: "solicitudes/no-es-uuid/x.jpg" },
        { name: `solicitudes/${ID_A}/` },
        { name: `solicitudes/${ID_A}/a/b.jpg` },
        { name: `../solicitudes/${ID_A}/x.jpg` },
      ],
    });
    expect(await limpiarFotosHuerfanas(admin as never)).toEqual({ revisados: 0, borrados: 0 });
    expect(almacen.remove).not.toHaveBeenCalled();
  });

  it("sin huérfanas (null o vacío) no borra nada", async () => {
    const { admin, almacen } = almacenFalso({ nombres: null });
    expect(await limpiarFotosHuerfanas(admin as never)).toEqual({ revisados: 0, borrados: 0 });
    expect(almacen.remove).not.toHaveBeenCalled();
  });

  it("si la RPC falla, lanza y no borra", async () => {
    const { admin, almacen } = almacenFalso({ nombres: null, errorRpc: "boom" });
    await expect(limpiarFotosHuerfanas(admin as never)).rejects.toThrow("boom");
    expect(almacen.remove).not.toHaveBeenCalled();
  });

  it("la edad mínima es de 3 horas", () => {
    expect(EDAD_MINIMA_HUERFANAS_MS).toBe(3 * 60 * 60 * 1000);
  });
});

describe("RS-05 · exigirAdmin exige perfiles.activo", () => {
  it("un admin activo pasa", async () => {
    m.perfil = { rol: "admin", nombre_completo: "Ricardo", activo: true };
    await expect(exigirAdmin()).resolves.toMatchObject({ userId: "u1", nombre: "Ricardo" });
  });
  it("un admin dado de baja (activo = false) va a /cuenta", async () => {
    m.perfil = { rol: "admin", nombre_completo: "Ricardo", activo: false };
    await expect(exigirAdmin()).rejects.toThrow("REDIRECT:/cuenta");
  });
  it("sin el dato de activo, por seguridad tampoco pasa", async () => {
    m.perfil = { rol: "admin", nombre_completo: "Ricardo" };
    await expect(exigirAdmin()).rejects.toThrow("REDIRECT:/cuenta");
  });
  it("un no admin va a /cuenta", async () => {
    m.perfil = { rol: "asociado", nombre_completo: "Laura", activo: true };
    await expect(exigirAdmin()).rejects.toThrow("REDIRECT:/cuenta");
  });
});
