/**
 * Reglas de la Server Action `asignarAsesor` (app/admin/afiliaciones/actions.ts,
 * P-96), con Supabase simulado (nunca habla con una base real): solo admin,
 * solo afiliación aprobada, solo perfil sin asesor, y update condicional
 * para no perder una carrera con otro admin.
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

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new RedireccionSimulada(ruta);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/correo/resend", () => ({ enviarPlantillaResend: vi.fn(async () => {}) }));

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { asignarAsesor } from "@/app/admin/afiliaciones/actions";

const ID_ADMIN = "00000000-0000-4000-a000-000000000030";
const ID_SOLICITUD = "00000000-0000-4000-a000-000000000031";
const ID_PERFIL = "00000000-0000-4000-a000-000000000032";
const ID_ASESOR = "00000000-0000-4000-a000-000000000033";
const CEDULA = "1234567899";

type Escenario = {
  esAdmin?: boolean;
  estadoSolicitud?: "pendiente" | "contactado" | "aprobada" | "rechazada";
  perfilExiste?: boolean;
  asesorIdPerfil?: string | null;
  /** Simula que, entre el select y el update, otro admin ya asignó un asesor. */
  filaActualizada?: boolean;
  /** Simula el error que lanza el trigger validar_perfil_asesor_id. */
  errorUpdateMensaje?: string;
};

function crearSupabaseFalso(escenario: Escenario = {}) {
  const {
    esAdmin = true,
    estadoSolicitud = "aprobada",
    perfilExiste = true,
    asesorIdPerfil = null,
    filaActualizada = true,
    errorUpdateMensaje,
  } = escenario;

  const actualizaciones: Record<string, unknown>[] = [];

  const from = vi.fn((tabla: string) => {
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn(() => consulta);
    consulta.is = vi.fn(() => consulta);
    consulta.single = vi.fn(async () => {
      if (tabla === "perfiles") return { data: { rol: esAdmin ? "admin" : "asociado", nombre_completo: "Admin" }, error: null };
      if (tabla === "solicitudes_afiliacion") {
        return { data: { id: ID_SOLICITUD, cedula: CEDULA, estado: estadoSolicitud }, error: null };
      }
      return { data: null, error: null };
    });
    consulta.maybeSingle = vi.fn(async () => {
      // Única llamada a maybeSingle en `perfiles` dentro de esta acción: la
      // lectura del perfil del asociado por cédula (select id, asesor_id).
      if (tabla === "perfiles") {
        if (!perfilExiste) return { data: null, error: null };
        return { data: { id: ID_PERFIL, asesor_id: asesorIdPerfil }, error: null };
      }
      return { data: null, error: null };
    });
    consulta.update = vi.fn((cambios: Record<string, unknown>) => {
      actualizaciones.push(cambios);
      const encadenable: Record<string, unknown> = {};
      encadenable.eq = vi.fn(() => encadenable);
      encadenable.is = vi.fn(() => encadenable);
      encadenable.select = vi.fn(() => encadenable);
      encadenable.maybeSingle = vi.fn(async () => {
        if (errorUpdateMensaje) return { data: null, error: { message: errorUpdateMensaje } };
        return { data: filaActualizada ? { id: ID_PERFIL } : null, error: null };
      });
      return encadenable;
    });
    return consulta;
  });

  const cliente = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: ID_ADMIN } }, error: null })) },
    from,
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { actualizaciones };
}

function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

async function enviar(campos: Record<string, string>) {
  try {
    const r = await asignarAsesor({}, formulario(campos));
    return { resultado: r, redirigeA: null as string | null };
  } catch (e) {
    if (e instanceof RedireccionSimulada) return { resultado: null, redirigeA: e.ruta };
    throw e;
  }
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(redirect).mockClear();
});

describe("asignarAsesor · quién puede asignar", () => {
  it("un usuario que no es admin es redirigido y no se guarda nada", async () => {
    const { actualizaciones } = crearSupabaseFalso({ esAdmin: false });
    const { redirigeA } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(redirigeA).toBe("/cuenta");
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("asignarAsesor · datos inválidos", () => {
  it("sin id de asesor devuelve error y no consulta nada", async () => {
    crearSupabaseFalso();
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: "no-es-un-uuid" });
    expect(resultado?.error).toBeTruthy();
  });
});

describe("asignarAsesor · la afiliación debe estar aprobada", () => {
  it("una afiliación pendiente no permite asignar asesor", async () => {
    const { actualizaciones } = crearSupabaseFalso({ estadoSolicitud: "pendiente" });
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.error).toContain("aprobada");
    expect(actualizaciones).toHaveLength(0);
  });

  it("una afiliación rechazada tampoco permite asignar asesor", async () => {
    const { actualizaciones } = crearSupabaseFalso({ estadoSolicitud: "rechazada" });
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.error).toContain("aprobada");
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("asignarAsesor · el perfil del asociado", () => {
  it("si no se encuentra el perfil (cédula sin cuenta creada), devuelve error", async () => {
    const { actualizaciones } = crearSupabaseFalso({ perfilExiste: false });
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.error).toBeTruthy();
    expect(actualizaciones).toHaveLength(0);
  });

  it("si el perfil YA tiene asesor, devuelve error y no actualiza nada", async () => {
    const { actualizaciones } = crearSupabaseFalso({ asesorIdPerfil: "00000000-0000-4000-a000-000000000099" });
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.error).toContain("ya tiene un asesor");
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("asignarAsesor · carrera con otro admin (update condicional)", () => {
  it("si el update afecta 0 filas (otro admin lo asignó primero), avisa sin sobrescribir", async () => {
    const { actualizaciones } = crearSupabaseFalso({ filaActualizada: false });
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.error).toContain("ya tiene un asesor");
    expect(actualizaciones).toEqual([{ asesor_id: ID_ASESOR }]);
  });
});

describe("asignarAsesor · el asesor elegido debe tener rol asesor", () => {
  it("si el trigger de la base rechaza el id (no es asesor), da un mensaje claro", async () => {
    crearSupabaseFalso({ errorUpdateMensaje: "asesor_id debe ser un perfil con rol asesor" });
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.error).toContain("no tiene rol de asesor");
  });
});

describe("asignarAsesor · éxito", () => {
  it("afiliación aprobada + perfil sin asesor: asigna y confirma", async () => {
    const { actualizaciones } = crearSupabaseFalso();
    const { resultado } = await enviar({ id: ID_SOLICITUD, asesorId: ID_ASESOR });
    expect(resultado?.mensaje).toContain("Asesor asignado");
    expect(actualizaciones).toEqual([{ asesor_id: ID_ASESOR }]);
  });
});
