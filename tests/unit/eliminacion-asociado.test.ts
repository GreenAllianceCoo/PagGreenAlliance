/**
 * «Eliminar definitivamente» (anonimizar) con Supabase simulado: código por correo,
 * 3 intentos, limpieza de Storage/Auth, y las reglas puras y esquemas zod.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRETO = "s".repeat(40);
const ADMIN = "aaaaaaaa-1111-4222-8333-444444444444";
const ASOCIADO = "bbbbbbbb-1111-4222-8333-444444444444";
const SOLICITUD = "cccccccc-1111-4222-8333-444444444444";

const m = vi.hoisted(() => ({
  correoAdmin: "admin@greenalliance.test" as string | null,
  enviar: vi.fn(async (...args: [{ correo: string; nombreAdmin: string; codigo: string }]) => args.length >= 0),
  limite: true,
  rpc: vi.fn(),
  remove: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn(async () => m.limite) }));
vi.mock("@/lib/correo/eliminacion", () => ({ enviarCodigoEliminacion: m.enviar }));
vi.mock("@/lib/admin/servidor", () => ({
  exigirAdmin: vi.fn(async () => ({
    supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: m.correoAdmin ? { email: m.correoAdmin } : null } })) } },
    userId: ADMIN,
    nombre: "Admin Prueba",
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  crearClienteAdmin: vi.fn(() => ({
    rpc: (nombre: string, args: unknown) => {
      const r = m.rpc(nombre, args) as { data?: unknown; error?: unknown };
      const promesa = Promise.resolve({ data: r?.data ?? null, error: r?.error ?? null });
      return Object.assign(promesa, { maybeSingle: () => promesa });
    },
    storage: { from: (bucket: string) => ({ remove: (rutas: string[]) => m.remove(bucket, rutas) }) },
    auth: { admin: { deleteUser: (id: string) => m.deleteUser(id) } },
  })),
}));

import { confirmarEliminacionAsociado, pedirEliminacionAsociado } from "@/app/admin/asociados/eliminar-actions";
import {
  agruparPorBucket,
  generarCodigoEliminacion,
  hashCodigoEliminacion,
  separarRutaStorage,
} from "@/lib/eliminacion";
import {
  esquemaCodigoEliminacion,
  esquemaConfirmarEliminacion,
  esquemaPedirEliminacion,
} from "@/lib/validaciones/eliminacion";

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("código de confirmación", () => {
  it("siempre son 6 dígitos", () => {
    for (let i = 0; i < 300; i++) expect(generarCodigoEliminacion()).toMatch(/^[0-9]{6}$/);
  });
  it("el HMAC depende del código, del admin, del asociado y del secreto", () => {
    const base = hashCodigoEliminacion("123456", ADMIN, ASOCIADO, SECRETO);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCodigoEliminacion("123456", ADMIN, ASOCIADO, SECRETO)).toBe(base);
    expect(hashCodigoEliminacion("123457", ADMIN, ASOCIADO, SECRETO)).not.toBe(base);
    expect(hashCodigoEliminacion("123456", SOLICITUD, ASOCIADO, SECRETO)).not.toBe(base);
    expect(hashCodigoEliminacion("123456", ADMIN, SOLICITUD, SECRETO)).not.toBe(base);
    expect(hashCodigoEliminacion("123456", ADMIN, ASOCIADO, "o".repeat(40))).not.toBe(base);
  });
});

describe("rutas de Storage", () => {
  it("separa bucket y ruta", () => {
    expect(separarRutaStorage("afiliacion-documentos/solicitudes/x/f.jpg")).toEqual({
      bucket: "afiliacion-documentos",
      ruta: "solicitudes/x/f.jpg",
    });
    expect(separarRutaStorage("sin-ruta")).toBeNull();
    expect(separarRutaStorage("bucket/")).toBeNull();
    expect(separarRutaStorage("/ruta")).toBeNull();
  });
  it("agrupa por bucket e ignora lo mal formado", () => {
    const g = agruparPorBucket(["a/1.jpg", "a/2.jpg", "b/3.pdf", "malo"]);
    expect([...g.entries()]).toEqual([
      ["a", ["1.jpg", "2.jpg"]],
      ["b", ["3.pdf"]],
    ]);
  });
});

describe("esquemas", () => {
  const ok = { asociadoId: ASOCIADO, motivo: "Cumplió su ciclo", entiendo: "on" };
  it("pedir: válido, y el motivo se limpia", () => {
    const r = esquemaPedirEliminacion.safeParse({ ...ok, motivo: "  Cumplió   su ciclo  " });
    expect(r.success && r.data.motivo).toBe("Cumplió su ciclo");
  });
  it.each([
    [{ ...ok, motivo: "abc" }, "motivo"],
    [{ ...ok, motivo: "x".repeat(301) }, "motivo"],
    [{ ...ok, motivo: "     " }, "motivo"],
    [{ ...ok, entiendo: "" }, "entiendo"],
    [{ ...ok, asociadoId: "no-uuid" }, "asociadoId"],
  ])("pedir: rechaza %j", (entrada, campo) => {
    const r = esquemaPedirEliminacion.safeParse(entrada);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
  });
  it.each(["123456", "000000", " 123 456 "])("código válido %j", (c) => {
    expect(esquemaCodigoEliminacion.safeParse(c).success).toBe(true);
  });
  it.each(["12345", "1234567", "abcdef", "12 34 5a", ""])("código inválido %j", (c) => {
    expect(esquemaCodigoEliminacion.safeParse(c).success).toBe(false);
  });
  it("confirmar: pide los 3 campos", () => {
    expect(esquemaConfirmarEliminacion.safeParse({ asociadoId: ASOCIADO, solicitudId: SOLICITUD, codigo: "123456" }).success).toBe(true);
    expect(esquemaConfirmarEliminacion.safeParse({ asociadoId: ASOCIADO, codigo: "123456" }).success).toBe(false);
  });
});

describe("pedirEliminacionAsociado", () => {
  beforeEach(() => {
    process.env.LIMITE_HMAC_SECRET = SECRETO;
    m.correoAdmin = "Admin@GreenAlliance.test";
    m.enviar.mockClear();
    m.enviar.mockResolvedValue(true);
    m.limite = true;
    m.rpc.mockReset();
    m.rpc.mockImplementation((nombre: string) => (nombre === "admin_solicitar_eliminacion" ? { data: SOLICITUD } : {}));
  });
  const entrada = () => formulario({ asociadoId: ASOCIADO, motivo: "Cumplió su ciclo", entiendo: "on" });

  it("manda el código al correo del admin en sesión y guarda solo su HMAC", async () => {
    const r = await pedirEliminacionAsociado({}, entrada());
    expect(r.solicitudId).toBe(SOLICITUD);
    expect(r.correoMascara).toMatch(/^ad•••@•••$/); // nunca el correo completo
    const envio = m.enviar.mock.calls[0][0];
    expect(envio.correo).toBe("admin@greenalliance.test");
    expect(envio.codigo).toMatch(/^[0-9]{6}$/);
    const args = m.rpc.mock.calls.find((c) => c[0] === "admin_solicitar_eliminacion")![1] as Record<string, string>;
    expect(args.p_admin_id).toBe(ADMIN);
    expect(args.p_asociado_id).toBe(ASOCIADO);
    expect(args.p_codigo_hash).toBe(hashCodigoEliminacion(envio.codigo, ADMIN, ASOCIADO, SECRETO));
    expect(JSON.stringify(args)).not.toContain(envio.codigo);
  });
  it("errores por campo sin tocar la base ni enviar correo", async () => {
    const r = await pedirEliminacionAsociado({}, formulario({ asociadoId: ASOCIADO, motivo: "ab" }));
    expect(r.errores?.motivo).toMatch(/entre 5 y 300/);
    expect(r.errores?.entiendo).toMatch(/casilla/);
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.enviar).not.toHaveBeenCalled();
  });
  it("traduce el motivo por el que la base no deja (p. ej. sigue activo)", async () => {
    m.rpc.mockReturnValue({ error: { message: "Primero da de baja al asociado; solo se elimina a un asociado inactivo" } });
    const r = await pedirEliminacionAsociado({}, entrada());
    expect(r.error).toBe("Primero da de baja al asociado; solo se elimina a un asociado inactivo.");
    expect(m.enviar).not.toHaveBeenCalled();
  });
  it("un error raro de la base no se muestra (mensaje genérico)", async () => {
    m.rpc.mockReturnValue({ error: { message: 'duplicate key value violates constraint "x"', code: "23505" } });
    const r = await pedirEliminacionAsociado({}, entrada());
    expect(r.error).toBe("No pudimos completar la acción. Intenta de nuevo.");
  });
  it("si el correo no sale, cancela el pedido y avisa", async () => {
    m.enviar.mockResolvedValue(false);
    const r = await pedirEliminacionAsociado({}, entrada());
    expect(r.solicitudId).toBeUndefined();
    expect(r.error).toMatch(/No pudimos enviar el código/);
    expect(m.rpc).toHaveBeenCalledWith("admin_cancelar_eliminacion", { p_admin_id: ADMIN, p_solicitud_id: SOLICITUD });
  });
  it("respeta el límite de códigos por hora", async () => {
    m.limite = false;
    const r = await pedirEliminacionAsociado({}, entrada());
    expect(r.error).toMatch(/muchos códigos/);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("sin secreto del servidor no hace nada", async () => {
    delete process.env.LIMITE_HMAC_SECRET;
    const r = await pedirEliminacionAsociado({}, entrada());
    expect(r.error).toBeTruthy();
    expect(m.rpc).not.toHaveBeenCalled();
  });
});

describe("confirmarEliminacionAsociado", () => {
  beforeEach(() => {
    process.env.LIMITE_HMAC_SECRET = SECRETO;
    m.limite = true;
    m.rpc.mockReset();
    m.remove.mockReset();
    m.remove.mockResolvedValue({ error: null });
    m.deleteUser.mockReset();
    m.deleteUser.mockResolvedValue({ error: null });
  });
  const entrada = (extra: Record<string, string> = {}) =>
    formulario({ asociadoId: ASOCIADO, solicitudId: SOLICITUD, codigo: "123456", ...extra });
  const responde = (fila: { resultado: string; intentos_restantes?: number; archivos?: string[] | null }) =>
    m.rpc.mockImplementation((nombre: string) =>
      nombre === "admin_confirmar_eliminacion" ? { data: { intentos_restantes: 0, archivos: null, ...fila } } : {},
    );

  it("código correcto: anonimiza, borra archivos y usuario de Auth, y cierra la limpieza", async () => {
    responde({ resultado: "ok", archivos: ["afiliacion-documentos/solicitudes/a/f.jpg", "fotos-carne/u/c.jpg"] });
    const r = await confirmarEliminacionAsociado({}, entrada());
    expect(r.mensaje).toBe("Asociado eliminado definitivamente.");
    expect(m.remove).toHaveBeenCalledWith("afiliacion-documentos", ["solicitudes/a/f.jpg"]);
    expect(m.remove).toHaveBeenCalledWith("fotos-carne", ["u/c.jpg"]);
    // Los comprobantes de desembolso NO se borran aquí: se guardan 30 días (los borra la tarea programada).
    expect(m.remove).not.toHaveBeenCalledWith("comprobantes-desembolso", expect.anything());
    expect(m.deleteUser).toHaveBeenCalledWith(ASOCIADO);
    expect(m.rpc).toHaveBeenCalledWith("admin_cerrar_limpieza_eliminacion", { p_admin_id: ADMIN, p_solicitud_id: SOLICITUD });
    const args = m.rpc.mock.calls.find((c) => c[0] === "admin_confirmar_eliminacion")![1] as Record<string, string>;
    expect(args.p_codigo_hash).toBe(hashCodigoEliminacion("123456", ADMIN, ASOCIADO, SECRETO));
    expect(args.p_admin_id).toBe(ADMIN);
  });
  it("código incorrecto: dice cuántos intentos quedan y no borra nada", async () => {
    responde({ resultado: "codigo_incorrecto", intentos_restantes: 2 });
    expect((await confirmarEliminacionAsociado({}, entrada())).errores?.codigo).toBe("El código no es correcto. Te quedan 2 intentos.");
    responde({ resultado: "codigo_incorrecto", intentos_restantes: 1 });
    expect((await confirmarEliminacionAsociado({}, entrada())).errores?.codigo).toBe("El código no es correcto. Te queda 1 intento.");
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.deleteUser).not.toHaveBeenCalled();
  });
  it.each([
    ["bloqueada", /3 intentos/],
    ["vencida", /venció/],
    ["no_existe", /ya no es válido/],
  ])("%s: hay que pedir otro código y no se borra nada", async (resultado, texto) => {
    responde({ resultado });
    const r = await confirmarEliminacionAsociado({}, entrada());
    expect(r.error).toMatch(texto);
    expect(r.reiniciar).toBe(true);
    expect(m.deleteUser).not.toHaveBeenCalled();
  });
  it("un código mal escrito no llega a la base (no gasta intentos)", async () => {
    const r = await confirmarEliminacionAsociado({}, entrada({ codigo: "12" }));
    expect(r.errores?.codigo).toMatch(/6 números/);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("si falla borrar el usuario de Auth, avisa y deja reintentar sin código", async () => {
    responde({ resultado: "ok", archivos: [] });
    m.deleteUser.mockResolvedValue({ error: { status: 500, code: "unexpected_failure", message: "boom" } });
    const r = await confirmarEliminacionAsociado({}, entrada());
    expect(r.limpiezaPendiente).toBe(true);
    expect(r.mensaje).toBeUndefined();
    expect(m.rpc).not.toHaveBeenCalledWith("admin_cerrar_limpieza_eliminacion", expect.anything());

    // Reintento: sin código; ahora Auth responde que el usuario ya no existe → completo.
    m.deleteUser.mockResolvedValue({ error: { status: 404, code: "user_not_found", message: "no existe" } });
    const otra = await confirmarEliminacionAsociado({}, formulario({ asociadoId: ASOCIADO, solicitudId: SOLICITUD, reintento: "1" }));
    expect(otra.mensaje).toBe("Asociado eliminado definitivamente.");
  });
  it("si falla borrar un archivo de Storage, también queda pendiente", async () => {
    responde({ resultado: "ok", archivos: ["afiliacion-documentos/x/f.jpg"] });
    m.remove.mockResolvedValue({ error: { message: "boom" } });
    expect((await confirmarEliminacionAsociado({}, entrada())).limpiezaPendiente).toBe(true);
  });
  it("respeta el límite por hora", async () => {
    m.limite = false;
    const r = await confirmarEliminacionAsociado({}, entrada());
    expect(r.error).toMatch(/muchos intentos/);
    expect(m.rpc).not.toHaveBeenCalled();
  });
});
