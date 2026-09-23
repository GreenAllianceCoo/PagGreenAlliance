/**
 * Reglas del crédito sobre la Server Action `crearSolicitud`
 * (app/cuenta/solicitar/actions.ts).
 *
 * El cliente de Supabase y `redirect` de Next.js se simulan: estas pruebas
 * nunca hablan con una base real. La base de datos tiene sus propias
 * pruebas en supabase/tests/*.sql (pgTAP).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Simulaciones
// ---------------------------------------------------------------------------

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
  // Aquí lanzamos uno propio para poder verificar la ruta.
  redirect: vi.fn((ruta: string) => {
    throw new RedireccionSimulada(ruta);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { crearSolicitud } from "@/app/cuenta/solicitar/actions";

// Copia de los datos de grados_credito de la migración 20260922000000 (la acción solo usa el tope).
const GRADOS: Record<string, Record<string, { capacidad_maxima: number; cuota_mensual: number; plazo_meses: number }>> = {
  PP: { "50": { capacidad_maxima: 1000000, cuota_mensual: 79000, plazo_meses: 3 }, "100": { capacidad_maxima: 2100000, cuota_mensual: 126000, plazo_meses: 3 } },
  PT: { "50": { capacidad_maxima: 1300000, cuota_mensual: 66000, plazo_meses: 3 }, "100": { capacidad_maxima: 2700000, cuota_mensual: 101000, plazo_meses: 3 } },
  SI: { "50": { capacidad_maxima: 1500000, cuota_mensual: 123000, plazo_meses: 3 }, "100": { capacidad_maxima: 3000000, cuota_mensual: 246000, plazo_meses: 3 } },
  IT: { "50": { capacidad_maxima: 2000000, cuota_mensual: 101000, plazo_meses: 3 }, "100": { capacidad_maxima: 4000000, cuota_mensual: 202000, plazo_meses: 3 } },
  OF: { "50": { capacidad_maxima: 2150000, cuota_mensual: 116000, plazo_meses: 3 }, "100": { capacidad_maxima: 4200000, cuota_mensual: 266000, plazo_meses: 3 } },
};

const ID_SESION = "00000000-0000-4000-a000-00000000000a";
const ID_OTRO = "00000000-0000-4000-a000-00000000000b";

type Escenario = {
  usuario?: { id: string } | null;
  grado?: string | null;
  sinPerfil?: boolean;
  sinTope?: boolean;
  ultimaSolicitud?: { estado: string } | null;
  errorInsert?: { message: string; code?: string; details?: string; hint?: string } | null;
};

/**
 * Cliente de Supabase falso: responde según la tabla consultada y
 * guarda lo que se intenta insertar.
 */
function crearSupabaseFalso(escenario: Escenario = {}) {
  const {
    usuario = { id: ID_SESION },
    grado = "PP",
    sinPerfil = false,
    sinTope = false,
    ultimaSolicitud = null,
    errorInsert = null,
  } = escenario;

  const insertados: Record<string, unknown>[] = [];

  const from = vi.fn((tabla: string) => {
    const filtros: Record<string, unknown> = {};

    const resultado = () => {
      if (tabla === "perfiles") {
        return { data: sinPerfil ? null : { grado, nombre_completo: "Asociado Prueba" }, error: null };
      }
      if (tabla === "solicitudes_credito") {
        return { data: ultimaSolicitud ? [ultimaSolicitud] : [], error: null };
      }
      if (tabla === "grados_credito") {
        if (sinTope) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } };
        const fila = GRADOS[String(filtros.grado)]?.[String(filtros.porcentaje)] ?? null;
        return { data: fila, error: null };
      }
      return { data: null, error: null };
    };

    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn((columna: string, valor: unknown) => {
      filtros[columna] = valor;
      return consulta;
    });
    consulta.order = vi.fn(() => consulta);
    consulta.limit = vi.fn(() => consulta);
    consulta.single = vi.fn(async () => resultado());
    consulta.then = (ok: (v: unknown) => unknown, falla: (e: unknown) => unknown) =>
      Promise.resolve(resultado()).then(ok, falla);
    // await insert(...) devuelve { error } (la acción no pide la fila creada).
    consulta.insert = vi.fn((fila: Record<string, unknown>) => {
      insertados.push(fila);
      return Promise.resolve({ data: null, error: errorInsert });
    });
    return consulta;
  });

  const cliente = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: usuario ? { ...usuario, email: "asociado@prueba.test" } : null },
        error: null,
      })),
    },
    from,
  };

  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, insertados };
}

function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

/** Ejecuta la acción y devuelve el resultado o la ruta de redirección. */
async function enviar(campos: Record<string, string>) {
  try {
    const r = await crearSolicitud({}, formulario(campos));
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

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

describe("crearSolicitud · porcentaje de devolución", () => {
  it.each(["", "0", "25", "75", "150", "50 ", " 100", "50%", "cien"])(
    "rechaza el porcentaje %j y no inserta",
    async (porcentaje) => {
      const { insertados } = crearSupabaseFalso();
      const { resultado } = await enviar({ porcentaje, monto: "500000" });
      expect(resultado?.error).toBeTruthy();
      expect(insertados).toHaveLength(0);
    }
  );

  it("rechaza cuando no se envía porcentaje y no inserta", async () => {
    const { insertados } = crearSupabaseFalso();
    const { resultado } = await enviar({ monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it.each(["50", "100"])("acepta el porcentaje %s", async (porcentaje) => {
    const { insertados } = crearSupabaseFalso();
    const { redirigeA } = await enviar({ porcentaje, monto: "500000" });
    expect(redirigeA).toBe("/cuenta");
    expect(insertados).toHaveLength(1);
  });
});

describe("crearSolicitud · monto", () => {
  it.each([
    ["vacío", ""],
    ["cero", "0"],
    ["negativo", "-1"],
    ["negativo grande", "-500000"],
    ["NaN", "NaN"],
    ["Infinity", "Infinity"],
    ["-Infinity", "-Infinity"],
    ["texto", "quinientos mil"],
    ["con puntos de miles", "500.000.000"],
    ["con decimales", "500000.5"],
    ["menor al mínimo", "99999"],
    ["muy pequeño", "6000"],
  ])("rechaza monto %s (%j) y no inserta", async (_nombre, monto) => {
    const { insertados } = crearSupabaseFalso();
    const { resultado } = await enviar({ porcentaje: "50", monto });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it("rechaza cuando no se envía monto y no inserta", async () => {
    const { insertados } = crearSupabaseFalso();
    const { resultado } = await enviar({ porcentaje: "50" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it("acepta el monto mínimo (100.000)", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "PP" });
    const { redirigeA } = await enviar({ porcentaje: "50", monto: "100000" });
    expect(redirigeA).toBe("/cuenta");
    expect(insertados).toHaveLength(1);
  });

  it("acepta monto igual al tope del grado (PP 50% = 1.000.000)", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "PP" });
    const { redirigeA } = await enviar({ porcentaje: "50", monto: "1000000" });
    expect(redirigeA).toBe("/cuenta");
    expect(insertados).toHaveLength(1);
    expect(insertados[0].monto_solicitado).toBe(1000000);
  });

  it("rechaza monto mayor al tope del grado (PP 50% = 1.000.001) y no inserta", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "PP" });
    const { resultado } = await enviar({ porcentaje: "50", monto: "1000001" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it("usa el tope del grado del perfil, no el de otro grado (PP no puede pedir el tope de OF)", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "PP" });
    const { resultado } = await enviar({ porcentaje: "100", monto: "4200000" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it("acepta monto igual al tope de OF 100% (4.200.000) para un OF", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "OF" });
    const { redirigeA } = await enviar({ porcentaje: "100", monto: "4200000" });
    expect(redirigeA).toBe("/cuenta");
    expect(insertados).toHaveLength(1);
  });
});

describe("crearSolicitud · sesión y perfil", () => {
  it("sin sesión redirige al ingreso y no inserta", async () => {
    const { insertados } = crearSupabaseFalso({ usuario: null });
    const { redirigeA } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(redirigeA).toMatch(/^\/(login|ingresar)/);
    expect(insertados).toHaveLength(0);
  });

  it("rechaza si el perfil no tiene grado y no inserta", async () => {
    const { insertados } = crearSupabaseFalso({ grado: null });
    const { resultado } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it("rechaza si no existe el perfil y no inserta", async () => {
    const { insertados } = crearSupabaseFalso({ sinPerfil: true });
    const { resultado } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it("rechaza si el grado no tiene tope configurado y no inserta", async () => {
    const { insertados } = crearSupabaseFalso({ sinTope: true });
    const { resultado } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });
});

describe("crearSolicitud · solicitud pendiente", () => {
  it("rechaza si la última solicitud está pendiente y no inserta", async () => {
    const { insertados } = crearSupabaseFalso({ ultimaSolicitud: { estado: "pendiente" } });
    const { resultado } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    expect(insertados).toHaveLength(0);
  });

  it.each(["aprobado", "rechazado"])("permite solicitar si la última está %s", async (estado) => {
    const { insertados } = crearSupabaseFalso({ ultimaSolicitud: { estado } });
    const { redirigeA } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(redirigeA).toBe("/cuenta");
    expect(insertados).toHaveLength(1);
  });
});

describe("crearSolicitud · datos que se insertan", () => {
  it("usa el asociado_id de la sesión e ignora los campos manipulados del formulario", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "PP" });
    await enviar({
      porcentaje: "50",
      monto: "1000000",
      asociado_id: ID_OTRO,
      estado: "aprobado",
      cuota_mensual: "1",
      plazo_meses: "99",
      revisado_por: ID_OTRO,
    });
    expect(insertados).toHaveLength(1);
    const fila = insertados[0];
    expect(fila.asociado_id).toBe(ID_SESION);
    expect(fila).not.toHaveProperty("estado");
    expect(fila).not.toHaveProperty("revisado_por");
    // Grado, tasa y plazo los pone la base.
    for (const campo of ["cuota_mensual", "plazo_meses", "tasa_interes_mensual", "grado"]) {
      expect(fila).not.toHaveProperty(campo);
    }
  });

  it("inserta porcentaje y monto como los validó (sin reinterpretarlos)", async () => {
    const { insertados } = crearSupabaseFalso({ grado: "IT" });
    await enviar({ porcentaje: "100", monto: "2000000" });
    expect(insertados[0]).toMatchObject({ porcentaje_devolucion: "100", monto_solicitado: 2000000 });
  });
});

describe("crearSolicitud · mensajes de error", () => {
  it("no expone el texto de Postgres cuando el insert falla", async () => {
    const errorPostgres = {
      message: 'duplicate key value violates unique constraint "ux_solicitud_pendiente_por_asociado"',
      code: "23505",
      details: `Key (asociado_id)=(${ID_SESION}) already exists.`,
      hint: "",
    };
    crearSupabaseFalso({ errorInsert: errorPostgres });
    const { resultado } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    const texto = resultado!.error!;
    for (const fuga of ["duplicate", "constraint", "ux_solicitud", "23505", "Key (", ID_SESION]) {
      expect(texto).not.toContain(fuga);
    }
  });

  it("no expone el mensaje del trigger de tope (con montos internos) cuando la base rechaza", async () => {
    crearSupabaseFalso({
      errorInsert: {
        message: "El monto solicitado (1000001) supera el tope de 1000000 para el grado PP con devolución del 50%",
        code: "P0001",
      },
    });
    const { resultado } = await enviar({ porcentaje: "50", monto: "500000" });
    expect(resultado?.error).toBeTruthy();
    expect(resultado!.error).not.toContain("P0001");
    expect(resultado!.error).not.toContain("1000000");
  });
});
