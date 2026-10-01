/**
 * Carné en PDF (lib/carnePdf.ts): genera un PDF válido, tolera caracteres raros y textos largos.
 */
import { StandardFonts, PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { ajustarAncho, generarCarnePdf, textoSeguroPdf } from "@/lib/carnePdf";

const BASE = {
  nombre: "María Fernanda Pérez",
  grado: "Grado 3",
  institucion: "Colegio Ejemplo",
  cedula: "1234567890",
  urlVerificacion: "https://ejemplo.test/verificar/3f2b8c1e-5a4d-4b7e-9c10-1a2b3c4d5e6f",
};

describe("generarCarnePdf", () => {
  it("devuelve un PDF de una página", async () => {
    const bytes = await generarCarnePdf(BASE);
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("no falla con emojis, nombre larguísimo y sin institución", async () => {
    const bytes = await generarCarnePdf({
      ...BASE,
      nombre: "Ana 😀 ".repeat(30),
      institucion: null,
      cedula: "12",
    });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("textoSeguroPdf", () => {
  it("conserva tildes y ñ, reemplaza lo que Helvetica no codifica", () => {
    expect(textoSeguroPdf("Año Ñandú")).toBe("Año Ñandú");
    expect(textoSeguroPdf("Hola 😀\n")).toBe("Hola ??");
  });
});

describe("ajustarAncho", () => {
  it("recorta con puntos suspensivos cuando no cabe", async () => {
    const doc = await PDFDocument.create();
    const f = await doc.embedFont(StandardFonts.Helvetica);
    expect(ajustarAncho("corto", f, 12, 200)).toBe("corto");
    const r = ajustarAncho("x".repeat(100), f, 12, 100);
    expect(r.endsWith("...")).toBe(true);
    expect(f.widthOfTextAtSize(r, 12)).toBeLessThanOrEqual(100);
  });
});
