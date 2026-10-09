/**
 * Recuperación de acceso: esquemas zod y Server Actions (Supabase simulado).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
// after() solo existe dentro de una petición: aquí se ejecuta al instante.
vi.mock("next/server", () => ({
  after: (tarea: () => unknown) => {
    void tarea();
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/servidor/limite", () => ({
  dentroDelLimite: vi.fn(async () => true),
  ipDelCliente: vi.fn(async () => "1.2.3.4"),
}));
vi.mock("@/lib/asociado/activo", () => ({ asociadoActivo: vi.fn(async () => true) }));
vi.mock("@/lib/correo/recuperacion", () => ({
  avisarAdminsDeRecuperacion: vi.fn(async () => {}),
  avisarCambioCorreoIngreso: vi.fn(async () => {}),
}));
vi.mock("@/lib/admin/servidor", () => ({ exigirAdmin: vi.fn() }));

import { exigirAdmin } from "@/lib/admin/servidor";
import { avisarAdminsDeRecuperacion, avisarCambioCorreoIngreso } from "@/lib/correo/recuperacion";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  esquemaCambiarCorreoAdmin,
  esquemaRechazarRecuperacion,
  esquemaRecuperacion,
  MENSAJE_RECUPERACION_RECIBIDA,
} from "@/lib/validaciones/recuperacion";
import { solicitarRecuperacion } from "@/app/ingresar/recuperar/actions";
import { cambiarCorreoIngreso } from "@/app/admin/asociados/actions";
import { rechazarRecuperacion } from "@/app/admin/alertas/actions";

const ID_ASOCIADO = "00000000-0000-4000-a000-000000000031";
const ID_ADMIN = "00000000-0000-4000-a000-000000000032";
const ID_SOLICITUD = "00000000-0000-4000-a000-000000000033";

function formulario(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("esquemas de recuperación de acceso", () => {
  const valido = { cedula: "1.234.567-890", correo: " Nuevo@Correo.COM ", celular: "+57 300 123 4567", motivo: "  Perdí   el acceso " };

  it("normaliza cédula, correo, celular y motivo", () => {
    const r = esquemaRecuperacion.parse(valido);
    expect(r).toEqual({
      cedula: "1234567890",
      correo: "nuevo@correo.com",
      celular: "3001234567",
      motivo: "Perdí el acceso",
    });
  });

  it.each([
    ["cedula", "12ab5"],
    ["cedula", ""],
    ["correo", "sin-arroba"],
    ["correo", ""],
    ["celular", "2001234567"],
    ["celular", "300123"],
    ["motivo", "no"],
    ["motivo", "x".repeat(301)],
  ])("rechaza %s inválido (%s)", (campo, valor) => {
    const r = esquemaRecuperacion.safeParse({ ...valido, [campo]: valor });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe(campo);
  });

  it("cambio de correo del admin: motivo de 5 a 300 y una solicitud elegida (H-03: sin correo libre)", () => {
    const base = { asociadoId: ID_ASOCIADO, solicitudId: ID_SOLICITUD, motivo: "Verificado" };
    expect(esquemaCambiarCorreoAdmin.safeParse(base).success).toBe(true);
    expect(esquemaCambiarCorreoAdmin.safeParse({ ...base, motivo: "hola" }).success).toBe(false);
    expect(esquemaCambiarCorreoAdmin.safeParse({ ...base, asociadoId: "no-uuid" }).success).toBe(false);
    expect(esquemaCambiarCorreoAdmin.safeParse({ ...base, solicitudId: "" }).success).toBe(false);
  });

  it("rechazo: solicitud uuid y motivo obligatorio", () => {
    expect(esquemaRechazarRecuperacion.safeParse({ solicitudId: ID_SOLICITUD, motivo: "No verificado" }).success).toBe(true);
    expect(esquemaRechazarRecuperacion.safeParse({ solicitudId: ID_SOLICITUD, motivo: "" }).success).toBe(false);
  });
});

describe("solicitarRecuperacion (formulario público)", () => {
  const campos = { cedula: "1234567890", correo: "nuevo@correo.com", celular: "3001234567", motivo: "Perdí el acceso" };
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dentroDelLimite).mockResolvedValue(true);
    rpc = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(crearClienteAdmin).mockReturnValue({
      rpc,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nombre_completo: "Ana Pérez" } }) }) }) }),
    } as never);
  });

  it("misma respuesta exista o no la cédula (y solo avisa a los admins si se creó)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null }); // cédula inexistente
    const noExiste = await solicitarRecuperacion({}, formulario(campos));
    rpc.mockResolvedValueOnce({ data: ID_SOLICITUD, error: null }); // cédula real
    const existe = await solicitarRecuperacion({}, formulario(campos));

    expect(noExiste).toEqual({ mensaje: MENSAJE_RECUPERACION_RECIBIDA });
    expect(existe).toEqual(noExiste);
    expect(avisarAdminsDeRecuperacion).toHaveBeenCalledTimes(1);
    // El aviso lleva solo el nombre.
    await vi.waitFor(() => expect(avisarAdminsDeRecuperacion).toHaveBeenCalledWith("Ana Pérez"));
  });

  it("si la base falla, igual responde lo mismo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await solicitarRecuperacion({}, formulario(campos))).toEqual({ mensaje: MENSAJE_RECUPERACION_RECIBIDA });
  });

  it("límite por cédula agotado: misma respuesta y no crea nada", async () => {
    vi.mocked(dentroDelLimite).mockImplementation(async (tipo) => tipo !== "recuperacion-cedula");
    expect(await solicitarRecuperacion({}, formulario(campos))).toEqual({ mensaje: MENSAJE_RECUPERACION_RECIBIDA });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("límite por IP agotado: aviso general, sin crear nada", async () => {
    vi.mocked(dentroDelLimite).mockImplementation(async (tipo) => tipo !== "recuperacion-ip");
    const r = await solicitarRecuperacion({}, formulario(campos));
    expect(r.errorGeneral).toMatch(/varias solicitudes/);
    expect(r.mensaje).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("campo trampa lleno: responde igual sin guardar", async () => {
    expect(await solicitarRecuperacion({}, formulario({ ...campos, sitio_web: "http://spam" }))).toEqual({
      mensaje: MENSAJE_RECUPERACION_RECIBIDA,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("datos inválidos: errores por campo y conserva lo escrito", async () => {
    const r = await solicitarRecuperacion({}, formulario({ ...campos, celular: "123", motivo: "" }));
    expect(r.errores?.celular).toBeTruthy();
    expect(r.errores?.motivo).toBeTruthy();
    expect(r.valores?.cedula).toBe("1234567890");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("cambiarCorreoIngreso (admin)", () => {
  let rpcAdmin: ReturnType<typeof vi.fn>;
  let actualizar: ReturnType<typeof vi.fn>;
  let rpcServicio: ReturnType<typeof vi.fn>;
  // Error de admin_validar_cambio_correo (null = válida y devuelve la fila de la solicitud elegida).
  let validar: { data: null; error: { code?: string; message: string } | null };
  let celularCoincide: boolean;
  let correoSolicitud: string;
  const respuestaValidar = () =>
    validar.error
      ? validar
      : {
          data: [{ o_solicitud_id: ID_SOLICITUD, o_correo_nuevo: correoSolicitud, o_celular_coincide: celularCoincide }],
          error: null,
        };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dentroDelLimite).mockResolvedValue(true);
    validar = { data: null, error: null };
    celularCoincide = true;
    correoSolicitud = "nuevo@correo.com";
    // Las RPC de admin se llaman con la sesión del admin: validar (antes de Auth) y registrar (después).
    rpcAdmin = vi.fn(async (nombre: string) =>
      nombre === "admin_validar_cambio_correo" ? respuestaValidar() : { data: "historial-id", error: null },
    );
    vi.mocked(exigirAdmin).mockResolvedValue({
      supabase: {
        rpc: rpcAdmin,
        from: (tabla: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: tabla === "solicitudes_recuperacion_acceso" ? { celular_coincide: celularCoincide } : { nombre_completo: "Ana Pérez" },
              }),
            }),
          }),
        }),
      },
      userId: ID_ADMIN,
      nombre: "Admin",
    } as never);
    actualizar = vi.fn(async () => ({ error: null }));
    rpcServicio = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(crearClienteAdmin).mockReturnValue({
      rpc: rpcServicio,
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: { email: "viejo@correo.com" } }, error: null }),
          updateUserById: actualizar,
        },
      },
    } as never);
  });

  const campos = { asociadoId: ID_ASOCIADO, solicitudId: ID_SOLICITUD, motivo: "Verificado por llamada" };

  it("cambia el correo de Auth, deja el historial y avisa a los dos correos", async () => {
    const r = await cambiarCorreoIngreso({}, formulario(campos));
    expect(r.mensaje).toMatch(/Correo de ingreso cambiado/);
    // SEC-REC-03: primero valida (RPC), después cambia Auth, cierra sesiones y registra.
    expect(rpcAdmin.mock.calls[0]).toEqual([
      "admin_validar_cambio_correo",
      { p_asociado_id: ID_ASOCIADO, p_solicitud_id: ID_SOLICITUD, p_motivo: "Verificado por llamada" },
    ]);
    // H-03: el correo que se aplica es el de la solicitud, no uno escrito por el admin.
    expect(actualizar).toHaveBeenCalledWith(ID_ASOCIADO, { email: "nuevo@correo.com", email_confirm: true });
    // SEC-REC-04: cierra todas las sesiones de esa persona (service role).
    expect(rpcServicio).toHaveBeenCalledWith("cerrar_sesiones_usuario", { p_user_id: ID_ASOCIADO });
    expect(rpcAdmin).toHaveBeenCalledWith("admin_registrar_cambio_correo", {
      p_asociado_id: ID_ASOCIADO,
      p_solicitud_id: ID_SOLICITUD,
      p_motivo: "Verificado por llamada",
    });
    expect(avisarCambioCorreoIngreso).toHaveBeenCalledWith({
      nombre: "Ana Pérez",
      anterior: "viejo@correo.com",
      nuevo: "nuevo@correo.com",
    });
  });

  it("sin motivo válido no toca nada", async () => {
    const r = await cambiarCorreoIngreso({}, formulario({ ...campos, motivo: "no" }));
    expect(r.errores?.motivo).toBeTruthy();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("no cambia el correo de sus propios clientes (RS-01) ni el suyo", async () => {
    validar = { data: null, error: { message: "Otro administrador debe cambiar el correo de tus clientes" } };
    const cliente = await cambiarCorreoIngreso({}, formulario(campos));
    expect(cliente.error).toMatch(/Otro administrador/);
    const propio = await cambiarCorreoIngreso({}, formulario({ ...campos, asociadoId: ID_ADMIN }));
    expect(propio.error).toMatch(/tu propio correo/);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("solo asociados", async () => {
    validar = { data: null, error: { message: "El asociado no existe" } };
    expect((await cambiarCorreoIngreso({}, formulario(campos))).error).toMatch(/no existe/);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("SEC-REC-03: sin solicitud pendiente o tras cambiarle el asesor, no toca Auth", async () => {
    validar = { data: null, error: { message: "No hay una solicitud de recuperación pendiente de esta persona" } };
    expect((await cambiarCorreoIngreso({}, formulario(campos))).error).toMatch(/solicitud de recuperación pendiente/);
    validar = {
      data: null,
      error: { message: "Otro administrador debe cambiar el correo: cambiaste el asesor de esta persona hace menos de 24 horas" },
    };
    expect((await cambiarCorreoIngreso({}, formulario(campos))).error).toMatch(/cambiaste el asesor/);
    expect(actualizar).not.toHaveBeenCalled();
    expect(rpcServicio).not.toHaveBeenCalled();
  });

  it("SEC-REC-01: si el celular escrito no coincide con el del perfil, exige la confirmación aparte", async () => {
    celularCoincide = false;
    const sin = await cambiarCorreoIngreso({}, formulario(campos));
    expect(sin.errores?.confirmaCelular).toBeTruthy();
    expect(actualizar).not.toHaveBeenCalled();
    const con = await cambiarCorreoIngreso({}, formulario({ ...campos, confirmaCelular: "on" }));
    expect(con.mensaje).toMatch(/Correo de ingreso cambiado/);
    expect(actualizar).toHaveBeenCalledTimes(1);
  });

  it("correo de la solicitud igual al actual o ya usado por otra cuenta: no registra nada", async () => {
    correoSolicitud = "viejo@correo.com";
    const igual = await cambiarCorreoIngreso({}, formulario(campos));
    expect(igual.error).toMatch(/ya es su correo/);
    correoSolicitud = "nuevo@correo.com";
    actualizar.mockResolvedValueOnce({ error: { code: "email_exists", status: 422 } });
    const repetido = await cambiarCorreoIngreso({}, formulario(campos));
    expect(repetido.error).toMatch(/otra cuenta/);
    expect(rpcAdmin.mock.calls.map((c) => c[0])).not.toContain("admin_registrar_cambio_correo");
    expect(rpcServicio).not.toHaveBeenCalled();
  });

  it("límite de cambios por hora", async () => {
    vi.mocked(dentroDelLimite).mockResolvedValue(false);
    expect((await cambiarCorreoIngreso({}, formulario(campos))).error).toMatch(/muchos cambios/);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("si el historial falla, avisa que el correo sí cambió", async () => {
    rpcAdmin.mockImplementation(async (nombre: string) =>
      nombre === "admin_validar_cambio_correo" ? respuestaValidar() : { data: null, error: { code: "XX000", message: "boom" } },
    );
    const r = await cambiarCorreoIngreso({}, formulario(campos));
    expect(r.error).toMatch(/El correo cambió/);
    expect(avisarCambioCorreoIngreso).not.toHaveBeenCalled();
  });

  it("rechazar una solicitud pasa por la RPC con motivo", async () => {
    const r = await rechazarRecuperacion({}, formulario({ solicitudId: ID_SOLICITUD, motivo: "No se verificó" }));
    expect(r.mensaje).toBe("Solicitud rechazada.");
    expect(rpcAdmin).toHaveBeenCalledWith("admin_rechazar_recuperacion", {
      p_solicitud_id: ID_SOLICITUD,
      p_motivo: "No se verificó",
    });
    const sinMotivo = await rechazarRecuperacion({}, formulario({ solicitudId: ID_SOLICITUD, motivo: "" }));
    expect(sinMotivo.errores?.motivo).toBeTruthy();
  });
});

describe("listarRecuperaciones (bandeja del admin)", () => {
  it("SEC-REC-01: el WhatsApp usa el celular del PERFIL, nunca el que escribió quien pide", async () => {
    const { listarRecuperaciones } = await import("@/lib/admin/recuperaciones");
    const solicitud = {
      id: ID_SOLICITUD,
      perfil_id: ID_ASOCIADO,
      cedula: "1000000001",
      correo_nuevo: "x@correo.com",
      celular: "3009998877", // el que escribió el atacante
      celular_coincide: false,
      motivo: "Perdí el acceso",
      estado: "pendiente",
      created_at: "2026-10-01T10:00:00Z",
      resuelta_por: null,
      resuelta_at: null,
      motivo_resolucion: null,
    };
    const cadena = (datos: unknown) => {
      const c: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "order", "in"]) c[m] = () => c;
      c.limit = async () => ({ data: datos, error: null });
      c.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: datos, error: null }).then(ok);
      return c;
    };
    const supabase = {
      from: (tabla: string) =>
        cadena(tabla === "perfiles" ? [{ id: ID_ASOCIADO, nombre_completo: "Ana", asesor_id: null, telefono: "3001112233" }] : [solicitud]),
    };
    const { filas } = await listarRecuperaciones(supabase as never, ID_ADMIN);
    expect(filas[0].whatsappUrl).toBe("https://wa.me/573001112233");
    expect(filas[0].whatsappUrl).not.toContain("3009998877");
    expect(filas[0].celularCoincide).toBe(false);
  });
});
