/**
 * Perfil «selfie» del verificador de fotos (lib/afiliacion/calidadFoto.ts):
 * una cara con poco contraste y una cámara de 640×480 no deben salir «dudosas»,
 * mientras la cédula conserva sus umbrales.
 */
import { describe, expect, it } from "vitest";
import { evaluarCalidadFoto, type ImagenRGBA } from "@/lib/afiliacion/calidadFoto";

/** Imagen gris con un degradado suave y un ruido leve (como piel y fondo desenfocado). */
function imagenSuave(ancho: number, alto: number, base = 120, ruido = 6): ImagenRGBA {
  const data = new Uint8ClampedArray(ancho * alto * 4);
  let semilla = 7;
  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      const v = base + (x / ancho) * 30 + ((semilla / 2147483648) * 2 - 1) * ruido;
      const i = (y * ancho + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: ancho, height: alto };
}

describe("evaluarCalidadFoto · perfil selfie", () => {
  const imagen = imagenSuave(512, 384);
  const camara640 = { anchoOriginal: 640, altoOriginal: 480 };

  it("una selfie suave de 640×480 es aceptable con el perfil selfie", () => {
    const r = evaluarCalidadFoto(imagen, camara640, "selfie");
    expect(r.pequena).toBe(false);
    expect(r.borrosa).toBe(false);
    expect(r.aceptable).toBe(true);
  });

  it("la misma imagen como documento sigue dando aviso (umbrales de la cédula)", () => {
    const r = evaluarCalidadFoto(imagen, camara640);
    expect(r.pequena).toBe(true);
    expect(r.aceptable).toBe(false);
  });

  it("una selfie realmente oscura o diminuta sigue dando aviso", () => {
    expect(evaluarCalidadFoto(imagenSuave(512, 384, 20), camara640, "selfie").oscura).toBe(true);
    expect(evaluarCalidadFoto(imagen, { anchoOriginal: 320, altoOriginal: 240 }, "selfie").pequena).toBe(true);
  });

  it("una selfie totalmente plana (sin ningún detalle) sigue siendo borrosa", () => {
    expect(evaluarCalidadFoto(imagenSuave(512, 384, 120, 0), camara640, "selfie").borrosa).toBe(true);
  });
});
