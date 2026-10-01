/**
 * Carné con QR: token, ruta pública y lo que se muestra al verificar (lib/carne.ts).
 */
import { describe, expect, it } from "vitest";
import { esTokenCarne, rutaVerificacion, vistaVerificacion } from "@/lib/carne";

const TOKEN = "3f2b8c1e-5a4d-4b7e-9c10-1a2b3c4d5e6f";

describe("esTokenCarne", () => {
  it("acepta un uuid", () => {
    expect(esTokenCarne(TOKEN)).toBe(true);
    expect(esTokenCarne(TOKEN.toUpperCase())).toBe(true);
  });
  it("rechaza basura, vacíos y no-textos", () => {
    for (const malo of ["", "abc", "1234567890", `${TOKEN}x`, `../${TOKEN}`, null, undefined, 5]) {
      expect(esTokenCarne(malo)).toBe(false);
    }
  });
});

describe("rutaVerificacion", () => {
  it("arma /verificar/<token> en minúsculas", () => {
    expect(rutaVerificacion(TOKEN.toUpperCase())).toBe(`/verificar/${TOKEN}`);
  });
});

describe("vistaVerificacion", () => {
  it("devuelve solo nombre, grado, institución y activo (descarta cualquier otro campo)", () => {
    const v = vistaVerificacion([
      { nombre: "Ana Pérez", grado: "Subintendente", institucion: "Policía Nacional", activo: true, cedula: "123", tasa: 1 },
    ]);
    expect(v).toEqual({ nombre: "Ana Pérez", grado: "Subintendente", institucion: "Policía Nacional", activo: true });
    expect(Object.keys(v!).sort()).toEqual(["activo", "grado", "institucion", "nombre"]);
  });
  it("institución ausente queda en null", () => {
    expect(vistaVerificacion([{ nombre: "A", grado: "G", institucion: null, activo: false }])?.institucion).toBeNull();
  });
  it("sin filas, respuesta rara o error = null (Carné no válido, igual en todos los casos)", () => {
    expect(vistaVerificacion([])).toBeNull();
    expect(vistaVerificacion(null)).toBeNull();
    expect(vistaVerificacion([{ nombre: 1 }])).toBeNull();
    expect(vistaVerificacion([{ nombre: "A", grado: "G", activo: true }, { nombre: "B", grado: "G", activo: true }])).toBeNull();
  });
});
