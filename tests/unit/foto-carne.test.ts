/**
 * Foto del carné: reglas puras (lib/fotoCarne.ts), esquemas zod y PDF con foto.
 */
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generarCarnePdf } from "@/lib/carnePdf";
import {
  CONSEJO_FOTO_CARNE,
  TAMANO_MAXIMO_FOTO_CARNE,
  errorDeArchivoFotoCarne,
  esTipoFotoCarne,
  recorteCuadrado,
  rutaEsDelAsociado,
  rutaFotoCarne,
  separarBucketRuta,
} from "@/lib/fotoCarne";
import { esquemaGuardarFotoCarne, esquemaPrepararFotoCarne } from "@/lib/validaciones/fotoCarne";

const ASOCIADO = "30000000-0000-4000-a000-00000000000a";
const OTRO = "30000000-0000-4000-a000-00000000000b";
const FOTO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("tipos y peso", () => {
  it("acepta JPG, PNG y WEBP; rechaza lo demás", () => {
    expect(esTipoFotoCarne("image/jpeg")).toBe(true);
    expect(esTipoFotoCarne("image/png")).toBe(true);
    expect(esTipoFotoCarne("image/webp")).toBe(true);
    expect(esTipoFotoCarne("image/gif")).toBe(false);
    expect(esTipoFotoCarne("image/svg+xml")).toBe(false);
    expect(esTipoFotoCarne("application/pdf")).toBe(false);
  });

  it("errorDeArchivoFotoCarne: válido, vacío, tipo malo y más de 5 MB", () => {
    expect(errorDeArchivoFotoCarne({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(errorDeArchivoFotoCarne({ type: "image/jpeg", size: TAMANO_MAXIMO_FOTO_CARNE })).toBeNull();
    expect(errorDeArchivoFotoCarne({ type: "image/jpeg", size: 0 })).toMatch(/vacío/);
    expect(errorDeArchivoFotoCarne({ type: "image/gif", size: 10 })).toMatch(/JPG, PNG o WEBP/);
    expect(errorDeArchivoFotoCarne({ type: "image/png", size: TAMANO_MAXIMO_FOTO_CARNE + 1 })).toMatch(/5 MB/);
  });

  it("el consejo para el usuario es el pedido por la cooperativa", () => {
    expect(CONSEJO_FOTO_CARNE).toBe("Usa una foto reciente donde se vea bien tu cara, sin gafas oscuras ni gorra.");
  });
});

describe("rutas", () => {
  it("rutaFotoCarne arma «<asociado>/<uuid>.<ext>»", () => {
    expect(rutaFotoCarne(ASOCIADO, FOTO, "image/jpeg")).toBe(`${ASOCIADO}/${FOTO}.jpg`);
    expect(rutaFotoCarne(ASOCIADO, FOTO, "image/webp")).toBe(`${ASOCIADO}/${FOTO}.webp`);
  });

  it("rutaEsDelAsociado solo acepta la carpeta de ese asociado", () => {
    expect(rutaEsDelAsociado(`${ASOCIADO}/${FOTO}.png`, ASOCIADO)).toBe(true);
    expect(rutaEsDelAsociado(`${OTRO}/${FOTO}.png`, ASOCIADO)).toBe(false);
    expect(rutaEsDelAsociado(`${ASOCIADO}/${FOTO}.gif`, ASOCIADO)).toBe(false);
    expect(rutaEsDelAsociado(`${ASOCIADO}/../${OTRO}/${FOTO}.jpg`, ASOCIADO)).toBe(false);
    expect(rutaEsDelAsociado(`${ASOCIADO}/${FOTO}.jpg/extra`, ASOCIADO)).toBe(false);
  });

  it("separarBucketRuta", () => {
    expect(separarBucketRuta("fotos-carne/a/b.jpg")).toEqual({ bucket: "fotos-carne", ruta: "a/b.jpg" });
    expect(separarBucketRuta("sinbarra")).toBeNull();
    expect(separarBucketRuta("bucket/")).toBeNull();
    expect(separarBucketRuta("/ruta")).toBeNull();
  });
});

describe("recorteCuadrado", () => {
  it("centra el cuadrado en fotos horizontales, verticales y cuadradas", () => {
    expect(recorteCuadrado(4000, 3000)).toEqual({ x: 500, y: 0, lado: 3000 });
    expect(recorteCuadrado(3000, 4000)).toEqual({ x: 0, y: 500, lado: 3000 });
    expect(recorteCuadrado(800, 800)).toEqual({ x: 0, y: 0, lado: 800 });
    expect(recorteCuadrado(0, 0).lado).toBe(1);
  });
});

describe("esquemas zod", () => {
  it("preparar: válido e inválidos", () => {
    expect(esquemaPrepararFotoCarne.safeParse({ tipo: "image/jpeg", tamano: 120_000 }).success).toBe(true);
    expect(esquemaPrepararFotoCarne.safeParse({ tipo: "image/gif", tamano: 1000 }).success).toBe(false);
    expect(esquemaPrepararFotoCarne.safeParse({ tipo: "image/png", tamano: 0 }).success).toBe(false);
    expect(esquemaPrepararFotoCarne.safeParse({ tipo: "image/png", tamano: TAMANO_MAXIMO_FOTO_CARNE + 1 }).success).toBe(false);
    expect(esquemaPrepararFotoCarne.safeParse({ tipo: "image/png", tamano: 1.5 }).success).toBe(false);
    expect(esquemaPrepararFotoCarne.safeParse({ tipo: "image/png" }).success).toBe(false);
  });

  it("guardar: solo «<uuid>/<uuid>.<ext>»", () => {
    expect(esquemaGuardarFotoCarne.safeParse({ ruta: `${ASOCIADO}/${FOTO}.jpg` }).success).toBe(true);
    expect(esquemaGuardarFotoCarne.safeParse({ ruta: `${FOTO}.jpg` }).success).toBe(false);
    expect(esquemaGuardarFotoCarne.safeParse({ ruta: `${ASOCIADO}/${FOTO}.pdf` }).success).toBe(false);
    expect(esquemaGuardarFotoCarne.safeParse({ ruta: "../../etc/passwd" }).success).toBe(false);
    expect(esquemaGuardarFotoCarne.safeParse({}).success).toBe(false);
  });
});

describe("PDF del carné con foto", () => {
  const BASE = {
    nombre: "María Pérez",
    grado: "Teniente",
    institucion: "Policía Nacional",
    cedula: "1234567890",
    urlVerificacion: "https://ejemplo.test/verificar/3f2b8c1e-5a4d-4b7e-9c10-1a2b3c4d5e6f",
  };
  // PNG 1x1 válido
  const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );

  it("incrusta la foto y sigue siendo de una página", async () => {
    const sin = await generarCarnePdf(BASE);
    const con = await generarCarnePdf({ ...BASE, foto: { bytes: new Uint8Array(PNG_1X1), tipo: "png" } });
    expect((await PDFDocument.load(con)).getPageCount()).toBe(1);
    expect(con.length).toBeGreaterThan(sin.length);
  });

  it("una foto dañada no rompe el PDF (sale sin foto)", async () => {
    const bytes = await generarCarnePdf({ ...BASE, foto: { bytes: new Uint8Array([1, 2, 3]), tipo: "jpg" } });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});
