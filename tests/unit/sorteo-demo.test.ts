/**
 * Vista previa del sorteo (`/cuenta?sorteo=demo`, lib/sorteo/demo.ts): pedido
 * de Sebas (2026-09-24) para ver la animación de celebración sin esperar al
 * día 1 del mes. Debe quedar SIEMPRE apagada en producción, sin importar qué
 * traiga la URL.
 */
import { describe, expect, it } from "vitest";
import { activarVistaPreviaSorteo } from "@/lib/sorteo/demo";

describe("activarVistaPreviaSorteo", () => {
  it("se activa en desarrollo con ?sorteo=demo", () => {
    expect(activarVistaPreviaSorteo("demo", "development")).toBe(true);
  });

  it("se activa cuando NODE_ENV no está definido (p. ej. algunas pruebas locales)", () => {
    expect(activarVistaPreviaSorteo("demo", undefined)).toBe(true);
  });

  it("NUNCA se activa en producción, aunque la URL traiga ?sorteo=demo", () => {
    expect(activarVistaPreviaSorteo("demo", "production")).toBe(false);
  });

  it("no se activa sin el parámetro, ni en desarrollo", () => {
    expect(activarVistaPreviaSorteo(undefined, "development")).toBe(false);
  });

  it("no se activa con un valor distinto de 'demo'", () => {
    expect(activarVistaPreviaSorteo("otra-cosa", "development")).toBe(false);
  });

  it("en producción tampoco importa el valor del parámetro", () => {
    expect(activarVistaPreviaSorteo("otra-cosa", "production")).toBe(false);
    expect(activarVistaPreviaSorteo(undefined, "production")).toBe(false);
  });
});
