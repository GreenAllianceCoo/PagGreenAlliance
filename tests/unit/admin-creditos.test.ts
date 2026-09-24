/**
 * Reglas de la Server Action `resolverCredito` (app/admin/creditos/actions.ts),
 * con Supabase simulado (nunca habla con una base real).
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
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ingreso/servidor", () => ({ correoDeCedula: vi.fn(async () => "asociado@correo.test") }));
vi.mock("@/lib/correo/credito", () => ({ enviarResultadoCredito: vi.fn(async () => {}) }));

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarResultadoCredito } from "@/lib/correo/credito";
import { resolverCredito } from "@/app/admin/creditos/actions";

const ID_ADMIN = "00000000-0000-4000-a000-000000000010";
const ID_ASOCIADO = "00000000-0000-4000-a000-000000000011";
const ID_SOLICITUD = "00000000-0000-4000-a000-000000000012";

type Escenario = {
  esAdmin?: boolean;
  estadoSolicitud?: "pendiente" | "aprobado" | "rechazado";
  asociadoId?: string;
  errorUpdate?: { code?: string; message: string } | null;
};

function crearSupabaseFalso(escenario: Escenario = {}) {
  const {
    esAdmin = true,
    estadoSolicitud = "pendiente",
    asociadoId = ID_ASOCIADO,
    errorUpdate = null,
  } = escenario;

  const actualizaciones: Record<string, unknown>[] = [];

  const from = vi.fn((tabla: string) => {
    const filtros: Record<string, unknown> = {};
    const resultado = () => {
      if (tabla === "perfiles") {
        if (filtros.id === ID_ADMIN) return { data: { rol: esAdmin ? "admin" : "asociado", nombre_completo: "Admin" }, error: null };
        return { data: { nombre_completo: "Asociado Prueba", cedula: "1234567890" }, error: null };
      }
      if (tabla === "solicitudes_credito") {
        return {
          data: { id: ID_SOLICITUD, estado: estadoSolicitud, asociado_id: asociadoId, monto_solicitado: 500000 },
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn((columna: string, valor: unknown) => {
      filtros[columna] = valor;
      return consulta;
    });
    consulta.single = vi.fn(async () => resultado());
    consulta.update = vi.fn((cambios: Record<string, unknown>) => {
      actualizaciones.push({ tabla, ...cambios });
      const encadenable: Record<string, unknown> = {};
      encadenable.eq = vi.fn(async () => ({ data: null, error: errorUpdate }));
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
    const r = await resolverCredito({}, formulario(campos));
    return { resultado: r, redirigeA: null as string | null };
  } catch (e) {
    if (e instanceof RedireccionSimulada) return { resultado: null, redirigeA: e.ruta };
    throw e;
  }
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(redirect).mockClear();
  vi.mocked(correoDeCedula).mockClear();
  vi.mocked(enviarResultadoCredito).mockClear();
});

describe("resolverCredito · quién puede resolver", () => {
  it("un usuario que no es admin es redirigido y no se guarda nada", async () => {
    const { actualizaciones } = crearSupabaseFalso({ esAdmin: false });
    const { redirigeA } = await enviar({ id: ID_SOLICITUD, decision: "aprobado" });
    expect(redirigeA).toBe("/cuenta");
    expect(actualizaciones).toHaveLength(0);
  });

  it("nadie resuelve su propia solicitud", async () => {
    const { actualizaciones } = crearSupabaseFalso({ asociadoId: ID_ADMIN });
    const { resultado } = await enviar({ id: ID_SOLICITUD, decision: "aprobado" });
    expect(resultado?.error).toBeTruthy();
    expect(actualizaciones).toHaveLength(0);
  });

  it("una solicitud ya resuelta no cambia", async () => {
    const { actualizaciones } = crearSupabaseFalso({ estadoSolicitud: "aprobado" });
    const { resultado } = await enviar({ id: ID_SOLICITUD, decision: "rechazado", motivo: "Motivo válido" });
    expect(resultado?.error).toBeTruthy();
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("resolverCredito · motivo obligatorio al rechazar (P-06)", () => {
  it("rechazar sin motivo devuelve error y no guarda nada", async () => {
    const { actualizaciones } = crearSupabaseFalso();
    const { resultado } = await enviar({ id: ID_SOLICITUD, decision: "rechazado" });
    expect(resultado?.error).toBeTruthy();
    expect(actualizaciones).toHaveLength(0);
  });

  it("rechazar con motivo guarda estado y motivo, y envía el correo", async () => {
    const { actualizaciones } = crearSupabaseFalso();
    const { resultado } = await enviar({ id: ID_SOLICITUD, decision: "rechazado", motivo: "No cumple los requisitos" });
    expect(resultado?.mensaje).toBeTruthy();
    expect(actualizaciones).toHaveLength(1);
    expect(actualizaciones[0]).toMatchObject({ estado: "rechazado", motivo_rechazo: "No cumple los requisitos" });
    expect(enviarResultadoCredito).toHaveBeenCalledTimes(1);
  });
});

describe("resolverCredito · aprobar", () => {
  it("aprobar guarda el estado y limpia el motivo", async () => {
    const { actualizaciones } = crearSupabaseFalso();
    const { resultado } = await enviar({ id: ID_SOLICITUD, decision: "aprobado" });
    expect(resultado?.mensaje).toBeTruthy();
    expect(actualizaciones[0]).toMatchObject({ estado: "aprobado", motivo_rechazo: null });
  });
});
