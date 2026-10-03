import { describe, expect, it } from "vitest";
import {
  describirEventoEquipo,
  formatearCuandoEquipo,
  vistaEventoEquipo,
  type FilaHistorialEquipo,
} from "@/lib/admin/historialEquipoTexto";
import { esquemaFiltrosHistorial, FILAS_HISTORIAL } from "@/lib/validaciones/historialEquipo";

const UUID = "5ec7e7a2-1b9d-4c0e-8a3f-6d2b7c9e4f10";

describe("formatearCuandoEquipo", () => {
  it("usa la hora de Colombia (UTC-5) con el formato «2 oct 2026 10:15»", () => {
    expect(formatearCuandoEquipo("2026-10-02T15:15:00Z")).toBe("2 oct 2026 10:15");
  });
  it("pasa al día anterior cuando en Colombia aún no es medianoche", () => {
    expect(formatearCuandoEquipo("2026-10-03T03:30:00Z")).toBe("2 oct 2026 22:30");
  });
  it("devuelve vacío si la fecha no es válida", () => {
    expect(formatearCuandoEquipo("nada")).toBe("");
  });
});

describe("describirEventoEquipo", () => {
  const d = (tipo: string, objetivo: string, detalle: string | null, extra: string | null = null) =>
    describirEventoEquipo({ tipo, objetivo, detalle, extra });

  it("afiliaciones", () => {
    expect(d("afiliacion", "Juan Pérez", "aprobada")).toBe("Aprobó la afiliación de Juan Pérez");
    expect(d("afiliacion", "Juan Pérez", "rechazada")).toBe("Rechazó la afiliación de Juan Pérez");
    expect(d("afiliacion", "Juan Pérez", "contactado")).toBe("Marcó como contactada la afiliación de Juan Pérez");
  });
  it("proceso ejecutivo, con la fecha de embargo si la hay", () => {
    expect(d("proceso", "Ana", "operando", "2026-10-02")).toBe(
      "Cambió el proceso ejecutivo de Ana a «Operando» (inicio del embargo: 2 oct 2026)",
    );
    expect(d("proceso", "Ana", "mandamiento_de_pago")).toBe("Cambió el proceso ejecutivo de Ana a «Mandamiento de pago»");
  });
  it("asignaciones de asesor", () => {
    expect(d("asesor", "Ana", "Pedro Asesor")).toBe("Asignó a Pedro Asesor como asesor de Ana");
    expect(d("asesor", "Ana", "Luis", "Pedro")).toBe("Cambió el asesor de Ana: de Pedro a Luis");
    expect(d("asesor", "Ana", null, "Pedro")).toBe("Quitó a Pedro como asesor de Ana");
    expect(d("asesor", "Ana", null, null)).toBe("Cambió el asesor de Ana");
  });
  it("cambios de rol", () => {
    expect(d("rol", "Nuria", "secretario", "asociado")).toBe("Creó a Nuria como secretario");
    expect(d("rol", "Nuria", "asesor", "secretario")).toBe("Cambió el rol de Nuria de secretario a asesor");
  });
  it("bajas y desactivaciones", () => {
    expect(d("estado", "Ana", "false", "asociado")).toBe("Dio de baja a Ana");
    expect(d("estado", "Ana", "true", "asociado")).toBe("Reactivó a Ana");
    expect(d("estado", "Nuria", "false", "secretario")).toBe("Desactivó a Nuria (secretario)");
    expect(d("estado", "Nuria", "true", "secretario")).toBe("Reactivó a Nuria (secretario)");
  });
  it("créditos", () => {
    expect(d("credito", "Ana", "aprobado")).toBe("Aprobó el crédito de Ana");
    expect(d("credito", "Ana", "rechazado")).toBe("Rechazó el crédito de Ana");
    expect(d("credito", "Ana", "desembolsado")).toBe("Marcó como desembolsado el crédito de Ana");
    expect(d("credito", "Ana", "credito_habilitado")).toBe("Habilitó un nuevo crédito a Ana");
  });
  it("un tipo desconocido no rompe", () => {
    expect(d("otro", "Ana", null)).toBe("Hizo un cambio sobre Ana");
  });
});

describe("vistaEventoEquipo", () => {
  it("arma autor, rol, frase, fecha y motivo", () => {
    const fila: FilaHistorialEquipo = {
      cuando: "2026-10-02T15:15:00Z",
      actor_id: UUID,
      actor_nombre: "Sofía Secretaria",
      actor_rol: "secretario",
      tipo: "afiliacion",
      objetivo: "Juan Pérez",
      detalle: "aprobada",
      extra: null,
      motivo: null,
      total: "30",
    };
    expect(vistaEventoEquipo(fila)).toMatchObject({
      actorNombre: "Sofía Secretaria",
      actorRol: "Secretario",
      descripcion: "Aprobó la afiliación de Juan Pérez",
      cuando: "2 oct 2026 10:15",
      motivo: null,
    });
  });
});

describe("esquemaFiltrosHistorial", () => {
  it("sin nada: página 1 y sin filtros", () => {
    expect(esquemaFiltrosHistorial.parse({})).toEqual({ persona: undefined, desde: undefined, hasta: undefined, pagina: 1 });
  });
  it("acepta persona, fechas y página", () => {
    expect(esquemaFiltrosHistorial.parse({ persona: UUID, desde: "2026-10-01", hasta: "2026-10-31", pagina: "3" })).toEqual({
      persona: UUID,
      desde: "2026-10-01",
      hasta: "2026-10-31",
      pagina: 3,
    });
  });
  it("ignora (no falla) valores inválidos", () => {
    const r = esquemaFiltrosHistorial.parse({ persona: "no-es-uuid", desde: "ayer", hasta: "2026-02-30", pagina: "-4" });
    expect(r).toEqual({ persona: undefined, desde: undefined, hasta: undefined, pagina: 1 });
  });
  it("intercambia las fechas si vienen al revés", () => {
    const r = esquemaFiltrosHistorial.parse({ desde: "2026-10-31", hasta: "2026-10-01" });
    expect(r.desde).toBe("2026-10-01");
    expect(r.hasta).toBe("2026-10-31");
  });
  it("la página trae 25 filas", () => {
    expect(FILAS_HISTORIAL).toBe(25);
  });
});
