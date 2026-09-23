/**
 * Límite de intentos (lib/servidor/limite.ts) con clave HMAC-SHA256
 * (hallazgo M-2 de docs/auditorias/2026-09-23-limite-de-intentos.md).
 * Supabase, next/headers y el registro se simulan: no se habla con ninguna base.
 */
import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));

import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { claveHmac, dentroDelLimite } from "@/lib/servidor/limite";

const SECRETO = "s".repeat(32);
const CEDULA = "1234567891";

function rpcFalsa(respuesta: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(respuesta);
  vi.mocked(crearClienteAdmin).mockReturnValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LIMITE_HMAC_SECRET", SECRETO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claveHmac", () => {
  it("no contiene la cédula ni el SHA-256 simple que se usaba antes", () => {
    const clave = claveHmac("otp-cedula", CEDULA, SECRETO);
    const shaViejo = createHash("sha256").update(`otp-cedula:${CEDULA}`).digest("hex").slice(0, 40);
    expect(clave).not.toContain(CEDULA);
    expect(clave).not.toContain(shaViejo);
    expect(clave).toBe(
      `otp-cedula:${createHmac("sha256", SECRETO).update(`otp-cedula:${CEDULA}`).digest("hex").slice(0, 40)}`,
    );
  });

  it("cambia con el secreto y con el tipo", () => {
    expect(claveHmac("otp-cedula", CEDULA, SECRETO)).not.toBe(claveHmac("otp-cedula", CEDULA, "t".repeat(32)));
    expect(claveHmac("otp-cedula", CEDULA, SECRETO).split(":")[1]).not.toBe(
      claveHmac("afiliacion-cedula", CEDULA, SECRETO).split(":")[1],
    );
  });

  it("cabe en el límite de 200 caracteres de registrar_intento", () => {
    expect(claveHmac("afiliacion-cedula", CEDULA, SECRETO).length).toBeLessThanOrEqual(200);
  });
});

describe("dentroDelLimite", () => {
  it("manda a la base la clave HMAC y devuelve lo que responde", async () => {
    const rpc = rpcFalsa({ data: false, error: null });
    await expect(dentroDelLimite("otp-cedula", CEDULA, 5, 900)).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith("registrar_intento", {
      p_clave: claveHmac("otp-cedula", CEDULA, SECRETO),
      p_maximo: 5,
      p_ventana_segundos: 900,
    });
  });

  it.each([undefined, "", "corto"])("sin secreto válido (%j) bloquea, registra el error y no llama a la base", async (valor) => {
    vi.stubEnv("LIMITE_HMAC_SECRET", valor as string);
    const rpc = rpcFalsa({ data: true, error: null });
    await expect(dentroDelLimite("afiliacion-ip", "1.2.3.4", 5, 3600)).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(registrar).toHaveBeenCalledWith("error", expect.objectContaining({ evento: "limite_secreto_faltante" }));
  });

  it("si la base falla deja pasar y registra limite_de_intentos_fallo (M-1)", async () => {
    rpcFalsa({ data: null, error: { message: "PGRST202" } });
    await expect(dentroDelLimite("otp-ip", "1.2.3.4", 20, 900)).resolves.toBe(true);
    expect(registrar).toHaveBeenCalledWith("error", expect.objectContaining({ evento: "limite_de_intentos_fallo" }));
  });
});
