import { describe, expect, it } from "vitest";
import { cargarMetricasAdmin, normalizarMetricasAdmin } from "@/lib/admin/metricas";
import { cargarMetricasAsesor, normalizarMetricasAsesor } from "@/lib/asesor/metricas";
import { VERSION_POLITICA_DATOS } from "@/lib/politica-datos";

const cliente = (data: unknown, error: unknown = null) =>
  ({ rpc: async () => ({ data, error }) }) as never;

describe("métricas del admin", () => {
  it("null (no es admin) => null", () => {
    expect(normalizarMetricasAdmin(null)).toBeNull();
    expect(normalizarMetricasAdmin([])).toBeNull();
  });
  it("convierte el jsonb, con montos en texto y claves faltantes", () => {
    const m = normalizarMetricasAdmin({
      asociados_activos: 12,
      asociados_por_grado: { Mayor: 3, Capitán: "2" },
      monto_solicitado_mes: "1500000",
      creditos_pendientes: 4,
    });
    expect(m?.asociadosActivos).toBe(12);
    expect(m?.asociadosPorGrado).toEqual({ Mayor: 3, Capitán: 2 });
    expect(m?.montoSolicitadoMes).toBe(1500000);
    expect(m?.montoAprobadoMes).toBe(0);
    expect(m?.asociadosPorInstitucion).toEqual({});
  });
  it("el loader devuelve null si la RPC falla", async () => {
    expect(await cargarMetricasAdmin(cliente(null, { message: "x" }))).toBeNull();
    expect((await cargarMetricasAdmin(cliente({ asociados_activos: 1 })))?.asociadosActivos).toBe(1);
  });
});

describe("métricas del asesor", () => {
  it("null (no atiende hoy) => null", () => {
    expect(normalizarMetricasAsesor(null)).toBeNull();
  });
  it("completa los 4 estados de crédito", () => {
    const m = normalizarMetricasAsesor({
      clientes_total: 5,
      clientes_por_estado_credito: { aprobado: 2, sin_solicitud: 3 },
      afiliaciones_por_estado: { pendiente: 1 },
      afiliaciones_referidas_mes: 1,
    });
    expect(m?.clientesPorEstadoCredito).toEqual({ pendiente: 0, aprobado: 2, rechazado: 0, sin_solicitud: 3 });
    expect(m?.afiliacionesPorEstado).toEqual({ pendiente: 1 });
    expect(m?.creditosPendientes).toBe(0);
  });
  it("el loader devuelve null si la RPC falla", async () => {
    expect(await cargarMetricasAsesor(cliente(null, { message: "x" }))).toBeNull();
  });
});

describe("versión de la política", () => {
  it("tiene el formato que exige la base", () => {
    expect(VERSION_POLITICA_DATOS).toMatch(/^\d{1,3}(\.\d{1,3}){0,2}$/);
  });
});
