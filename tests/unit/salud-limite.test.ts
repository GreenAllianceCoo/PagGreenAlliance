/**
 * Revisión diaria del límite de intentos (lib/servidor/saludLimite.ts): en
 * lugar de una alerta de Vercel, el cron detecta las dos fallas silenciosas
 * del límite y manda UN correo al día (8 a. m. de Bogotá) mientras sigan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/correo/resend", () => ({ enviarCorreoTexto: vi.fn(async () => undefined) }));

import { enviarCorreoTexto } from "@/lib/correo/resend";
import { destinatariosAlertaTecnica, esHoraDelAviso, revisarLimite, vigilarLimite } from "@/lib/servidor/saludLimite";

const OCHO_AM_BOGOTA = new Date("2026-10-10T13:05:00Z");
const MEDIODIA_BOGOTA = new Date("2026-10-10T17:05:00Z");

function baseFalsa(error: { message: string } | null = null) {
  return { rpc: vi.fn(async () => ({ data: true, error })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("LIMITE_HMAC_SECRET", "x".repeat(32));
});

describe("revisarLimite", () => {
  it("sin problemas: secreto presente y la base cuenta (clave fija, sin datos personales)", async () => {
    const base = baseFalsa();
    expect(await revisarLimite(base as never)).toEqual([]);
    expect(base.rpc).toHaveBeenCalledWith("registrar_intento", { p_clave: "salud:cron", p_maximo: 1_000_000, p_ventana_segundos: 60 });
  });

  it("detecta el secreto faltante o corto", async () => {
    vi.stubEnv("LIMITE_HMAC_SECRET", "corto");
    const problemas = await revisarLimite(baseFalsa() as never);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/LIMITE_HMAC_SECRET/);
  });

  it("detecta que la base no cuenta intentos", async () => {
    const problemas = await revisarLimite(baseFalsa({ message: "connection refused" }) as never);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/no está contando/);
  });
});

describe("vigilarLimite", () => {
  it("si todo está bien no manda correo", async () => {
    expect(await vigilarLimite(baseFalsa() as never, OCHO_AM_BOGOTA)).toBe("ok");
    expect(enviarCorreoTexto).not.toHaveBeenCalled();
  });

  it("con falla, avisa solo a las 8 a. m. de Bogotá (un correo al día)", async () => {
    const base = baseFalsa({ message: "boom" });
    expect(await vigilarLimite(base as never, MEDIODIA_BOGOTA)).toBe("fallo");
    expect(enviarCorreoTexto).not.toHaveBeenCalled();
    expect(await vigilarLimite(base as never, OCHO_AM_BOGOTA)).toBe("fallo");
    expect(enviarCorreoTexto).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enviarCorreoTexto).mock.calls[0][0].para).toEqual(["soporte@greenallianceco.com"]);
  });

  it("si el correo falla, no lanza", async () => {
    vi.mocked(enviarCorreoTexto).mockRejectedValueOnce(new Error("resend caído"));
    await expect(vigilarLimite(baseFalsa({ message: "boom" }) as never, OCHO_AM_BOGOTA)).resolves.toBe("fallo");
  });
});

describe("destinatarios y hora", () => {
  it("usa ALERTA_TECNICA_CORREOS (sin repetidos ni inválidos) o soporte si falta", () => {
    expect(destinatariosAlertaTecnica("A@x.co, b@y.co, a@x.co, malo")).toEqual(["a@x.co", "b@y.co"]);
    expect(destinatariosAlertaTecnica("")).toEqual(["soporte@greenallianceco.com"]);
    expect(destinatariosAlertaTecnica(undefined)).toEqual(["soporte@greenallianceco.com"]);
  });

  it("la hora del aviso es 13:00 UTC (8 a. m. en Bogotá)", () => {
    expect(esHoraDelAviso(OCHO_AM_BOGOTA)).toBe(true);
    expect(esHoraDelAviso(MEDIODIA_BOGOTA)).toBe(false);
  });
});
