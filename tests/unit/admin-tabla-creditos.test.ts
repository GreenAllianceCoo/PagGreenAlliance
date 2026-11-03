/**
 * Vista de tabla de /admin/creditos: «Guardar cambios» con UN motivo
 * (guardarCambiosTablaCreditos, app/admin/creditos/tabla-actions.ts) y su esquema,
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
  // Como el real: deja pasar las redirecciones y se traga lo demás.
  unstable_rethrow: vi.fn((e: unknown) => {
    if (e instanceof RedireccionSimulada) throw e;
  }),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/ingreso/servidor", () => ({ correoDeCedula: vi.fn(async () => "asociado@correo.test") }));
vi.mock("@/lib/correo/credito", () => ({
  enviarResultadoCredito: vi.fn(async () => {}),
  enviarCreditoHabilitado: vi.fn(async () => {}),
  enviarCondicionesCredito: vi.fn(async () => {}),
  enviarCreditoAsignado: vi.fn(async () => {}),
  enviarDesembolsoCredito: vi.fn(async () => {}),
}));
vi.mock("@/lib/correo/cedula", () => ({ avisarCambioCedula: vi.fn(async () => {}) }));
vi.mock("@/lib/correo/recuperacion", () => ({ avisarCambioCorreoIngreso: vi.fn(async () => {}) }));
vi.mock("@/lib/correo/institucional", () => ({ avisarCorreoInstitucional: vi.fn(async () => {}) }));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn(async () => true) }));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarResultadoCredito } from "@/lib/correo/credito";
import { avisarCambioCedula } from "@/lib/correo/cedula";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { guardarCambiosTablaCreditos } from "@/app/admin/creditos/tabla-actions";
import {
  contarCambiosTabla,
  esquemaGuardarCambiosTablaCreditos,
  MAX_CAMBIOS_TABLA_CREDITOS,
  type EntradaCambiosTablaCreditos,
} from "@/lib/validaciones/admin";

const ID_ADMIN = "00000000-0000-4000-a000-000000000010";
const ANA = "00000000-0000-4000-a000-000000000011";
const LUIS = "00000000-0000-4000-a000-000000000012";
const CLIENTE = "00000000-0000-4000-a000-000000000013";
const SOL_ANA = "00000000-0000-4000-a000-000000000021";
const SOL_LUIS = "00000000-0000-4000-a000-000000000022";
const SOL_PROPIA = "00000000-0000-4000-a000-000000000023";
const MOTIVO = "Revisión del comité de crédito";

type Perfil = Record<string, unknown>;

function perfilBase(extra: Perfil): Perfil {
  return {
    rol: "asociado",
    asesor_id: null,
    eliminado_at: null,
    institucion: "policia",
    telefono: "3001112233",
    correo_institucional: "ana@policia.gov.co",
    nomina_entidad: "Bancolombia",
    nomina_tipo: "ahorros",
    nomina_numero: "12345678",
    ...extra,
  };
}

type Escenario = {
  rol?: "admin" | "secretario" | "asociado";
  /** RPC que falla: nombre → error. */
  erroresRpc?: Record<string, { code?: string; message: string }>;
};

function crearSupabaseFalso({ rol = "admin", erroresRpc = {} }: Escenario = {}) {
  const perfiles: Record<string, Perfil> = {
    [ANA]: perfilBase({ nombre_completo: "Ana Ruiz", cedula: "1234567890" }),
    [LUIS]: perfilBase({ nombre_completo: "Luis Mora", cedula: "2234567890", nomina_entidad: null, nomina_tipo: null, nomina_numero: null, correo_institucional: null }),
    [CLIENTE]: perfilBase({ nombre_completo: "Cliente Propio", cedula: "3234567890", asesor_id: ID_ADMIN }),
  };
  const solicitudes: Record<string, Perfil> = {
    [SOL_ANA]: { id: SOL_ANA, estado: "pendiente", asociado_id: ANA, monto_solicitado: 500000 },
    [SOL_LUIS]: { id: SOL_LUIS, estado: "pendiente", asociado_id: LUIS, monto_solicitado: 700000 },
    [SOL_PROPIA]: { id: SOL_PROPIA, estado: "pendiente", asociado_id: ID_ADMIN, monto_solicitado: 900000 },
  };
  const actualizaciones: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (nombre: string, ...resto: [Record<string, unknown>]) => {
    void resto;
    const error = erroresRpc[nombre];
    if (error) return { data: null, error };
    return { data: nombre === "admin_editar_datos_asociado" ? ["nombre"] : null, error: null };
  });

  const from = vi.fn((tabla: string) => {
    const filtros: Record<string, unknown> = {};
    const resultado = () => {
      if (tabla === "perfiles") {
        if (filtros.id === ID_ADMIN) return { data: { rol, nombre_completo: "Admin", activo: true }, error: null };
        return { data: perfiles[filtros.id as string] ?? null, error: null };
      }
      if (tabla === "solicitudes_credito") return { data: solicitudes[filtros.id as string] ?? null, error: null };
      return { data: null, error: null };
    };
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn((columna: string, valor: unknown) => {
      filtros[columna] = valor;
      return consulta;
    });
    consulta.single = vi.fn(async () => resultado());
    consulta.maybeSingle = vi.fn(async () => resultado());
    consulta.update = vi.fn((cambios: Record<string, unknown>) => {
      const encadenable: Record<string, unknown> = {};
      const filtrosUpdate: Record<string, unknown> = {};
      encadenable.eq = vi.fn((columna: string, valor: unknown) => {
        filtrosUpdate[columna] = valor;
        return encadenable;
      });
      encadenable.select = vi.fn(() => encadenable);
      encadenable.maybeSingle = vi.fn(async () => {
        actualizaciones.push({ tabla, id: filtrosUpdate.id, ...cambios });
        return { data: { id: filtrosUpdate.id }, error: null };
      });
      return encadenable;
    });
    return consulta;
  });

  const cliente = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: ID_ADMIN } }, error: null })) },
    from,
    rpc,
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { rpc, actualizaciones };
}

async function guardar(entrada: EntradaCambiosTablaCreditos) {
  try {
    return { resultado: await guardarCambiosTablaCreditos(entrada), redirigeA: null as string | null };
  } catch (e) {
    if (e instanceof RedireccionSimulada) return { resultado: null, redirigeA: e.ruta };
    throw e;
  }
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(enviarResultadoCredito).mockClear();
  vi.mocked(avisarCambioCedula).mockClear();
  vi.mocked(avisarCorreoInstitucional).mockClear();
});

describe("esquemaGuardarCambiosTablaCreditos", () => {
  const base = { motivo: MOTIVO, personas: [], estados: [{ solicitudId: SOL_ANA, decision: "aprobado" as const }] };

  it("el motivo es obligatorio (5 a 300 caracteres)", () => {
    for (const motivo of ["", "   ", "abc", "x".repeat(301)]) {
      const r = esquemaGuardarCambiosTablaCreditos.safeParse({ ...base, motivo });
      expect(r.success).toBe(false);
      expect(r.error!.issues[0]?.path[0]).toBe("motivo");
    }
    expect(esquemaGuardarCambiosTablaCreditos.safeParse(base).success).toBe(true);
  });

  it(`no acepta más de ${MAX_CAMBIOS_TABLA_CREDITOS} cambios en un envío, ni un envío vacío`, () => {
    const personas = Array.from({ length: 26 }, (_, i) => ({
      asociadoId: `00000000-0000-4000-a000-${String(100 + i).padStart(12, "0")}`,
      nombre: "Ana Ruiz",
      telefono: "3001112233",
    }));
    expect(contarCambiosTabla({ personas, estados: [] })).toBe(52);
    expect(esquemaGuardarCambiosTablaCreditos.safeParse({ motivo: MOTIVO, personas, estados: [] }).success).toBe(false);
    expect(esquemaGuardarCambiosTablaCreditos.safeParse({ motivo: MOTIVO, personas: personas.slice(0, 25), estados: [] }).success).toBe(true);
    expect(esquemaGuardarCambiosTablaCreditos.safeParse({ motivo: MOTIVO, personas: [], estados: [] }).success).toBe(false);
  });

  it.each([
    ["cédula con letras", { cedula: "12ab567" }],
    ["cédula corta", { cedula: "12345" }],
    ["celular que no empieza por 3", { telefono: "2001234567" }],
    ["celular corto", { telefono: "300123" }],
    ["nombre con números", { nombre: "Ana 2" }],
    ["nombre de una letra", { nombre: "A" }],
  ])("rechaza %s", (_caso, cambio) => {
    expect(
      esquemaGuardarCambiosTablaCreditos.safeParse({ motivo: MOTIVO, personas: [{ asociadoId: ANA, ...cambio }], estados: [] }).success,
    ).toBe(false);
  });

  it("normaliza como «Editar datos»: celular con +57, cédula con puntos; celular vacío = quitarlo", () => {
    const r = esquemaGuardarCambiosTablaCreditos.parse({
      motivo: MOTIVO,
      personas: [
        { asociadoId: ANA, telefono: "+57 300 123 4567", cedula: "1.234.567.891" },
        { asociadoId: LUIS, telefono: "" },
      ],
      estados: [],
    });
    expect(r.personas[0]).toMatchObject({ telefono: "3001234567", cedula: "1234567891" });
    expect(r.personas[1].telefono).toBeNull();
  });

  it("con un cambio de cédula, el motivo no puede llevar números de cédula", () => {
    const r = esquemaGuardarCambiosTablaCreditos.safeParse({
      motivo: "Era 1234567890 según el documento",
      personas: [{ asociadoId: ANA, cedula: "1234567891" }],
      estados: [],
    });
    expect(r.success).toBe(false);
  });

  it("no acepta la misma persona o la misma solicitud dos veces", () => {
    expect(
      esquemaGuardarCambiosTablaCreditos.safeParse({
        motivo: MOTIVO,
        personas: [
          { asociadoId: ANA, nombre: "Ana Ruiz" },
          { asociadoId: ANA, telefono: "3001112233" },
        ],
        estados: [],
      }).success,
    ).toBe(false);
    expect(
      esquemaGuardarCambiosTablaCreditos.safeParse({
        motivo: MOTIVO,
        personas: [],
        estados: [
          { solicitudId: SOL_ANA, decision: "aprobado" },
          { solicitudId: SOL_ANA, decision: "rechazado" },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("guardarCambiosTablaCreditos · quién puede", () => {
  it.each(["asociado", "secretario"] as const)("un %s es redirigido y no se aplica nada", async (rol) => {
    const { rpc, actualizaciones } = crearSupabaseFalso({ rol });
    const { redirigeA } = await guardar({ motivo: MOTIVO, personas: [{ asociadoId: ANA, nombre: "Ana María Ruiz" }], estados: [] });
    expect(redirigeA).toBe(rol === "secretario" ? "/admin" : "/cuenta");
    expect(rpc).not.toHaveBeenCalled();
    expect(actualizaciones).toHaveLength(0);
  });

  it("un motivo inválido no aplica nada y se devuelve como error del motivo", async () => {
    const { rpc, actualizaciones } = crearSupabaseFalso();
    const { resultado } = await guardar({ motivo: "no", personas: [], estados: [{ solicitudId: SOL_ANA, decision: "rechazado" }] });
    expect(resultado?.errorMotivo).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("guardarCambiosTablaCreditos · cada cambio por su camino", () => {
  it("nombre y celular → admin_editar_datos_asociado, reenviando sin cambio el correo institucional y la nómina", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await guardar({
      motivo: MOTIVO,
      personas: [{ asociadoId: ANA, nombre: "Ana  María Ruiz", telefono: "300 999 8877" }],
      estados: [],
    });
    expect(resultado?.resultados).toEqual([{ clave: `datos:${ANA}`, ok: true }]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_editar_datos_asociado", {
      p_asociado_id: ANA,
      p_nombre: "Ana María Ruiz",
      p_telefono: "3009998877",
      p_correo_institucional: "ana@policia.gov.co",
      p_nomina_entidad: "Bancolombia",
      p_nomina_tipo: "ahorros",
      p_nomina_numero: "12345678",
    });
  });

  it("solo el celular: el nombre se reenvía igual; sin nómina, va vacía", async () => {
    const { rpc } = crearSupabaseFalso();
    await guardar({ motivo: MOTIVO, personas: [{ asociadoId: LUIS, telefono: "" }], estados: [] });
    expect(rpc).toHaveBeenCalledWith(
      "admin_editar_datos_asociado",
      expect.objectContaining({ p_nombre: "Luis Mora", p_telefono: null, p_correo_institucional: null, p_nomina_entidad: null }),
    );
  });

  it("cédula → admin_cambiar_cedula con el motivo; el correo al asociado no lleva el motivo", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await guardar({ motivo: MOTIVO, personas: [{ asociadoId: ANA, cedula: "1234567891" }], estados: [] });
    expect(resultado?.resultados).toEqual([{ clave: `cedula:${ANA}`, ok: true }]);
    expect(rpc).toHaveBeenCalledWith("admin_cambiar_cedula", { p_asociado_id: ANA, p_cedula: "1234567891", p_motivo: MOTIVO });
    expect(avisarCambioCedula).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(avisarCambioCedula).mock.calls)).not.toContain(MOTIVO);
  });

  it("los datos de la persona no mandan correo (y el motivo no viaja en ninguno)", async () => {
    crearSupabaseFalso();
    await guardar({ motivo: MOTIVO, personas: [{ asociadoId: ANA, nombre: "Ana María Ruiz" }], estados: [] });
    expect(enviarResultadoCredito).not.toHaveBeenCalled();
    expect(avisarCambioCedula).not.toHaveBeenCalled();
    expect(avisarCorreoInstitucional).not.toHaveBeenCalled();
  });

  it("rechazar: el motivo del envío es el motivo del rechazo y llega al correo del resultado", async () => {
    const { actualizaciones } = crearSupabaseFalso();
    const { resultado } = await guardar({ motivo: MOTIVO, personas: [], estados: [{ solicitudId: SOL_ANA, decision: "rechazado" }] });
    expect(resultado?.resultados).toEqual([{ clave: `estado:${SOL_ANA}`, ok: true }]);
    expect(actualizaciones).toEqual([{ tabla: "solicitudes_credito", id: SOL_ANA, estado: "rechazado", motivo_rechazo: MOTIVO }]);
    expect(enviarResultadoCredito).toHaveBeenCalledWith(expect.objectContaining({ resultado: "rechazado", motivo: MOTIVO }));
    // RS-02: al institucional, el aviso sin datos.
    expect(JSON.stringify(vi.mocked(avisarCorreoInstitucional).mock.calls)).not.toContain(MOTIVO);
  });

  it("aprobar: limpia el motivo del rechazo y el correo no lleva el motivo", async () => {
    const { actualizaciones } = crearSupabaseFalso();
    await guardar({ motivo: MOTIVO, personas: [], estados: [{ solicitudId: SOL_LUIS, decision: "aprobado" }] });
    expect(actualizaciones[0]).toMatchObject({ id: SOL_LUIS, estado: "aprobado", motivo_rechazo: null });
    expect(vi.mocked(enviarResultadoCredito).mock.calls[0]?.[0]).toMatchObject({ resultado: "aprobado", motivo: undefined });
  });

  it("revalida créditos, la cuenta del asociado y su ficha", async () => {
    crearSupabaseFalso();
    await guardar({ motivo: MOTIVO, personas: [{ asociadoId: ANA, nombre: "Ana María Ruiz" }], estados: [] });
    const rutas = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(rutas).toEqual(expect.arrayContaining(["/admin/creditos", "/cuenta", "/cuenta/perfil", `/admin/asociados/${ANA}`]));
  });
});

describe("guardarCambiosTablaCreditos · una fila con error no detiene las demás", () => {
  it("su propia solicitud y un cliente suyo fallan con mensaje legible; las demás se guardan", async () => {
    const { rpc, actualizaciones } = crearSupabaseFalso();
    const { resultado } = await guardar({
      motivo: MOTIVO,
      personas: [
        { asociadoId: CLIENTE, nombre: "Cliente Corregido" },
        { asociadoId: ANA, nombre: "Ana María Ruiz" },
      ],
      estados: [
        { solicitudId: SOL_PROPIA, decision: "aprobado" },
        { solicitudId: SOL_LUIS, decision: "rechazado" },
      ],
    });
    expect(resultado?.resultados).toEqual([
      { clave: `datos:${CLIENTE}`, ok: false, error: "Es uno de tus clientes: otro administrador debe editar sus datos." },
      { clave: `datos:${ANA}`, ok: true },
      { clave: `estado:${SOL_PROPIA}`, ok: false, error: "No puedes resolver tu propia solicitud; debe hacerlo otro administrador." },
      { clave: `estado:${SOL_LUIS}`, ok: true },
    ]);
    expect(resultado?.mensaje).toBe("2 guardados, 2 con error.");
    expect(rpc).toHaveBeenCalledTimes(1); // solo los datos de Ana
    expect(actualizaciones.map((a) => a.id)).toEqual([SOL_LUIS]);
  });

  it("un error de la base en la cédula se traduce y no detiene la decisión siguiente", async () => {
    crearSupabaseFalso({ erroresRpc: { admin_cambiar_cedula: { code: "23505", message: "duplicate key" } } });
    const { resultado } = await guardar({
      motivo: MOTIVO,
      personas: [{ asociadoId: ANA, cedula: "2234567890" }],
      estados: [{ solicitudId: SOL_ANA, decision: "aprobado" }],
    });
    expect(resultado?.resultados).toEqual([
      { clave: `cedula:${ANA}`, ok: false, error: "Esa cédula ya está registrada en otra cuenta." },
      { clave: `estado:${SOL_ANA}`, ok: true },
    ]);
    expect(resultado?.mensaje).toBe("1 guardado, 1 con error.");
  });

  it("una excepción inesperada en un cambio queda como error de esa fila", async () => {
    const { rpc } = crearSupabaseFalso();
    rpc.mockImplementationOnce(async () => {
      throw new Error("red caída");
    });
    const { resultado } = await guardar({
      motivo: MOTIVO,
      personas: [{ asociadoId: ANA, nombre: "Ana María Ruiz" }],
      estados: [{ solicitudId: SOL_LUIS, decision: "aprobado" }],
    });
    expect(resultado?.resultados?.[0]).toMatchObject({ clave: `datos:${ANA}`, ok: false });
    expect(resultado?.resultados?.[1]).toEqual({ clave: `estado:${SOL_LUIS}`, ok: true });
  });
});
