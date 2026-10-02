/**
 * Limpieza de comprobantes de desembolso (decisión de Sebas, 2-oct): vencidos (30 días
 * tras eliminar al asociado) y huérfanos (más de 24 h sin ligar). Supabase simulado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));

import { limpiarComprobantes } from "@/lib/admin/limpiezaComprobantes";

const SOL = "28100000-0000-4000-a000-00000000000a";
const RUTA = `${SOL}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf`;
const RUTA_HUERFANA = `${SOL}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png`;

function falso(opciones: { vencidos?: unknown; huerfanos?: unknown; errorBorrado?: boolean }) {
  const borrados: string[][] = [];
  const rpc = vi.fn(async (nombre: string) => {
    if (nombre === "comprobantes_vencidos") return { data: opciones.vencidos ?? [], error: null };
    if (nombre === "comprobantes_huerfanos") return { data: opciones.huerfanos ?? [], error: null };
    return { data: 1, error: null };
  });
  const remove = vi.fn(async (rutas: string[]) => {
    borrados.push(rutas);
    return { data: null, error: opciones.errorBorrado ? { message: "boom" } : null };
  });
  const from = vi.fn(() => ({ remove }));
  return { admin: { rpc, storage: { from } }, rpc, remove, from, borrados };
}

beforeEach(() => vi.clearAllMocks());

describe("limpiarComprobantes", () => {
  it("borra los vencidos de Storage y luego libera la referencia", async () => {
    const f = falso({ vencidos: [{ solicitud_id: SOL, ruta: RUTA }] });
    const r = await limpiarComprobantes(f.admin as never);
    expect(f.from).toHaveBeenCalledWith("comprobantes-desembolso");
    expect(f.borrados).toEqual([[RUTA]]);
    expect(f.rpc).toHaveBeenCalledWith("liberar_comprobantes", { p_solicitud_ids: [SOL] });
    expect(r).toEqual({ vencidos: 1, huerfanos: 0 });
  });

  it("si falla el borrado de Storage NO limpia la referencia (se reintenta la próxima vez)", async () => {
    const f = falso({ vencidos: [{ solicitud_id: SOL, ruta: RUTA }], errorBorrado: true });
    const r = await limpiarComprobantes(f.admin as never);
    expect(f.rpc).not.toHaveBeenCalledWith("liberar_comprobantes", expect.anything());
    expect(r.vencidos).toBe(0);
  });

  it("borra los huérfanos (más de 24 h sin ligar) que devuelve la base", async () => {
    const f = falso({ huerfanos: [{ name: RUTA_HUERFANA }] });
    const r = await limpiarComprobantes(f.admin as never);
    expect(f.borrados).toEqual([[RUTA_HUERFANA]]);
    expect(r).toEqual({ vencidos: 0, huerfanos: 1 });
  });

  it("ignora rutas que no son «<solicitud>/<uuid>.<ext>» (nunca borra otra cosa)", async () => {
    const f = falso({
      vencidos: [{ solicitud_id: SOL, ruta: "../otro/x.pdf" }],
      huerfanos: [{ name: "carpeta/archivo.pdf" }, { name: `${SOL}/a/b.pdf` }],
    });
    const r = await limpiarComprobantes(f.admin as never);
    expect(f.remove).not.toHaveBeenCalled();
    expect(r).toEqual({ vencidos: 0, huerfanos: 0 });
  });

  it("si la base falla al listar, lanza y no borra", async () => {
    const f = falso({});
    f.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);
    await expect(limpiarComprobantes(f.admin as never)).rejects.toThrow("boom");
    expect(f.remove).not.toHaveBeenCalled();
  });
});
