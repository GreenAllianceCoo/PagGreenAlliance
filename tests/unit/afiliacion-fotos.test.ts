/**
 * S-04 (revisión de seguridad 2026-09-24): detectarTipoImagen (lib/afiliacion/fotos.ts)
 * lee los "magic bytes" reales de cada foto, sin confiar en `archivo.type`
 * (lo declara el navegador y se puede falsificar).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));

import { detectarTipoImagen } from "@/lib/afiliacion/fotos";

/** Arma un Blob a partir de bytes crudos + relleno, con un tipo declarado (posiblemente falso). */
function archivoDeBytes(cabecera: number[], tipoDeclarado: string, relleno = 200) {
  const bytes = new Uint8Array([...cabecera, ...new Array(relleno).fill(0)]);
  return new File([bytes], "foto", { type: tipoDeclarado });
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// "RIFF" + 4 bytes de tamaño + "WEBP"
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe("detectarTipoImagen · casos válidos", () => {
  it("reconoce un JPEG real (FF D8 FF), aunque el navegador declare otra cosa", async () => {
    const archivo = archivoDeBytes(JPEG, "application/octet-stream");
    expect(await detectarTipoImagen(archivo)).toEqual({ mime: "image/jpeg", extension: "jpg" });
  });

  it("reconoce un PNG real (89 50 4E 47)", async () => {
    const archivo = archivoDeBytes(PNG, "image/png");
    expect(await detectarTipoImagen(archivo)).toEqual({ mime: "image/png", extension: "png" });
  });

  it("reconoce un WEBP real (RIFF....WEBP)", async () => {
    const archivo = archivoDeBytes(WEBP, "image/webp");
    expect(await detectarTipoImagen(archivo)).toEqual({ mime: "image/webp", extension: "webp" });
  });
});

describe("detectarTipoImagen · casos inválidos", () => {
  it("rechaza un archivo con Content-Type de imagen falseado (bytes de texto plano)", async () => {
    const archivo = archivoDeBytes([0x25, 0x50, 0x44, 0x46], "image/jpeg"); // "%PDF", declarado como JPEG
    expect(await detectarTipoImagen(archivo)).toBeNull();
  });

  it("rechaza un GIF (no está en la lista permitida)", async () => {
    const archivo = archivoDeBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "image/gif");
    expect(await detectarTipoImagen(archivo)).toBeNull();
  });

  it("rechaza un archivo vacío o demasiado corto", async () => {
    const archivo = new File([new Uint8Array(2)], "vacio", { type: "image/jpeg" });
    expect(await detectarTipoImagen(archivo)).toBeNull();
  });

  it("no se deja engañar por un RIFF que no es WEBP (p. ej. un .wav)", async () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]; // "WAVE", no "WEBP"
    const archivo = archivoDeBytes(wav, "image/webp");
    expect(await detectarTipoImagen(archivo)).toBeNull();
  });
});
