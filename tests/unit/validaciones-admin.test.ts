/**
 * Casos válidos e inválidos de los esquemas zod de /admin (lib/validaciones/admin.ts).
 */
import { describe, expect, it } from "vitest";
import {
  esquemaAprobarAfiliacion,
  esquemaAsignarAsesor,
  esquemaCambiarEstadoAfiliacion,
  esquemaCrearAsesor,
  esquemaResolverCredito,
} from "@/lib/validaciones/admin";

describe("esquemaCambiarEstadoAfiliacion", () => {
  it.each(["contactado", "rechazada"])("acepta el estado %s con un id válido", (estado) => {
    const r = esquemaCambiarEstadoAfiliacion.safeParse({ id: "00000000-0000-4000-a000-000000000001", estado });
    expect(r.success).toBe(true);
  });

  it.each(["pendiente", "aprobada", "", "otro"])("rechaza el estado %j (no lo maneja este esquema)", (estado) => {
    const r = esquemaCambiarEstadoAfiliacion.safeParse({ id: "00000000-0000-4000-a000-000000000001", estado });
    expect(r.success).toBe(false);
  });

  it("rechaza un id que no es uuid", () => {
    const r = esquemaCambiarEstadoAfiliacion.safeParse({ id: "no-es-uuid", estado: "contactado" });
    expect(r.success).toBe(false);
  });
});

describe("esquemaAprobarAfiliacion", () => {
  it("acepta un uuid", () => {
    expect(esquemaAprobarAfiliacion.safeParse({ id: "00000000-0000-4000-a000-000000000001" }).success).toBe(true);
  });
  it("rechaza sin id", () => {
    expect(esquemaAprobarAfiliacion.safeParse({}).success).toBe(false);
  });
});

describe("esquemaAsignarAsesor (P-96)", () => {
  const id = "00000000-0000-4000-a000-000000000003";
  const asesorId = "00000000-0000-4000-a000-000000000004";

  it("acepta dos uuid válidos", () => {
    expect(esquemaAsignarAsesor.safeParse({ id, asesorId }).success).toBe(true);
  });

  it("rechaza sin id de la solicitud", () => {
    expect(esquemaAsignarAsesor.safeParse({ asesorId }).success).toBe(false);
  });

  it("rechaza sin id del asesor", () => {
    expect(esquemaAsignarAsesor.safeParse({ id }).success).toBe(false);
  });

  it.each(["", "no-es-uuid", "123"])("rechaza un id de solicitud inválido (%j)", (idInvalido) => {
    expect(esquemaAsignarAsesor.safeParse({ id: idInvalido, asesorId }).success).toBe(false);
  });

  it.each(["", "no-es-uuid", "123"])("rechaza un id de asesor inválido (%j)", (asesorIdInvalido) => {
    expect(esquemaAsignarAsesor.safeParse({ id, asesorId: asesorIdInvalido }).success).toBe(false);
  });
});

describe("esquemaResolverCredito", () => {
  const id = "00000000-0000-4000-a000-000000000002";

  it("acepta aprobado sin motivo", () => {
    const r = esquemaResolverCredito.safeParse({ id, decision: "aprobado" });
    expect(r.success).toBe(true);
  });

  it("rechaza rechazado sin motivo (P-06: el motivo es obligatorio al rechazar)", () => {
    const r = esquemaResolverCredito.safeParse({ id, decision: "rechazado" });
    expect(r.success).toBe(false);
  });

  it("rechaza rechazado con motivo vacío o solo espacios", () => {
    expect(esquemaResolverCredito.safeParse({ id, decision: "rechazado", motivo: "" }).success).toBe(false);
    expect(esquemaResolverCredito.safeParse({ id, decision: "rechazado", motivo: "   " }).success).toBe(false);
  });

  it("rechaza un motivo demasiado corto (< 3 caracteres)", () => {
    expect(esquemaResolverCredito.safeParse({ id, decision: "rechazado", motivo: "no" }).success).toBe(false);
  });

  it("acepta rechazado con un motivo válido", () => {
    const r = esquemaResolverCredito.safeParse({ id, decision: "rechazado", motivo: "No cumple los requisitos." });
    expect(r.success).toBe(true);
  });

  it("rechaza una decisión que no es aprobado/rechazado", () => {
    expect(esquemaResolverCredito.safeParse({ id, decision: "pendiente" }).success).toBe(false);
  });
});

describe("esquemaCrearAsesor", () => {
  const base = { cedula: "1234567890", nombres: "Juan Carlos", apellidos: "Pérez Gómez", correo: "juan@correo.com" };

  it("acepta datos válidos y normaliza (trim, minúsculas en correo)", () => {
    const r = esquemaCrearAsesor.safeParse({ ...base, correo: "  JUAN@CORREO.COM  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.correo).toBe("juan@correo.com");
  });

  it.each(["", "123", "12345678901", "abc1234567"])("rechaza la cédula %j", (cedula) => {
    expect(esquemaCrearAsesor.safeParse({ ...base, cedula }).success).toBe(false);
  });

  it.each(["", "J", "Juan1", "Juan-Carlos"])("rechaza nombres inválidos (%j)", (nombres) => {
    expect(esquemaCrearAsesor.safeParse({ ...base, nombres }).success).toBe(false);
  });

  it("acepta nombres con tildes y ñ", () => {
    expect(esquemaCrearAsesor.safeParse({ ...base, nombres: "José Ñañez" }).success).toBe(true);
  });

  it.each(["", "no-es-correo", "sin-arroba.com"])("rechaza el correo %j", (correo) => {
    expect(esquemaCrearAsesor.safeParse({ ...base, correo }).success).toBe(false);
  });
});
