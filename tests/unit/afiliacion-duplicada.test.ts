/**
 * S-06 (revisión de seguridad 2026-09-24): `enviarAfiliacion` (app/afiliacion/actions.ts)
 * ante una cédula con otra solicitud pendiente (23505 del índice único parcial
 * de la base) responde EXACTAMENTE igual que un envío exitoso: mismo flash,
 * mismo redirect, sin mensaje distinto y sin guardar una fila duplicada.
 * Todo lo que habla con Supabase, cookies y el registro se simula.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock(...) se "hoistea" al inicio del archivo: las variables que usan sus
// factories deben crearse con vi.hoisted(), si no, TDZ ("Cannot access antes
// de su inicialización") al intentar leerlas desde dentro de la factory.
const {
  redirectMock,
  registrarMock,
  guardarFlashMock,
  subirFotosMock,
  borrarFotosMock,
  dentroDelLimiteMock,
  ipDelClienteMock,
  insertSingleMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
  registrarMock: vi.fn(),
  guardarFlashMock: vi.fn().mockResolvedValue(undefined),
  subirFotosMock: vi.fn(),
  borrarFotosMock: vi.fn().mockResolvedValue(undefined),
  dentroDelLimiteMock: vi.fn().mockResolvedValue(true),
  ipDelClienteMock: vi.fn().mockResolvedValue("1.2.3.4"),
  insertSingleMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: registrarMock }));
vi.mock("@/lib/afiliacion/flash", () => ({ guardarFlashAfiliacion: guardarFlashMock }));
vi.mock("@/lib/afiliacion/fotos", () => ({
  subirFotosAfiliacion: subirFotosMock,
  borrarFotosAfiliacion: borrarFotosMock,
}));
vi.mock("@/lib/servidor/limite", () => ({
  dentroDelLimite: dentroDelLimiteMock,
  ipDelCliente: ipDelClienteMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  crearClienteAdmin: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: insertSingleMock,
        }),
      }),
    }),
  }),
}));

const CEDULA = "1234567890";
const CORREO = "laura.gomez@policia.gov.co";

// Datos ya "validados" (esquemaAfiliacion.safeParse real, con fotos falsas: no
// hace falta simular archivos de verdad porque subirFotosAfiliacion está mockeado).
vi.mock("@/lib/validaciones/afiliacion", () => ({
  esquemaAfiliacion: {
    safeParse: () => ({
      success: true,
      data: {
        nombres: "Laura",
        apellidos: "Gómez",
        cedula: CEDULA,
        grado_id: "PP",
        institucion: "policia",
        nequi: "3001234567",
        celular: "3001234567",
        email: CORREO,
        asesor_id: null,
        foto_cedula_frente: {},
        foto_cedula_reverso: {},
        foto_selfie: {},
        mensaje: null,
      },
    }),
  },
  leerFormularioAfiliacion: () => ({ email: CORREO }),
  valoresDeTextoAfiliacion: () => ({ cedula: CEDULA, email: CORREO }),
}));

import { enviarAfiliacion } from "@/app/afiliacion/actions";

function formularioValido() {
  const fd = new FormData();
  fd.append("sitio_web", ""); // honeypot vacío
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  subirFotosMock.mockResolvedValue({
    columnas: { foto_cedula_frente: "x/f.jpg", foto_cedula_reverso: "x/r.jpg", foto_selfie: "x/s.jpg" },
    rutas: ["x/f.jpg", "x/r.jpg", "x/s.jpg"],
  });
});

describe("enviarAfiliacion · cédula con solicitud pendiente (S-06)", () => {
  it("responde IGUAL que un envío exitoso: mismo flash y mismo redirect", async () => {
    insertSingleMock.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    await expect(enviarAfiliacion({}, formularioValido())).rejects.toThrow("REDIRECT:/afiliacion/enviada");

    expect(guardarFlashMock).toHaveBeenCalledWith(CORREO);
    expect(redirectMock).toHaveBeenCalledWith("/afiliacion/enviada");
  });

  it("borra las fotos ya subidas en vez de dejarlas huérfanas", async () => {
    insertSingleMock.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    await expect(enviarAfiliacion({}, formularioValido())).rejects.toThrow("REDIRECT:");

    expect(borrarFotosMock).toHaveBeenCalledWith(expect.anything(), ["x/f.jpg", "x/r.jpg", "x/s.jpg"]);
  });

  it("registra el evento afiliacion_duplicada SIN cédula, nombre ni correo", async () => {
    insertSingleMock.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    await expect(enviarAfiliacion({}, formularioValido())).rejects.toThrow("REDIRECT:");

    const llamada = registrarMock.mock.calls.find(([, datos]) => datos?.evento === "afiliacion_duplicada");
    expect(llamada).toBeTruthy();
    const textoRegistrado = JSON.stringify(llamada);
    expect(textoRegistrado).not.toContain(CEDULA);
    expect(textoRegistrado).not.toContain(CORREO);
    expect(textoRegistrado).not.toContain("Laura");
  });

  it("NO devuelve un error de campo (no hay un `errores.cedula` distinto para este caso)", async () => {
    insertSingleMock.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const resultado = await enviarAfiliacion({}, formularioValido()).catch((e: Error) => e);

    // El único efecto observable es el redirect (lanzado como excepción);
    // nunca se llega a un `return { errores: ... }` para este caso.
    expect(resultado).toBeInstanceOf(Error);
    expect((resultado as Error).message).toBe("REDIRECT:/afiliacion/enviada");
  });
});

describe("enviarAfiliacion · envío exitoso (sin duplicado)", () => {
  it("también redirige a /afiliacion/enviada y guarda el flash, sin marcar afiliacion_duplicada", async () => {
    insertSingleMock.mockResolvedValue({ data: { id: "nueva-id" }, error: null });

    await expect(enviarAfiliacion({}, formularioValido())).rejects.toThrow("REDIRECT:/afiliacion/enviada");

    expect(guardarFlashMock).toHaveBeenCalledWith(CORREO);
    expect(registrarMock.mock.calls.some(([, datos]) => datos?.evento === "afiliacion_duplicada")).toBe(false);
  });
});
