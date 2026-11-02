/**
 * «Nuevo crédito» (buscarAsociadoPorCedula + crearCreditoAdmin, app/admin/creditos/actions.ts)
 * y «Corregir cédula» (cambiarCedulaAsociado, app/admin/asociados/cedula-actions.ts),
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
vi.mock("@/lib/correo/credito", () => ({
  enviarCreditoAsignado: vi.fn(async () => {}),
  enviarResultadoCredito: vi.fn(async () => {}),
  enviarCondicionesCredito: vi.fn(async () => {}),
  enviarDesembolsoCredito: vi.fn(async () => {}),
}));
vi.mock("@/lib/correo/cedula", () => ({ avisarCambioCedula: vi.fn(async () => {}) }));
vi.mock("@/lib/correo/institucional", () => ({ avisarCorreoInstitucional: vi.fn(async () => {}) }));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn(async () => true) }));
vi.mock("@/lib/grados", () => ({
  cupoCreditoDelGrado: vi.fn(async () => ({
    estado: "con_cupo",
    codigo: "PT",
    nombre: "Patrullero",
    grupo: "PT",
    paquetes: [
      { porcentaje: "50", capacidad_maxima: 1000000, plazo_meses: 3 },
      { porcentaje: "100", capacidad_maxima: 2000000, plazo_meses: 3 },
    ],
  })),
}));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarCreditoAsignado } from "@/lib/correo/credito";
import { avisarCambioCedula } from "@/lib/correo/cedula";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { buscarAsociadoPorCedula, crearCreditoAdmin } from "@/app/admin/creditos/actions";
import { cambiarCedulaAsociado } from "@/app/admin/asociados/cedula-actions";
import { esquemaCambiarCedula, esquemaCrearCreditoAdmin } from "@/lib/validaciones/admin";

const ID_ADMIN = "00000000-0000-4000-a000-000000000010";
const ID_ASOCIADO = "00000000-0000-4000-a000-000000000011";
const ID_SOLICITUD = "00000000-0000-4000-a000-000000000012";
const ID_CONVENIO = "00000000-0000-4000-a000-000000000013";
const MOTIVO = "Acuerdo con la gerencia";

type Escenario = {
  rol?: "admin" | "secretario" | "asociado";
  /** Perfil que encuentra la búsqueda por cédula (null = no existe). */
  buscado?: Record<string, unknown> | null;
  estadoProceso?: string | null;
  pendientes?: number;
  asesorDelAsociado?: string | null;
  errorRpc?: { code?: string; message: string } | null;
};

function crearSupabaseFalso(escenario: Escenario = {}) {
  const {
    rol = "admin",
    buscado = { id: ID_ASOCIADO, nombre_completo: "Ana Ruiz", cedula: "1234567890", grado: "PT", rol: "asociado", activo: true, eliminado_at: null },
    estadoProceso = "operando",
    pendientes = 0,
    asesorDelAsociado = null,
    errorRpc = null,
  } = escenario;

  const rpc = vi.fn(async () => (errorRpc ? { data: null, error: errorRpc } : { data: ID_SOLICITUD, error: null }));

  const from = vi.fn((tabla: string) => {
    const filtros: Record<string, unknown> = {};
    const resultado = () => {
      if (tabla === "perfiles") {
        if (filtros.id === ID_ADMIN) return { data: { rol, nombre_completo: "Admin", activo: true }, error: null };
        if ("cedula" in filtros) return { data: buscado, error: null };
        return {
          data: {
            nombre_completo: "Ana Ruiz",
            cedula: "1234567890",
            correo_institucional: "ana@policia.gov.co",
            rol: "asociado",
            asesor_id: asesorDelAsociado,
            eliminado_at: null,
          },
          error: null,
        };
      }
      if (tabla === "procesos_ejecutivos") return { data: estadoProceso ? { estado: estadoProceso } : null, error: null };
      if (tabla === "solicitudes_credito") return { data: Array.from({ length: pendientes }, () => ({ id: ID_SOLICITUD })), error: null };
      if (tabla === "convenios") return { data: { nombre_empresa: "Óptica Sol" }, error: null };
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
    consulta.limit = vi.fn(async () => resultado());
    return consulta;
  });

  const cliente = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: ID_ADMIN } }, error: null })) },
    from,
    rpc,
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { rpc };
}

function formulario(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

/** Ejecuta la acción y convierte la redirección simulada en dato. */
async function ejecutar<T>(accion: () => Promise<T>) {
  try {
    return { resultado: await accion(), redirigeA: null as string | null };
  } catch (e) {
    if (e instanceof RedireccionSimulada) return { resultado: null, redirigeA: e.ruta };
    throw e;
  }
}

const CREDITO = {
  asociadoId: ID_ASOCIADO,
  monto: "2.500.000",
  totalAPagar: "3.000.000",
  plazoMeses: "6",
  porcentaje: "80",
  tipoCredito: "cooperativa",
  convenioId: "",
  motivo: MOTIVO,
};

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(correoDeCedula).mockClear();
  vi.mocked(enviarCreditoAsignado).mockClear();
  vi.mocked(avisarCambioCedula).mockClear();
  vi.mocked(avisarCorreoInstitucional).mockClear();
  vi.mocked(dentroDelLimite).mockClear();
});

describe("esquemaCrearCreditoAdmin", () => {
  it("lee los pesos y los enteros; sin convenio en un crédito de cooperativa", () => {
    expect(esquemaCrearCreditoAdmin.parse({ ...CREDITO, convenioId: ID_CONVENIO })).toMatchObject({
      asociadoId: ID_ASOCIADO,
      monto: 2500000,
      totalAPagar: 3000000,
      plazoMeses: 6,
      porcentaje: 80,
      convenioId: null,
    });
  });

  it("exige el asociado buscado", () => {
    const r = esquemaCrearCreditoAdmin.safeParse({ ...CREDITO, asociadoId: "" });
    expect(r.error?.issues[0].path).toEqual(["asociadoId"]);
  });

  it.each(["49", "101", "80.5"])("rechaza el porcentaje %j", (porcentaje) => {
    expect(esquemaCrearCreditoAdmin.safeParse({ ...CREDITO, porcentaje }).success).toBe(false);
  });

  it("un convenio exige la empresa y lo que devuelve no puede ser menor", () => {
    expect(esquemaCrearCreditoAdmin.safeParse({ ...CREDITO, tipoCredito: "convenio" }).success).toBe(false);
    expect(esquemaCrearCreditoAdmin.safeParse({ ...CREDITO, totalAPagar: "1000000" }).success).toBe(false);
  });
});

describe("esquemaCambiarCedula", () => {
  it("normaliza la cédula (puntos y espacios) y el motivo", () => {
    expect(esquemaCambiarCedula.parse({ asociadoId: ID_ASOCIADO, cedula: "1.234.567 890", motivo: "  Error   de digitación " })).toEqual({
      asociadoId: ID_ASOCIADO,
      cedula: "1234567890",
      motivo: "Error de digitación",
    });
  });

  it.each(["12345", "12345678901", "12a4567", ""])("rechaza la cédula %j", (cedula) => {
    const r = esquemaCambiarCedula.safeParse({ asociadoId: ID_ASOCIADO, cedula, motivo: MOTIVO });
    expect(r.error?.issues[0].path).toEqual(["cedula"]);
  });

  it("exige motivo de 5 a 300 caracteres", () => {
    expect(esquemaCambiarCedula.safeParse({ asociadoId: ID_ASOCIADO, cedula: "1234567", motivo: "ok" }).success).toBe(false);
  });
});

describe("buscarAsociadoPorCedula", () => {
  it("quien no es admin es redirigido (el secretario, a su resumen)", async () => {
    crearSupabaseFalso({ rol: "asociado" });
    expect((await ejecutar(() => buscarAsociadoPorCedula({}, formulario({ cedula: "1234567890" })))).redirigeA).toBe("/cuenta");
    crearSupabaseFalso({ rol: "secretario" });
    expect((await ejecutar(() => buscarAsociadoPorCedula({}, formulario({ cedula: "1234567890" })))).redirigeA).toBe("/admin");
  });

  it("muestra nombre, grado, proceso y cupo al 50 % y 100 %", async () => {
    crearSupabaseFalso();
    const { resultado } = await ejecutar(() => buscarAsociadoPorCedula({}, formulario({ cedula: "1.234.567.890" })));
    expect(resultado?.asociado).toMatchObject({
      id: ID_ASOCIADO,
      nombre: "Ana Ruiz",
      grado: "Patrullero",
      grupo: "PT",
      proceso: "Operando",
      cupo50: 1000000,
      cupo100: 2000000,
      bloqueos: [],
    });
  });

  it("avisa de antemano lo que la base rechazaría", async () => {
    crearSupabaseFalso({ estadoProceso: "sentencia", pendientes: 1 });
    const { resultado } = await ejecutar(() => buscarAsociadoPorCedula({}, formulario({ cedula: "1234567890" })));
    expect(resultado?.asociado?.bloqueos).toHaveLength(2);
  });

  it("cédula inválida o sin asociado: error claro", async () => {
    crearSupabaseFalso({ buscado: null });
    expect((await ejecutar(() => buscarAsociadoPorCedula({}, formulario({ cedula: "12" })))).resultado?.error).toBeTruthy();
    const { resultado } = await ejecutar(() => buscarAsociadoPorCedula({}, formulario({ cedula: "1234567890" })));
    expect(resultado?.error).toBe("No encontramos un asociado con esa cédula.");
  });
});

describe("crearCreditoAdmin", () => {
  it("quien no es admin es redirigido y no se llama la RPC", async () => {
    const { rpc } = crearSupabaseFalso({ rol: "asociado" });
    const { redirigeA } = await ejecutar(() => crearCreditoAdmin({}, formulario(CREDITO)));
    expect(redirigeA).toBe("/cuenta");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("datos inválidos: errores por campo, sin RPC", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await ejecutar(() => crearCreditoAdmin({}, formulario({ ...CREDITO, porcentaje: "40", motivo: "" })));
    expect(resultado?.errores).toMatchObject({ porcentaje: expect.any(String), motivo: expect.any(String) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("nadie se crea un crédito a sí mismo", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await ejecutar(() => crearCreditoAdmin({}, formulario({ ...CREDITO, asociadoId: ID_ADMIN })));
    expect(resultado?.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("llama admin_crear_credito con los parámetros exactos y revalida", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await ejecutar(() =>
      crearCreditoAdmin({}, formulario({ ...CREDITO, tipoCredito: "convenio", convenioId: ID_CONVENIO })),
    );
    expect(resultado?.mensaje).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("admin_crear_credito", {
      p_asociado_id: ID_ASOCIADO,
      p_monto: 2500000,
      p_total_a_pagar: 3000000,
      p_plazo_meses: 6,
      p_porcentaje: 80,
      p_tipo: "convenio",
      p_convenio_id: ID_CONVENIO,
      p_motivo: MOTIVO,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/creditos");
    expect(revalidatePath).toHaveBeenCalledWith("/cuenta");
    expect(revalidatePath).toHaveBeenCalledWith("/cuenta/perfil");
  });

  it("el correo va solo al personal y nunca lleva el motivo ni lo que devuelve", async () => {
    crearSupabaseFalso();
    await ejecutar(() => crearCreditoAdmin({}, formulario(CREDITO)));
    expect(enviarCreditoAsignado).toHaveBeenCalledTimes(1);
    const [datos] = vi.mocked(enviarCreditoAsignado).mock.calls[0];
    expect(datos).toMatchObject({ correo: ["asociado@correo.test"], monto: 2500000, plazoMeses: 6, porcentaje: 80, tipo: "Cooperativa" });
    const texto = JSON.stringify(datos);
    expect(texto).not.toContain(MOTIVO);
    expect(texto).not.toContain("3000000");
    // Al institucional, solo el aviso sin datos.
    expect(JSON.stringify(vi.mocked(avisarCorreoInstitucional).mock.calls[0])).not.toContain(MOTIVO);
  });

  it("traduce los errores conocidos de la base y oculta los demás", async () => {
    crearSupabaseFalso({ errorRpc: { code: "P0001", message: "El asociado ya tiene una solicitud de crédito pendiente; resuélvela primero" } });
    const conocido = await ejecutar(() => crearCreditoAdmin({}, formulario(CREDITO)));
    expect(conocido.resultado?.error).toBe("El asociado ya tiene una solicitud de crédito pendiente; resuélvela primero.");
    expect(enviarCreditoAsignado).not.toHaveBeenCalled();

    crearSupabaseFalso({ errorRpc: { code: "XX000", message: "detalle interno con datos" } });
    const otro = await ejecutar(() => crearCreditoAdmin({}, formulario(CREDITO)));
    expect(otro.resultado?.error).toBe("No pudimos crear el crédito. Intenta de nuevo.");
  });
});

describe("cambiarCedulaAsociado", () => {
  const CAMBIO = { asociadoId: ID_ASOCIADO, cedula: "98.765.432", motivo: MOTIVO };

  it("quien no es admin es redirigido y no se llama la RPC", async () => {
    const { rpc } = crearSupabaseFalso({ rol: "secretario" });
    const { redirigeA } = await ejecutar(() => cambiarCedulaAsociado({}, formulario(CAMBIO)));
    expect(redirigeA).toBe("/admin");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cédula inválida: error en el campo, sin RPC", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await ejecutar(() => cambiarCedulaAsociado({}, formulario({ ...CAMBIO, cedula: "12ab" })));
    expect(resultado?.errores?.cedula).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ni la propia ni la de sus clientes (RS-01)", async () => {
    const propio = crearSupabaseFalso();
    await ejecutar(() => cambiarCedulaAsociado({}, formulario({ ...CAMBIO, asociadoId: ID_ADMIN })));
    expect(propio.rpc).not.toHaveBeenCalled();
    const cliente = crearSupabaseFalso({ asesorDelAsociado: ID_ADMIN });
    const { resultado } = await ejecutar(() => cambiarCedulaAsociado({}, formulario(CAMBIO)));
    expect(resultado?.error).toContain("otro administrador");
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("llama admin_cambiar_cedula con la cédula normalizada y avisa sin el motivo", async () => {
    const { rpc } = crearSupabaseFalso();
    const { resultado } = await ejecutar(() => cambiarCedulaAsociado({}, formulario(CAMBIO)));
    expect(resultado?.mensaje).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("admin_cambiar_cedula", { p_asociado_id: ID_ASOCIADO, p_cedula: "98765432", p_motivo: MOTIVO });
    // El correo personal se busca con la cédula NUEVA (la base ya la guardó).
    expect(correoDeCedula).toHaveBeenCalledWith("98765432");
    expect(avisarCambioCedula).toHaveBeenCalledWith(expect.objectContaining({ correo: ["asociado@correo.test"], cedula: "98765432" }));
    expect(JSON.stringify(vi.mocked(avisarCambioCedula).mock.calls[0])).not.toContain(MOTIVO);
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/asociados/${ID_ASOCIADO}`);
  });

  it("cédula repetida (índice único): error en el campo y sin correo", async () => {
    crearSupabaseFalso({ errorRpc: { code: "23505", message: "duplicate key value violates unique constraint" } });
    const { resultado } = await ejecutar(() => cambiarCedulaAsociado({}, formulario(CAMBIO)));
    expect(resultado?.errores?.cedula).toBeTruthy();
    expect(avisarCambioCedula).not.toHaveBeenCalled();
  });

  it("respeta el límite de frecuencia", async () => {
    const { rpc } = crearSupabaseFalso();
    vi.mocked(dentroDelLimite).mockResolvedValueOnce(false);
    const { resultado } = await ejecutar(() => cambiarCedulaAsociado({}, formulario(CAMBIO)));
    expect(resultado?.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
