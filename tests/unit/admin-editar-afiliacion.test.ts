/**
 * Esquema de «Editar datos de la solicitud» (lib/validaciones/afiliacion.ts):
 * mismas reglas del formulario de afiliación, sin asesor, mensaje ni fotos.
 */
import { describe, expect, it } from "vitest";
import type { GradoCatalogo } from "@/lib/gradosCatalogo";
import { crearEsquemaEditarAfiliacion } from "@/lib/validaciones/afiliacion";

const grados: GradoCatalogo[] = [
  { codigo: "PT", nombre: "Patrullero", policia: true, ejercito: false, grupoCredito: null, orden: 1, seleccionable: true },
  { codigo: "SLP", nombre: "Soldado Profesional", policia: false, ejercito: true, grupoCredito: null, orden: 2, seleccionable: true },
] as GradoCatalogo[];

const BASE = {
  id: "11111111-1111-4111-8111-111111111111",
  nombres: " Ana  María ",
  apellidos: "Ruiz",
  cedula: "1.234.567",
  institucion: "policia",
  grado_id: "PT",
  nequi: "300 111 2233",
  celular: "+57 300 111 2233",
  email: "Ana@Gmail.com",
  correo_institucional: "ana.ruiz@policia.gov.co",
  nomina_entidad: "Bancolombia",
  nomina_entidad_otra: "",
  nomina_tipo: "ahorros",
  nomina_numero: "123-456",
};
const esquema = crearEsquemaEditarAfiliacion({ grados });

describe("crearEsquemaEditarAfiliacion", () => {
  it("normaliza y resuelve la nómina", () => {
    const r = esquema.parse(BASE);
    expect(r.nombres).toBe("Ana María");
    expect(r.cedula).toBe("1234567");
    expect(r.celular).toBe("3001112233");
    expect(r.email).toBe("ana@gmail.com");
    expect(r.nomina).toEqual({ entidad: "Bancolombia", tipo: "ahorros", numero: "123456" });
  });

  it("el grado debe corresponder a la institución", () => {
    const r = esquema.safeParse({ ...BASE, institucion: "ejercito", correo_institucional: "ana@buzonejercito.mil.co" });
    expect(r.error?.issues.map((i) => i.path[0])).toContain("grado_id");
    expect(esquema.safeParse({ ...BASE, institucion: "ejercito", grado_id: "SLP", correo_institucional: "ana@buzonejercito.mil.co" }).success).toBe(true);
  });

  it("el correo institucional debe ser del dominio de la institución y distinto del personal", () => {
    expect(esquema.safeParse({ ...BASE, correo_institucional: "ana@gmail.com" }).error?.issues[0].path).toEqual(["correo_institucional"]);
    const iguales = esquema.safeParse({ ...BASE, email: "ana.ruiz@policia.gov.co" });
    expect(iguales.error?.issues.map((i) => i.path[0])).toContain("email");
  });

  it("exige la cuenta de nómina completa y una cédula válida", () => {
    const r = esquema.safeParse({ ...BASE, cedula: "12", nomina_entidad: "", nomina_tipo: "", nomina_numero: "" });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["cedula", "nomina_entidad"]));
  });

  it("no acepta un id que no sea uuid", () => {
    expect(esquema.safeParse({ ...BASE, id: "abc" }).success).toBe(false);
  });
});
