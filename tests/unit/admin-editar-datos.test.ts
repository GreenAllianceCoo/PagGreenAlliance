/**
 * Esquema de «Editar datos» del asociado (lib/validaciones/admin.ts):
 * nombre, celular, correo institucional (dominio de su institución) y cuenta
 * de nómina en cascada (mismas reglas que la afiliación).
 */
import { describe, expect, it } from "vitest";
import { crearEsquemaEditarDatosAsociado } from "@/lib/validaciones/admin";

const ID = "11111111-1111-4111-8111-111111111111";
const BASE = {
  asociadoId: ID,
  nombre: "  Ana   María Ruiz ",
  telefono: "+57 300 123 4567",
  correoInstitucional: "",
  nomina_entidad: "",
  nomina_entidad_otra: "",
  nomina_tipo: "",
  nomina_numero: "",
};
const policia = crearEsquemaEditarDatosAsociado("policia");

describe("crearEsquemaEditarDatosAsociado", () => {
  it("normaliza nombre y celular; vacíos quedan en null", () => {
    const r = policia.parse(BASE);
    expect(r.nombre).toBe("Ana María Ruiz");
    expect(r.telefono).toBe("3001234567");
    expect(r.correoInstitucional).toBeNull();
    expect(r.nomina).toBeNull();
    expect(policia.parse({ ...BASE, telefono: "" }).telefono).toBeNull();
  });

  it("rechaza nombre con números y celular inválido", () => {
    const r = policia.safeParse({ ...BASE, nombre: "Ana 2", telefono: "2001234567" });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["nombre", "telefono"]));
  });

  it("el correo institucional debe ser del dominio de su institución", () => {
    expect(policia.safeParse({ ...BASE, correoInstitucional: "Ana@Policia.gov.co" }).data?.correoInstitucional).toBe(
      "ana@policia.gov.co",
    );
    const malo = policia.safeParse({ ...BASE, correoInstitucional: "ana@gmail.com" });
    expect(malo.error?.issues[0].path).toEqual(["correoInstitucional"]);
    expect(malo.error?.issues[0].message).toContain("Usa el correo institucional de la Policía");
    const ejercito = crearEsquemaEditarDatosAsociado("ejercito");
    expect(ejercito.safeParse({ ...BASE, correoInstitucional: "ana@policia.gov.co" }).success).toBe(false);
  });

  it("cuenta de banco: exige tipo y número de 6 a 20 dígitos", () => {
    const sinTipo = policia.safeParse({ ...BASE, nomina_entidad: "Bancolombia", nomina_numero: "123" });
    expect(sinTipo.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["nomina_tipo", "nomina_numero"]));
    const ok = policia.parse({ ...BASE, nomina_entidad: "Bancolombia", nomina_tipo: "ahorros", nomina_numero: "123-456.78" });
    expect(ok.nomina).toEqual({ entidad: "Bancolombia", tipo: "ahorros", numero: "12345678" });
  });

  it("billetera: depósito electrónico con el celular", () => {
    const ok = policia.parse({ ...BASE, nomina_entidad: "Nequi", nomina_numero: "300 111 2233" });
    expect(ok.nomina).toEqual({ entidad: "Nequi", tipo: "deposito_electronico", numero: "3001112233" });
  });

  it("«Otra, ¿cuál?» guarda el nombre escrito", () => {
    const ok = policia.parse({
      ...BASE,
      nomina_entidad: "otra",
      nomina_entidad_otra: "Cooperativa  Ejemplo",
      nomina_tipo: "corriente",
      nomina_numero: "9876543",
    });
    expect(ok.nomina).toEqual({ entidad: "Cooperativa Ejemplo", tipo: "corriente", numero: "9876543" });
    expect(policia.safeParse({ ...BASE, nomina_entidad: "otra", nomina_tipo: "ahorros", nomina_numero: "123456" }).success).toBe(
      false,
    );
  });
});
