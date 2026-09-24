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
// F2-04 / S-01: actions-sorteo.ts ahora importa dentroDelLimite (lib/servidor/limite.ts,
// "server-only" real) para el tope de «Reenviar mi boleta»; se simula igual que el resto.
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn().mockResolvedValue(true) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarBoletaSorteo } from "@/lib/correo/sorteo";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { confirmarBoletaSorteo, participarSorteo, reenviarBoletaSorteo } from "@/app/cuenta/actions-sorteo";

const USUARIO = { id: "asociado-1", email: "ju.perez@policia.gov.co" };

/** Cliente normal (con sesión) falso: getUser + from().select().eq()... + rpc(). */
function clienteFalso(opts: {
  user: typeof USUARIO | null;
  nombrePerfil?: string;
  /** S-13: rol de quien tiene la sesión. Por defecto "asociado" (puede participar). */
  rol?: string;
  filaBoleta?: { intentos?: number; numero?: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.nombrePerfil ? { nombre_completo: opts.nombrePerfil, rol: opts.rol ?? "asociado" } : null,
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.filaBoleta ?? null, error: null });
  // mi_boleta_sorteo() (F2-01): se llama con el cliente de sesión normal, no el de admin.
  const rpc = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: opts.filaBoleta ?? null, error: null }) }));
  const from = vi.fn((tabla: string) => ({
    select: () =>
      tabla === "perfiles"
        ? { eq: () => ({ single }) }
        : { eq: () => ({ eq: () => ({ maybeSingle }) }) },
  }));
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }) }, from, rpc };
}

function adminFalso(rpc: ReturnType<typeof vi.fn>, from?: ReturnType<typeof vi.fn>) {
  return { rpc, from };
}

/** Cliente admin falso para reenviarBoletaSorteo: solo usa `.from()`, nunca `.rpc()`. */
function adminFalsoReenvio(fila: { numero: string; estado?: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: fila, error: null });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }) }));
  return { from };
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

  it("S-13: un rol distinto de asociado (p. ej. admin o asesor) no participa", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, nombrePerfil: "Admin Prueba", rol: "admin" }) as never,
    );
    const rpc = vi.fn();
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalso(rpc) as never);

    const resultado = await participarSorteo();

    expect(resultado.ok).toBeUndefined();
    expect(resultado.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    expect(enviarBoletaSorteo).not.toHaveBeenCalled();
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

describe("reenviarBoletaSorteo · F2-04 (auditoría 2026-09-24)", () => {
  it("sin sesión, no llama a la base ni al correo", async () => {
    vi.mocked(createClient).mockResolvedValue(clienteFalso({ user: null }) as never);
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalsoReenvio(null) as never);

    const resultado = await reenviarBoletaSorteo();

    expect(resultado.error).toBeTruthy();
    expect(enviarBoletaSorteo).not.toHaveBeenCalled();
  });

  it("reenvía el MISMO número (no genera uno nuevo) y responde solo con el correo enmascarado", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, nombrePerfil: "Juan Pérez" }) as never,
    );
    vi.mocked(crearClienteAdmin).mockReturnValue(
      adminFalsoReenvio({ numero: "654321", estado: "enviada" }) as never,
    );

    const resultado = await reenviarBoletaSorteo();

    expect(enviarBoletaSorteo).toHaveBeenCalledWith(
      expect.objectContaining({ correo: USUARIO.email, numero: "654321" }),
    );
    expect(resultado.ok).toBe(true);
    expect(resultado.correoEnmascarado).toBe("ju•••@po•••.co");
    // Nunca el número crudo en la respuesta al navegador.
    expect(JSON.stringify(resultado)).not.toContain("654321");
  });

  it("sin boleta ese mes, no envía nada y avisa con un error", async () => {
    vi.mocked(createClient).mockResolvedValue(clienteFalso({ user: USUARIO }) as never);
    vi.mocked(crearClienteAdmin).mockReturnValue(adminFalsoReenvio(null) as never);

    const resultado = await reenviarBoletaSorteo();

    expect(resultado.error).toBeTruthy();
    expect(enviarBoletaSorteo).not.toHaveBeenCalled();
  });

  it("respeta el límite de reenvíos (3 por día): sin llamar a la base si ya se superó", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clienteFalso({ user: USUARIO, nombrePerfil: "Juan Pérez" }) as never,
    );
    vi.mocked(crearClienteAdmin).mockReturnValue(
      adminFalsoReenvio({ numero: "654321", estado: "enviada" }) as never,
    );
    vi.mocked(dentroDelLimite).mockResolvedValueOnce(false);

    const resultado = await reenviarBoletaSorteo();

    expect(resultado.error).toBeTruthy();
    expect(enviarBoletaSorteo).not.toHaveBeenCalled();
  });
});
