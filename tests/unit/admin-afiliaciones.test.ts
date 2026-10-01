/**
 * Reglas de las Server Actions de app/admin/afiliaciones/actions.ts, con
 * Supabase simulado (cliente autenticado del admin + cliente de service role).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/correo/resend", () => ({ enviarConRespaldo: vi.fn(async () => {}) }));
vi.mock("@/lib/correo/institucional", () => ({ avisarCorreoInstitucional: vi.fn(async () => {}) }));

import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarConRespaldo } from "@/lib/correo/resend";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { aprobarAfiliacion, cambiarEstadoAfiliacion } from "@/app/admin/afiliaciones/actions";

const ID_ADMIN = "00000000-0000-4000-a000-000000000020";
const ID_SOLICITUD = "00000000-0000-4000-a000-000000000021";
const ID_PERFIL_NUEVO = "00000000-0000-4000-a000-000000000022";

process.env.RESEND_TEMPLATE_INGRESO_ACEPTADO = "plantilla-prueba";

type Escenario = {
  estadoSolicitud?: "pendiente" | "contactado" | "aprobada" | "rechazada";
  perfilYaExiste?: boolean;
  errorCrearUsuario?: boolean;
  /** Solicitud del formulario v3 (institución, correo institucional, nómina, asesor). */
  v3?: boolean;
  /** El trigger validar_perfil_asesor_id rechaza el asesor (dejó de atender). */
  asesorYaNoAtiende?: boolean;
};

const ID_ASESOR = "00000000-0000-4000-a000-000000000023";

function crearSupabaseFalso(escenario: Escenario = {}) {
  const {
    estadoSolicitud = "pendiente",
    perfilYaExiste = false,
    errorCrearUsuario = false,
    v3 = false,
    asesorYaNoAtiende = false,
  } = escenario;
  const actualizacionesPerfil: Record<string, unknown>[] = [];

  const actualizacionesEstado: Record<string, unknown>[] = [];
  const usuariosCreados: Record<string, unknown>[] = [];

  // Cliente autenticado del admin (RLS): lee la solicitud y cambia el estado.
  const from = vi.fn((tabla: string) => {
    const resultado = () => {
      if (tabla === "perfiles") return { data: { rol: "admin", nombre_completo: "Admin", activo: true }, error: null };
      if (tabla === "solicitudes_afiliacion") {
        return {
          data: {
            id: ID_SOLICITUD,
            nombre: "Camilo Restrepo",
            cedula: "1234567899",
            grado: "PT",
            email: "camilo@policia.gov.co",
            celular: "3009998877",
            asesor_id: v3 ? ID_ASESOR : null,
            estado: estadoSolicitud,
            ...(v3
              ? {
                  email: "camilo.personal@gmail.com",
                  institucion: "policia",
                  correo_institucional: "camilo@policia.gov.co",
                  nomina_entidad: "Bancolombia",
                  nomina_tipo: "ahorros",
                  nomina_numero: "12345678",
                }
              : {}),
          },
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn(() => consulta);
    consulta.single = vi.fn(async () => resultado());
    consulta.update = vi.fn((cambios: Record<string, unknown>) => {
      if (tabla === "solicitudes_afiliacion") actualizacionesEstado.push(cambios);
      const encadenable: Record<string, unknown> = {};
      encadenable.eq = vi.fn(async () => ({ data: null, error: null }));
      return encadenable;
    });
    return consulta;
  });
  const cliente = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: ID_ADMIN } }, error: null })) },
    from,
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);

  // Cliente de service role: busca/crea el perfil por cédula.
  const adminFrom = vi.fn(() => {
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn(() => consulta);
    consulta.maybeSingle = vi.fn(async () => ({
      data: perfilYaExiste ? { id: ID_PERFIL_NUEVO } : null,
      error: null,
    }));
    consulta.update = vi.fn((cambios: Record<string, unknown>) => {
      actualizacionesPerfil.push(cambios);
      const encadenable: Record<string, unknown> = {};
      encadenable.eq = vi.fn(async () =>
        asesorYaNoAtiende && "asesor_id" in cambios
          ? { data: null, error: { message: "asesor_id debe ser un perfil con rol asesor" } }
          : { data: null, error: null },
      );
      return encadenable;
    });
    return consulta;
  });
  const clienteAdmin = {
    from: adminFrom,
    auth: {
      admin: {
        createUser: vi.fn(async (datos: Record<string, unknown>) => {
          if (errorCrearUsuario) return { data: null, error: { message: "correo duplicado" } };
          usuariosCreados.push(datos);
          return { data: { user: { id: ID_PERFIL_NUEVO } }, error: null };
        }),
      },
    },
  };
  vi.mocked(crearClienteAdmin).mockReturnValue(clienteAdmin as never);

  return { actualizacionesEstado, usuariosCreados, actualizacionesPerfil };
}

function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(crearClienteAdmin).mockReset();
  vi.mocked(enviarConRespaldo).mockClear();
  vi.mocked(avisarCorreoInstitucional).mockClear();
});

describe("aprobarAfiliacion · crea la cuenta una sola vez (idempotente)", () => {
  it("la primera vez crea el usuario y envía el correo", async () => {
    const { usuariosCreados, actualizacionesEstado } = crearSupabaseFalso({ estadoSolicitud: "pendiente" });
    const resultado = await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(resultado.error).toBeUndefined();
    expect(usuariosCreados).toHaveLength(1);
    expect(actualizacionesEstado).toEqual([{ estado: "aprobada" }]);
    expect(enviarConRespaldo).toHaveBeenCalledTimes(1);
  });

  it("si la solicitud ya estaba aprobada, no crea un segundo usuario ni reenvía el correo", async () => {
    const { usuariosCreados } = crearSupabaseFalso({ estadoSolicitud: "aprobada" });
    const resultado = await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(resultado.mensaje).toContain("ya estaba aprobada");
    expect(usuariosCreados).toHaveLength(0);
    expect(enviarConRespaldo).not.toHaveBeenCalled();
  });

  it("si ya existe un perfil con esa cédula (estado desincronizado), no duplica la cuenta", async () => {
    const { usuariosCreados } = crearSupabaseFalso({ estadoSolicitud: "contactado", perfilYaExiste: true });
    const resultado = await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(resultado.error).toBeUndefined();
    expect(usuariosCreados).toHaveLength(0);
    expect(enviarConRespaldo).not.toHaveBeenCalled();
  });

  it("si Auth falla al crear el usuario, devuelve error y no marca la solicitud como aprobada", async () => {
    const { actualizacionesEstado } = crearSupabaseFalso({ estadoSolicitud: "pendiente", errorCrearUsuario: true });
    const resultado = await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(resultado.error).toBeTruthy();
    expect(actualizacionesEstado).toHaveLength(0);
  });
});

describe("aprobarAfiliacion · afiliación v3 (spec-requerimientos-ricardo §2.8 y §2.12)", () => {
  it("crea el usuario con el correo PERSONAL y copia institución, correo institucional, nómina y asesor al perfil", async () => {
    const { usuariosCreados, actualizacionesPerfil } = crearSupabaseFalso({ v3: true });
    const resultado = await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(resultado.error).toBeUndefined();
    expect(usuariosCreados[0]).toMatchObject({ email: "camilo.personal@gmail.com" });
    expect(actualizacionesPerfil[0]).toEqual({
      cedula: "1234567899",
      grado: "PT",
      institucion: "policia",
      correo_institucional: "camilo@policia.gov.co",
      nomina_entidad: "Bancolombia",
      nomina_tipo: "ahorros",
      nomina_numero: "12345678",
      asesor_id: ID_ASESOR,
    });
    expect(actualizacionesPerfil[0]).not.toHaveProperty("email");
  });

  it("RS-02: «Ingreso aceptado» (con la cédula) va SOLO al personal; al institucional, el aviso sin datos", async () => {
    crearSupabaseFalso({ v3: true });
    await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(enviarConRespaldo).toHaveBeenCalledTimes(1);
    expect(enviarConRespaldo).toHaveBeenCalledWith(expect.objectContaining({ para: ["camilo.personal@gmail.com"] }));
    expect(avisarCorreoInstitucional).toHaveBeenCalledWith("camilo.personal@gmail.com", "camilo@policia.gov.co");
  });

  it("sin correo institucional (solicitud antigua) solo va al personal", async () => {
    crearSupabaseFalso();
    await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(enviarConRespaldo).toHaveBeenCalledWith(expect.objectContaining({ para: ["camilo@policia.gov.co"] }));
  });

  it("si el asesor ya no atiende, aprueba igual sin asesor y lo avisa", async () => {
    const { actualizacionesPerfil, actualizacionesEstado } = crearSupabaseFalso({ v3: true, asesorYaNoAtiende: true });
    const resultado = await aprobarAfiliacion({}, formulario({ id: ID_SOLICITUD }));
    expect(resultado.error).toBeUndefined();
    expect(resultado.mensaje).toMatch(/ya no atiende asociados/);
    expect(actualizacionesPerfil).toHaveLength(2);
    expect(actualizacionesPerfil[1]).not.toHaveProperty("asesor_id");
    expect(actualizacionesPerfil[1]).toMatchObject({ nomina_numero: "12345678" });
    expect(actualizacionesEstado).toEqual([{ estado: "aprobada" }]);
  });
});

describe("cambiarEstadoAfiliacion", () => {
  it("«contactado» guarda el estado", async () => {
    const { actualizacionesEstado } = crearSupabaseFalso();
    const resultado = await cambiarEstadoAfiliacion({}, formulario({ id: ID_SOLICITUD, estado: "contactado" }));
    expect(resultado.mensaje).toBeTruthy();
    expect(actualizacionesEstado).toEqual([{ estado: "contactado" }]);
  });

  it("un estado que no maneja este botón (p. ej. «aprobada») se rechaza aquí (usa aprobarAfiliacion)", async () => {
    const { actualizacionesEstado } = crearSupabaseFalso();
    const resultado = await cambiarEstadoAfiliacion({}, formulario({ id: ID_SOLICITUD, estado: "aprobada" }));
    expect(resultado.error).toBeTruthy();
    expect(actualizacionesEstado).toHaveLength(0);
  });
});
