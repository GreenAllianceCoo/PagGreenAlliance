/**
 * F-02: tope de intentos al VERIFICAR el código de /ingresar/codigo
 * (app/ingresar/actions.ts#verificarCodigoIngreso, apoyado en
 * lib/ingreso/servidor.ts#dentroDelLimiteDeVerificacion).
 *
 * Todo lo que habla con Supabase, next/headers y next/navigation se simula:
 * estas pruebas nunca hablan con una base real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted: la clase debe existir antes de que se evalúen los vi.mock (que se elevan).
const { RedireccionSimulada } = vi.hoisted(() => {
  class RedireccionSimulada extends Error {
    constructor(public ruta: string) {
      super(`REDIRECT ${ruta}`);
    }
  }
  return { RedireccionSimulada };
});

vi.mock("next/navigation", () => ({
  // En Next.js, redirect() lanza un error para cortar la ejecución.
  redirect: vi.fn((ruta: string) => {
    throw new RedireccionSimulada(ruta);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ingreso/servidor", () => ({
  leerCookieIngreso: vi.fn(),
  correoDeCedula: vi.fn(),
  dentroDelLimiteDeVerificacion: vi.fn(),
  borrarCookieIngreso: vi.fn(),
  guardarCookieIngreso: vi.fn(),
  enviarCodigo: vi.fn(),
  segundosParaReenviar: vi.fn(() => 0),
  ESPERA_REENVIO_SEGUNDOS: 45,
  MENSAJE_LIMITE_VERIFICACION: "Escribiste muchos códigos equivocados. Pide un código nuevo para volver a intentar.",
}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  correoDeCedula,
  dentroDelLimiteDeVerificacion,
  leerCookieIngreso,
  MENSAJE_LIMITE_VERIFICACION,
} from "@/lib/ingreso/servidor";
import { MENSAJE_CODIGO_INVALIDO } from "@/lib/validaciones/ingreso";
import { verificarCodigoIngreso } from "@/app/ingresar/actions";

const CEDULA = "1234567891";
const CORREO = "ju.perez@policia.gov.co";

function formularioCodigo(codigo: string) {
  const fd = new FormData();
  for (let i = 0; i < 6; i++) fd.append(`codigo-${i + 1}`, codigo[i] ?? "");
  return fd;
}

function verifyOtpFalso(respuesta: { error: { status?: number; code?: string; message?: string } | null }) {
  const verifyOtp = vi.fn().mockResolvedValue(respuesta);
  vi.mocked(createClient).mockResolvedValue({ auth: { verifyOtp } } as never);
  return verifyOtp;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(leerCookieIngreso).mockResolvedValue({ c: CEDULA, m: "ju•••@po•••.co", u: Date.now() });
  vi.mocked(correoDeCedula).mockResolvedValue(CORREO);
  vi.mocked(dentroDelLimiteDeVerificacion).mockResolvedValue(true);
});

/** Ejecuta la acción y devuelve el resultado o la ruta de redirección (éxito → /cuenta). */
async function verificar(codigo: string) {
  try {
    const resultado = await verificarCodigoIngreso({}, formularioCodigo(codigo));
    return { resultado, redirigeA: null as string | null };
  } catch (e) {
    if (e instanceof RedireccionSimulada) return { resultado: null, redirigeA: e.ruta };
    throw e;
  }
}

describe("verificarCodigoIngreso · tope de intentos (F-02)", () => {
  it("dentro del tope, intenta verificar el código contra Supabase y entra", async () => {
    const verifyOtp = verifyOtpFalso({ error: null });
    const { redirigeA } = await verificar("123456");
    expect(verifyOtp).toHaveBeenCalledWith({ email: CORREO, token: "123456", type: "email" });
    expect(redirigeA).toBe("/cuenta");
  });

  it("pasado el tope, NO llama a Supabase y devuelve el mensaje de límite", async () => {
    vi.mocked(dentroDelLimiteDeVerificacion).mockResolvedValue(false);
    const verifyOtp = verifyOtpFalso({ error: null });
    const resultado = await verificarCodigoIngreso({}, formularioCodigo("123456"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(resultado.error).toBe(MENSAJE_LIMITE_VERIFICACION);
  });

  it("revisa el límite con la cédula de la cookie", async () => {
    verifyOtpFalso({ error: null });
    await verificar("123456");
    expect(dentroDelLimiteDeVerificacion).toHaveBeenCalledWith(CEDULA);
  });

  it("el tope se revisa también para una cédula NO registrada (no delata si existe)", async () => {
    vi.mocked(correoDeCedula).mockResolvedValue(null);
    vi.mocked(dentroDelLimiteDeVerificacion).mockResolvedValue(false);
    const { resultado } = await verificar("123456");
    expect(dentroDelLimiteDeVerificacion).toHaveBeenCalledWith(CEDULA);
    expect(resultado?.error).toBe(MENSAJE_LIMITE_VERIFICACION);
  });

  it("un código con formato inválido no gasta cupo del límite", async () => {
    const { resultado } = await verificar("12");
    expect(resultado?.error).toBe(MENSAJE_CODIGO_INVALIDO);
    expect(dentroDelLimiteDeVerificacion).not.toHaveBeenCalled();
  });

  it("un código equivocado (dentro del tope) sigue devolviendo el mensaje genérico, no el de límite", async () => {
    const verifyOtp = verifyOtpFalso({ error: { status: 403, code: "otp_expired", message: "Token has expired" } });
    const resultado = await verificarCodigoIngreso({}, formularioCodigo("000000"));
    expect(verifyOtp).toHaveBeenCalled();
    expect(resultado.error).toBe(MENSAJE_CODIGO_INVALIDO);
  });
});
