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

import { headers } from "next/headers";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { claveHmac, dentroDelLimite, ipDelCliente } from "@/lib/servidor/limite";

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

/**
 * O-01: `ipDelCliente` solo es confiable detrás de un proxy que sobrescriba
 * estos encabezados (Vercel lo hace); en local, o detrás de un proxy que no
 * los limpie, cualquiera puede mandarlos con el valor que quiera.
 */
describe("ipDelCliente (O-01: solo confiable detrás de Vercel)", () => {
  function headersFalsos(valores: Record<string, string>) {
    vi.mocked(headers).mockResolvedValue({
      get: (nombre: string) => valores[nombre] ?? null,
    } as never);
  }

  it("usa el primer valor de x-forwarded-for cuando hay varios (proxys encadenados)", async () => {
    headersFalsos({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    await expect(ipDelCliente()).resolves.toBe("203.0.113.5");
  });

  it("recorta espacios alrededor del valor", async () => {
    headersFalsos({ "x-forwarded-for": "  198.51.100.7  , 10.0.0.1" });
    await expect(ipDelCliente()).resolves.toBe("198.51.100.7");
  });

  it("sin x-forwarded-for usa x-real-ip", async () => {
    headersFalsos({ "x-real-ip": "198.51.100.9" });
    await expect(ipDelCliente()).resolves.toBe("198.51.100.9");
  });

  it("sin ningún encabezado devuelve «desconocida» (no null ni vacío)", async () => {
    headersFalsos({});
    await expect(ipDelCliente()).resolves.toBe("desconocida");
  });

  it("x-forwarded-for vacío cae a x-real-ip", async () => {
    headersFalsos({ "x-forwarded-for": "", "x-real-ip": "198.51.100.11" });
    await expect(ipDelCliente()).resolves.toBe("198.51.100.11");
  });
});
