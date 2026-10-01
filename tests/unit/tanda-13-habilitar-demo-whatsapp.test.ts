import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const registrar = vi.fn();
vi.mock("@/lib/servidor/registro", () => ({ registrar: (...a: unknown[]) => registrar(...a) }));

const rpc = vi.fn();
const perfilFila = { nombre_completo: "Ana Pérez", cedula: "1014256789", correo_institucional: "ana@policia.gov.co" };
const supabase = {
  rpc: (...a: unknown[]) => rpc(...a),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: perfilFila }) }) }) }),
};
vi.mock("@/lib/admin/servidor", () => ({ exigirAdmin: vi.fn(async () => ({ supabase, userId: "admin-1" })) }));
vi.mock("@/lib/ingreso/servidor", () => ({ correoDeCedula: vi.fn(async () => "ana.personal@gmail.com") }));
const enviarCreditoHabilitado = vi.fn(async () => {});
vi.mock("@/lib/correo/credito", () => ({ enviarCreditoHabilitado: (...a: unknown[]) => enviarCreditoHabilitado(...(a as [])) }));
const avisarInstitucional = vi.fn(async () => {});
vi.mock("@/lib/correo/institucional", () => ({ avisarCorreoInstitucional: (...a: unknown[]) => avisarInstitucional(...(a as [])) }));

import { habilitarCredito } from "@/app/admin/asociados/actions";
import { esquemaHabilitarCredito } from "@/lib/validaciones/admin";
import { normalizarMetricasAdmin } from "@/lib/admin/metricas";
import { normalizarMetricasAsesor } from "@/lib/asesor/metricas";
import { INSTITUCIONES_DEMO, gradosDemoDeInstitucion, paquetesDeGradoDemo, type PaqueteDemo } from "@/lib/asesor/datosDemo";
import type { GradoCatalogo } from "@/lib/gradosCatalogo";
import { MENSAJE_WHATSAPP_PIE, enlaceWhatsappConMensaje, WHATSAPP_URL_PIE } from "@/lib/config";

const ID = "00000000-0000-4000-a000-000000000031";
function formulario(valores: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(valores)) f.set(k, v);
  return f;
}

describe("esquemaHabilitarCredito (§13.2)", () => {
  it("acepta un uuid y un motivo de 5 a 300 caracteres (con espacios normalizados)", () => {
    const r = esquemaHabilitarCredito.safeParse({ asociadoId: ID, motivo: "  Ya  pagó   la deuda " });
    expect(r.success && r.data.motivo).toBe("Ya pagó la deuda");
    expect(esquemaHabilitarCredito.safeParse({ asociadoId: ID, motivo: "a".repeat(300) }).success).toBe(true);
  });
  it("rechaza motivo corto, largo o vacío y un id que no es uuid", () => {
    expect(esquemaHabilitarCredito.safeParse({ asociadoId: ID, motivo: "abcd" }).success).toBe(false);
    expect(esquemaHabilitarCredito.safeParse({ asociadoId: ID, motivo: "a".repeat(301) }).success).toBe(false);
    expect(esquemaHabilitarCredito.safeParse({ asociadoId: ID, motivo: "" }).success).toBe(false);
    expect(esquemaHabilitarCredito.safeParse({ asociadoId: "x", motivo: "motivo válido" }).success).toBe(false);
  });
});

describe("habilitarCredito (acción del admin)", () => {
  beforeEach(() => {
    rpc.mockReset();
    enviarCreditoHabilitado.mockClear();
    avisarInstitucional.mockClear();
    registrar.mockClear();
  });

  it("motivo inválido: error por campo y no llama a la base", async () => {
    const r = await habilitarCredito({}, formulario({ asociadoId: ID, motivo: "no" }));
    expect(r.errores?.motivo).toContain("5 y 300");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("éxito: llama a la RPC, avisa al personal y al institucional (sin motivo) y reporta bloqueos pendientes", async () => {
    rpc.mockResolvedValue({ data: [{ bloqueos: ["no_operando"] }], error: null });
    const r = await habilitarCredito({}, formulario({ asociadoId: ID, motivo: "Se aclaró el caso" }));
    expect(rpc).toHaveBeenCalledWith("admin_habilitar_credito", { p_asociado_id: ID, p_motivo: "Se aclaró el caso" });
    expect(r.mensaje).toContain("Crédito habilitado");
    expect(r.pendientes).toEqual(["su proceso ejecutivo aún no está en «Operando»"]);
    expect(enviarCreditoHabilitado).toHaveBeenCalledWith({ id: ID, nombre: "Ana Pérez", correo: ["ana.personal@gmail.com"] });
    expect(JSON.stringify(enviarCreditoHabilitado.mock.calls)).not.toContain("Se aclaró");
    expect(avisarInstitucional).toHaveBeenCalledWith("ana.personal@gmail.com", "ana@policia.gov.co");
  });

  it("sin bloqueos: mensaje de que ya puede pedir", async () => {
    rpc.mockResolvedValue({ data: [{ bloqueos: [] }], error: null });
    const r = await habilitarCredito({}, formulario({ asociadoId: ID, motivo: "Se aclaró el caso" }));
    expect(r.mensaje).toContain("Ya puede hacer una nueva solicitud");
  });

  it("error conocido de la base se muestra; uno desconocido es genérico y se registra; sin correos", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Este rechazo ya fue habilitado", code: "P0001" } });
    const a = await habilitarCredito({}, formulario({ asociadoId: ID, motivo: "Se aclaró el caso" }));
    expect(a.error).toBe("Este rechazo ya fue habilitado.");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom interno", code: "XX" } });
    const b = await habilitarCredito({}, formulario({ asociadoId: ID, motivo: "Se aclaró el caso" }));
    expect(b.error).toBe("No pudimos guardar el cambio. Intenta de nuevo.");
    expect(registrar).toHaveBeenCalledWith("error", expect.objectContaining({ evento: "admin_habilitar_credito_fallo" }));
    expect(enviarCreditoHabilitado).not.toHaveBeenCalled();
  });
});

describe("loaders de dashboards (§13.3 / D-22, D-23)", () => {
  it("admin: por_estado_proceso y desembolsos_mes; faltantes => vacío / ceros", () => {
    const m = normalizarMetricasAdmin({
      por_estado_proceso: { operando: 4, sin_proceso: "2" },
      desembolsos_mes: { conteo: 3, monto: "4500000" },
    });
    expect(m?.porEstadoProceso).toEqual({ operando: 4, sin_proceso: 2 });
    expect(m?.desembolsosMes).toEqual({ conteo: 3, monto: 4500000 });
    const vacio = normalizarMetricasAdmin({});
    expect(vacio?.porEstadoProceso).toEqual({});
    expect(vacio?.desembolsosMes).toEqual({ conteo: 0, monto: 0 });
  });
  it("asesor: por_estado_proceso", () => {
    expect(normalizarMetricasAsesor({ por_estado_proceso: { reparto: 1 } })?.porEstadoProceso).toEqual({ reparto: 1 });
    expect(normalizarMetricasAsesor({})?.porEstadoProceso).toEqual({});
  });
});

describe("demo Policía / Ejército (§13.3)", () => {
  const g = (codigo: string, p: boolean, e: boolean, grupo: GradoCatalogo["grupoCredito"], orden: number): GradoCatalogo => ({
    codigo, nombre: codigo + " nombre", policia: p, ejercito: e, grupoCredito: grupo, orden, seleccionable: true,
  });
  const catalogo = [g("PP", true, false, "PP", 1), g("SLP", false, true, null, 2), g("TE", true, true, "IJ", 3)];
  const pq = (m: number): PaqueteDemo[] => [{ porcentaje: "50", capacidad_maxima: m, tasa_interes_mensual: 0.01, plazo_meses: 3 }];
  const porGrupo = { PP: pq(1), IJ: pq(2) } as never;

  it("ofrece las dos instituciones y filtra los grados por institución", () => {
    expect(INSTITUCIONES_DEMO.map((i) => i.codigo)).toEqual(["policia", "ejercito"]);
    expect(gradosDemoDeInstitucion(catalogo, "policia").map((x) => x.codigo)).toEqual(["PP", "TE"]);
    expect(gradosDemoDeInstitucion(catalogo, "ejercito").map((x) => x.codigo)).toEqual(["SLP", "TE"]);
  });
  it("el cupo sale del grupo del grado; sin grupo = sin cupo", () => {
    expect(paquetesDeGradoDemo(catalogo, porGrupo, "PP")[0].capacidad_maxima).toBe(1);
    expect(paquetesDeGradoDemo(catalogo, porGrupo, "TE")[0].capacidad_maxima).toBe(2);
    expect(paquetesDeGradoDemo(catalogo, porGrupo, "SLP")).toEqual([]);
    expect(paquetesDeGradoDemo(catalogo, null, "PP")).toEqual([]);
  });
});

describe("WhatsApp del pie (§13.1)", () => {
  it("enlace wa.me con +57 y mensaje corto codificado", () => {
    expect(enlaceWhatsappConMensaje("3183894034", "Hola, quiero info")).toBe("https://wa.me/573183894034?text=Hola%2C%20quiero%20info");
    expect(enlaceWhatsappConMensaje("123", "x")).toBeNull();
    expect(WHATSAPP_URL_PIE).toContain(encodeURIComponent(MENSAJE_WHATSAPP_PIE));
  });
});
