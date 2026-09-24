/**
 * Server Actions del sorteo mensual (app/cuenta/actions-sorteo.ts):
 * - sin sesión, se rechazan (no llaman a la base ni al correo).
 * - `participarSorteo` nunca devuelve el número al navegador.
 * - `confirmarBoletaSorteo` valida el formato, informa intentos restantes
 *   cuando el número no coincide, y devuelve el número solo al confirmar.
 *
 * Todo lo que habla con Supabase y Resend se simula (igual que
 * tests/unit/ingreso-codigo.test.ts): estas pruebas nunca tocan una base real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/correo/sorteo", () => ({ enviarBoletaSorteo: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarBoletaSorteo } from "@/lib/correo/sorteo";
import { confirmarBoletaSorteo, participarSorteo } from "@/app/cuenta/actions-sorteo";

const USUARIO = { id: "asociado-1", email: "ju.perez@policia.gov.co" };

/** Cliente normal (con sesión) falso: getUser + from().select().eq()... */
function clienteFalso(opts: {
  user: typeof USUARIO | null;
  nombrePerfil?: string;
  filaBoleta?: { intentos?: number; numero?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.nombrePerfil ? { nombre_completo: opts.nombrePerfil } : null,
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.filaBoleta ?? null, error: null });
  const from = vi.fn((tabla: string) => ({
    select: () =>
      tabla === "perfiles"
        ? { eq: () => ({ single }) }
        : { eq: () => ({ eq: () => ({ maybeSingle }) }) },
  }));
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }) }, from };
}

function adminFalso(rpc: ReturnType<typeof vi.fn>) {
  return { rpc };
}

function formularioNumero(numero: string) {
  const fd = new FormData();
  for (let i = 0; i < 6; i++) fd.append(`numero-${i + 1}`, numero[i] ?? "");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("participarSorteo · exige sesión", () => {
  it("sin sesión, no llama a la base ni al correo", async () => {
    vi.mocked(createClient).mockResolvedValue(clienteFalso({ user: null }) as never);
    const rpc = vi.fn();
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await participarSorteo();

    expect(resultado.ok).toBeUndefined();
    expect(resultado.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    expect(enviarBoletaSorteo).not.toHaveBeenCalled();
  });
});

describe("participarSorteo · con sesión", () => {
  it("crea la boleta, envía el correo y responde SOLO con el correo enmascarado (nunca el número)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, nombrePerfil: "Juan Pérez" }) as never,
    );
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "b1", numero: "123456", anio: 2026, mes: 10, fecha_envio: "2026-10-03T00:00:00Z" }],
      error: null,
    });
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await participarSorteo();

    expect(rpc).toHaveBeenCalledWith("participar_sorteo", { p_asociado_id: USUARIO.id });
    expect(enviarBoletaSorteo).toHaveBeenCalledWith(
      expect.objectContaining({ correo: USUARIO.email, nombre: "Juan Pérez", numero: "123456" }),
    );
    expect(resultado.ok).toBe(true);
    expect(resultado.correoEnmascarado).toBe("ju•••@po•••.co");
    // Nunca el número crudo en la respuesta al navegador.
    expect(JSON.stringify(resultado)).not.toContain("123456");
  });

  it("si la base rechaza (p. ej. ventana cerrada), no envía correo y devuelve el mensaje", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, nombrePerfil: "Juan Pérez" }) as never,
    );
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "La inscripción al sorteo solo está abierta del 1 al 5 de cada mes" },
    });
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await participarSorteo();

    expect(enviarBoletaSorteo).not.toHaveBeenCalled();
    expect(resultado.ok).toBeUndefined();
    expect(resultado.error).toMatch(/1 al 5/);
  });
});

describe("confirmarBoletaSorteo · exige sesión", () => {
  it("sin sesión, no llama a la base", async () => {
    vi.mocked(createClient).mockResolvedValue(clienteFalso({ user: null }) as never);
    const rpc = vi.fn();
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await confirmarBoletaSorteo({}, formularioNumero("123456"));

    expect(resultado.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("confirmarBoletaSorteo · con sesión", () => {
  it("un formato inválido no gasta un intento contra la base", async () => {
    vi.mocked(createClient).mockResolvedValue(clienteFalso({ user: USUARIO }) as never);
    const rpc = vi.fn();
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await confirmarBoletaSorteo({}, formularioNumero("12"));

    expect(resultado.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("si el número coincide, responde ok con el número (ya se puede mostrar: el asociado lo escribió)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, filaBoleta: { numero: "654321" } }) as never,
    );
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await confirmarBoletaSorteo({}, formularioNumero("654321"));

    expect(rpc).toHaveBeenCalledWith("confirmar_boleta_sorteo", {
      p_asociado_id: USUARIO.id,
      p_numero: "654321",
    });
    expect(resultado.ok).toBe(true);
    expect(resultado.numero).toBe("654321");
  });

  it("si el número NO coincide, informa los intentos restantes (tope 5) sin decir 'intentos agotados'", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, filaBoleta: { intentos: 2 } }) as never,
    );
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await confirmarBoletaSorteo({}, formularioNumero("000000"));

    expect(resultado.ok).toBeUndefined();
    expect(resultado.numero).toBeUndefined();
    expect(resultado.intentosRestantes).toBe(3);
  });

  it("si la base lanza excepción (p. ej. tope de intentos superado), da un mensaje genérico", async () => {
    vi.mocked(createClient).mockResolvedValue(clienteFalso({ user: USUARIO }) as never);
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Superaste el número de intentos para confirmar tu boleta" },
    });
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await confirmarBoletaSorteo({}, formularioNumero("000000"));

    expect(resultado.error).toBeTruthy();
    expect(resultado.error).not.toMatch(/intentos agotados/i);
  });
});
