/**
 * Convenios B2 (docs/spec-convenios.md §B2): NIT del ingreso, «Enviarme el
 * código» con NIT, cuenta de Auth de la empresa y guarda del panel /convenio.
 * Supabase, next/headers y next/navigation simulados: nunca toca una base real.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { RedireccionSimulada } = vi.hoisted(() => {
  class RedireccionSimulada extends Error {
    constructor(public ruta: string) {
      super(`REDIRECT ${ruta}`);
    }
  }
  return { RedireccionSimulada };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new RedireccionSimulada(ruta);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn(), crearClienteAnonimoSinSesion: vi.fn() }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/correo/convenio", () => ({ avisarAccesoConvenio: vi.fn() }));
vi.mock("@/lib/conveniosServidor", () => ({ urlLogo: (r: string | null) => (r ? `/logo/${r}` : null) }));
vi.mock("@/lib/ingreso/servidor", () => ({
  enviarCodigo: vi.fn(async () => ({ mascara: "ve•••@em•••.co" })),
  guardarCookieIngreso: vi.fn(),
  leerCookieIngreso: vi.fn(),
  borrarCookieIngreso: vi.fn(),
  correoDe: vi.fn(),
  tipoDeIngreso: vi.fn(),
  dentroDelLimiteDeVerificacion: vi.fn(),
  segundosParaReenviar: vi.fn(() => 0),
  ESPERA_REENVIO_SEGUNDOS: 45,
  MENSAJE_LIMITE_VERIFICACION: "x",
}));

import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { avisarAccesoConvenio } from "@/lib/correo/convenio";
import { enviarCodigo, guardarCookieIngreso } from "@/lib/ingreso/servidor";
import { esquemaIngresoNit, normalizarNit } from "@/lib/validaciones/ingreso";
import { enviarCodigoConvenio } from "@/app/ingresar/actions";
import { asegurarCuentaConvenio, MENSAJE_CORREO_OCUPADO } from "@/lib/admin/cuentaConvenio";
import { exigirConvenio } from "@/lib/convenio/servidor";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";

const CONVENIO = "41000000-0000-4000-a000-000000000001";

beforeEach(() => vi.clearAllMocks());

async function rutaDe(promesa: Promise<unknown>) {
  try {
    await promesa;
    return null;
  } catch (e) {
    if (e instanceof RedireccionSimulada) return e.ruta;
    throw e;
  }
}

describe("NIT del ingreso", () => {
  it("normaliza los tres formatos aceptados", () => {
    expect(normalizarNit("902038118")).toBe("902038118");
    expect(normalizarNit(" 902.038.118-7 ")).toBe("902038118");
    expect(normalizarNit("9020381187")).toBe("9020381187");
    expect(normalizarNit("90a")).toBe("");
  });

  it("rechaza vacío, letras y largos fuera de rango", () => {
    expect(esquemaIngresoNit.safeParse({ nit: "" }).success).toBe(false);
    expect(esquemaIngresoNit.safeParse({ nit: "abc123456" }).success).toBe(false);
    expect(esquemaIngresoNit.safeParse({ nit: "12345" }).success).toBe(false);
    expect(esquemaIngresoNit.safeParse({ nit: "123456789012" }).success).toBe(false);
    const ok = esquemaIngresoNit.safeParse({ nit: "902.038.118-7" });
    expect(ok.success && ok.data.nit).toBe("902038118");
  });
});

describe("enviarCodigoConvenio", () => {
  it("con NIT inválido devuelve el error y no envía nada", async () => {
    const fd = new FormData();
    fd.set("nit", "abc");
    const r = await enviarCodigoConvenio({}, fd);
    expect(r.error).toBeTruthy();
    expect(r.nit).toBe("abc");
    expect(enviarCodigo).not.toHaveBeenCalled();
  });

  it("envía por NIT, guarda la cookie con t: nit y pasa al paso 2", async () => {
    const fd = new FormData();
    fd.set("nit", "902.038.118-7");
    const ruta = await rutaDe(enviarCodigoConvenio({}, fd));
    expect(enviarCodigo).toHaveBeenCalledWith("902038118", "nit");
    expect(guardarCookieIngreso).toHaveBeenCalledWith(expect.objectContaining({ c: "902038118", t: "nit", m: "ve•••@em•••.co" }));
    expect(ruta).toBe("/ingresar/codigo");
  });
});

function adminFalso(opciones: {
  crear?: { data?: { user: { id: string } | null }; error?: { code?: string; message?: string } | null };
  actualizar?: { error?: { code?: string } | null };
  vincular?: { error?: { code?: string } | null };
}) {
  const createUser = vi.fn(async () => ({ data: opciones.crear?.data ?? { user: { id: "u-nuevo" } }, error: opciones.crear?.error ?? null }));
  const updateUserById = vi.fn(async () => ({ data: {}, error: opciones.actualizar?.error ?? null }));
  const deleteUser = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async () => ({ data: null, error: opciones.vincular?.error ?? null }));
  vi.mocked(crearClienteAdmin).mockReturnValue({ auth: { admin: { createUser, updateUserById, deleteUser } }, rpc } as never);
  return { createUser, updateUserById, deleteUser, rpc };
}

describe("asegurarCuentaConvenio", () => {
  const base = { convenioId: CONVENIO, nombre: "AMB Móvil", correo: "ventas@amb.co" };

  it("mismo correo: no hace nada", async () => {
    const f = adminFalso({});
    const r = await asegurarCuentaConvenio({ ...base, actual: { usuarioId: "u1", correo: "ventas@amb.co" } });
    expect(r).toEqual({ ok: true, cambio: false });
    expect(f.createUser).not.toHaveBeenCalled();
    expect(avisarAccesoConvenio).not.toHaveBeenCalled();
  });

  it("sin cuenta: crea el usuario confirmado, lo vincula y envía el correo", async () => {
    const f = adminFalso({});
    const r = await asegurarCuentaConvenio({ ...base, actual: null });
    expect(r).toEqual({ ok: true, cambio: true });
    expect(f.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "ventas@amb.co", email_confirm: true }));
    expect(f.rpc).toHaveBeenCalledWith("vincular_cuenta_convenio", { p_convenio: CONVENIO, p_usuario: "u-nuevo", p_correo: "ventas@amb.co" });
    expect(avisarAccesoConvenio).toHaveBeenCalledWith({ convenioId: CONVENIO, nombre: "AMB Móvil", correo: "ventas@amb.co" });
  });

  it("correo que ya es de otra persona: error de campo y no vincula", async () => {
    const f = adminFalso({ crear: { data: { user: null }, error: { code: "email_exists" } } });
    const r = await asegurarCuentaConvenio({ ...base, actual: null });
    expect(r).toEqual({ ok: false, mensaje: MENSAJE_CORREO_OCUPADO });
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("si el vínculo falla, borra la cuenta recién creada", async () => {
    const f = adminFalso({ vincular: { error: { code: "P0001" } } });
    const r = await asegurarCuentaConvenio({ ...base, actual: null });
    expect(r.ok).toBe(false);
    expect(f.deleteUser).toHaveBeenCalledWith("u-nuevo");
    expect(avisarAccesoConvenio).not.toHaveBeenCalled();
  });

  it("con cuenta y correo distinto: cambia el correo de esa cuenta (no crea otra)", async () => {
    const f = adminFalso({});
    const r = await asegurarCuentaConvenio({ ...base, actual: { usuarioId: "u1", correo: "viejo@amb.co" } });
    expect(r).toEqual({ ok: true, cambio: true });
    expect(f.updateUserById).toHaveBeenCalledWith("u1", { email: "ventas@amb.co", email_confirm: true });
    expect(f.createUser).not.toHaveBeenCalled();
    expect(f.deleteUser).not.toHaveBeenCalled();
  });
});

function sesionFalsa(opciones: { user?: { id: string } | null; rol?: string | null; convenio?: string | null; fila?: object | null }) {
  const tabla = (data: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  });
  const from = vi.fn((nombre: string) =>
    nombre === "perfiles"
      ? tabla(opciones.rol === null ? null : { rol: opciones.rol ?? "convenio" })
      : tabla(opciones.fila === undefined ? { id: CONVENIO, nombre_empresa: "AMB Móvil", logo_path: null } : opciones.fila),
  );
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: opciones.user === undefined ? { id: "u1" } : opciones.user } })) },
    from,
    rpc: vi.fn(async () => ({ data: opciones.convenio === undefined ? CONVENIO : opciones.convenio, error: null })),
  } as never);
}

describe("exigirConvenio (guarda de /convenio)", () => {
  it("sin sesión → /ingresar", async () => {
    sesionFalsa({ user: null });
    expect(await rutaDe(exigirConvenio())).toBe("/ingresar");
  });

  it("otro rol → /cuenta", async () => {
    sesionFalsa({ rol: "asociado" });
    expect(await rutaDe(exigirConvenio())).toBe("/cuenta");
  });

  it("convenio oculto o eliminado → cierra la sesión con el aviso de cuenta inactiva", async () => {
    sesionFalsa({ convenio: null });
    expect(await rutaDe(exigirConvenio())).toBe(RUTA_CUENTA_INACTIVA);
  });

  it("rol convenio y convenio activo → devuelve el convenio", async () => {
    sesionFalsa({});
    const r = await exigirConvenio();
    expect(r.convenio).toEqual({ id: CONVENIO, nombre: "AMB Móvil", logoUrl: null });
  });
});
