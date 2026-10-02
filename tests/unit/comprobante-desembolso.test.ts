/**
 * Comprobante de desembolso (pedido de Sebas, 1-oct): reglas puras, esquemas zod y
 * la acción «Ver comprobante» del asociado con Supabase simulado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  usuario: { id: "asociado-1" } as { id: string } | null,
  propia: { id: "x", comprobante_subido_at: "2026-10-02T10:00:00Z" } as Record<string, unknown> | null,
  ruta: "ruta/archivo.pdf" as string | null,
  firma: "https://storage.test/firmada" as string | null,
  limite: true,
  filtros: [] as [string, unknown][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn(async () => m.limite) }));
vi.mock("@/lib/admin/comprobantes", () => ({
  rutaDeComprobante: vi.fn(async () => m.ruta),
  firmarComprobante: vi.fn(async () => m.firma),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn((c: string, v: unknown) => {
      m.filtros.push([c, v]);
      return consulta;
    });
    consulta.maybeSingle = vi.fn(async () => ({ data: m.propia, error: null }));
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user: m.usuario } })) },
      from: vi.fn(() => consulta),
    };
  }),
}));

import { urlComprobanteDesembolso } from "@/app/cuenta/comprobante/actions";
import {
  TAMANO_MAXIMO_COMPROBANTE,
  detectarTipoComprobante,
  errorDeArchivoComprobante,
  rutaComprobante,
  rutaEsDeSolicitud,
} from "@/lib/comprobantes";
import {
  esquemaPrepararComprobante,
  esquemaRegistrarComprobante,
  esquemaVerComprobante,
} from "@/lib/validaciones/comprobante";

const SOLICITUD = "11111111-2222-4333-8444-555555555555";
const OTRA = "99999999-2222-4333-8444-555555555555";
const ARCHIVO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("errorDeArchivoComprobante", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "application/pdf"])("acepta %s de 1 MB", (type) => {
    expect(errorDeArchivoComprobante({ type, size: 1024 * 1024 })).toBeNull();
  });
  it("acepta justo 5 MB", () => {
    expect(errorDeArchivoComprobante({ type: "application/pdf", size: TAMANO_MAXIMO_COMPROBANTE })).toBeNull();
  });
  it("rechaza más de 5 MB", () => {
    expect(errorDeArchivoComprobante({ type: "application/pdf", size: TAMANO_MAXIMO_COMPROBANTE + 1 })).toMatch(/5 MB/);
  });
  it("rechaza un archivo vacío", () => {
    expect(errorDeArchivoComprobante({ type: "image/png", size: 0 })).toMatch(/vacío/);
  });
  it.each(["image/gif", "text/html", "application/zip", "image/svg+xml", ""])("rechaza el tipo %j", (type) => {
    expect(errorDeArchivoComprobante({ type, size: 1000 })).toMatch(/JPG, PNG o WEBP, o un PDF/);
  });
});

describe("rutas del comprobante", () => {
  it("arma «<solicitud>/<uuid>.<ext>»", () => {
    expect(rutaComprobante(SOLICITUD, ARCHIVO, "application/pdf")).toBe(`${SOLICITUD}/${ARCHIVO}.pdf`);
    expect(rutaComprobante(SOLICITUD, ARCHIVO, "image/jpeg")).toBe(`${SOLICITUD}/${ARCHIVO}.jpg`);
  });
  it("solo acepta rutas de ESA solicitud", () => {
    expect(rutaEsDeSolicitud(`${SOLICITUD}/${ARCHIVO}.png`, SOLICITUD)).toBe(true);
    expect(rutaEsDeSolicitud(`${OTRA}/${ARCHIVO}.png`, SOLICITUD)).toBe(false);
    expect(rutaEsDeSolicitud(`${SOLICITUD}/${ARCHIVO}.exe`, SOLICITUD)).toBe(false);
    expect(rutaEsDeSolicitud(`${SOLICITUD}/../${ARCHIVO}.png`, SOLICITUD)).toBe(false);
    expect(rutaEsDeSolicitud(`${SOLICITUD}/${ARCHIVO}.png/otro`, SOLICITUD)).toBe(false);
  });
});

describe("detectarTipoComprobante (por los bytes, no por el nombre)", () => {
  const blob = (bytes: number[]) => new Blob([new Uint8Array([...bytes, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]);
  it("JPEG", async () => expect((await detectarTipoComprobante(blob([0xff, 0xd8, 0xff])))?.extension).toBe("jpg"));
  it("PNG", async () => expect((await detectarTipoComprobante(blob([0x89, 0x50, 0x4e, 0x47])))?.extension).toBe("png"));
  it("PDF", async () => expect((await detectarTipoComprobante(blob([0x25, 0x50, 0x44, 0x46, 0x2d])))?.extension).toBe("pdf"));
  it("WEBP", async () => {
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    expect((await detectarTipoComprobante(new Blob([new Uint8Array(webp)])))?.extension).toBe("webp");
  });
  it("rechaza un ejecutable o un HTML aunque se llame .pdf", async () => {
    expect(await detectarTipoComprobante(new Blob(["MZ programa"]))).toBeNull();
    expect(await detectarTipoComprobante(new Blob(["<html><script>alert(1)</script>"]))).toBeNull();
    expect(await detectarTipoComprobante(new Blob([]))).toBeNull();
  });
});

describe("esquemas del comprobante", () => {
  it("preparar: válido", () => {
    expect(esquemaPrepararComprobante.safeParse({ solicitudId: SOLICITUD, tipo: "application/pdf", tamano: 1000 }).success).toBe(true);
  });
  it.each([
    [{ solicitudId: "no-uuid", tipo: "application/pdf", tamano: 1000 }],
    [{ solicitudId: SOLICITUD, tipo: "image/gif", tamano: 1000 }],
    [{ solicitudId: SOLICITUD, tipo: "application/pdf", tamano: 0 }],
    [{ solicitudId: SOLICITUD, tipo: "application/pdf", tamano: TAMANO_MAXIMO_COMPROBANTE + 1 }],
    [{ solicitudId: SOLICITUD, tipo: "application/pdf", tamano: 1.5 }],
    [{ solicitudId: SOLICITUD, tipo: "application/pdf" }],
  ])("preparar: rechaza %j", (entrada) => {
    expect(esquemaPrepararComprobante.safeParse(entrada).success).toBe(false);
  });
  it("registrar: válido e inválido", () => {
    expect(esquemaRegistrarComprobante.safeParse({ solicitudId: SOLICITUD, ruta: `${SOLICITUD}/${ARCHIVO}.webp` }).success).toBe(true);
    expect(esquemaRegistrarComprobante.safeParse({ solicitudId: SOLICITUD, ruta: "../etc/passwd" }).success).toBe(false);
    expect(esquemaRegistrarComprobante.safeParse({ solicitudId: SOLICITUD, ruta: `${SOLICITUD}/${ARCHIVO}.svg` }).success).toBe(false);
    expect(esquemaRegistrarComprobante.safeParse({ solicitudId: "x", ruta: `${SOLICITUD}/${ARCHIVO}.png` }).success).toBe(false);
  });
  it("ver: pide un uuid", () => {
    expect(esquemaVerComprobante.safeParse({ solicitudId: SOLICITUD }).success).toBe(true);
    expect(esquemaVerComprobante.safeParse({ solicitudId: "123" }).success).toBe(false);
  });
});

describe("urlComprobanteDesembolso (asociado, solo lectura de lo suyo)", () => {
  beforeEach(() => {
    m.usuario = { id: "asociado-1" };
    m.propia = { id: SOLICITUD, comprobante_subido_at: "2026-10-02T10:00:00Z" };
    m.ruta = `${SOLICITUD}/${ARCHIVO}.pdf`;
    m.firma = "https://storage.test/firmada";
    m.limite = true;
    m.filtros = [];
  });

  it("devuelve la URL firmada si la solicitud es suya y tiene comprobante", async () => {
    expect(await urlComprobanteDesembolso(SOLICITUD)).toEqual({ url: "https://storage.test/firmada" });
    // Filtra por la solicitud Y por el asociado en sesión (no confía solo en RLS).
    expect(m.filtros).toContainEqual(["asociado_id", "asociado-1"]);
    expect(m.filtros).toContainEqual(["id", SOLICITUD]);
  });
  it("no revela nada si la solicitud no es suya (misma respuesta que si no existe)", async () => {
    m.propia = null;
    expect(await urlComprobanteDesembolso(SOLICITUD)).toEqual({ error: "No encontramos el comprobante." });
  });
  it("no firma si todavía no hay comprobante", async () => {
    m.propia = { id: SOLICITUD, comprobante_subido_at: null };
    expect(await urlComprobanteDesembolso(SOLICITUD)).toEqual({ error: "No encontramos el comprobante." });
  });
  it("rechaza un id que no es uuid sin consultar nada", async () => {
    expect(await urlComprobanteDesembolso("../otro")).toEqual({ error: "No encontramos el comprobante." });
    expect(m.filtros).toEqual([]);
  });
  it("sin sesión no entrega URL", async () => {
    m.usuario = null;
    expect((await urlComprobanteDesembolso(SOLICITUD)).url).toBeUndefined();
  });
  it("respeta el límite de consultas", async () => {
    m.limite = false;
    expect((await urlComprobanteDesembolso(SOLICITUD)).url).toBeUndefined();
  });
  it("si no se pudo firmar, error genérico", async () => {
    m.firma = null;
    expect(await urlComprobanteDesembolso(SOLICITUD)).toEqual({ error: "No pudimos abrir el comprobante. Intenta de nuevo." });
  });
});
