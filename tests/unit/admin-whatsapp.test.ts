/**
 * Funciones puras del botón «Escribir por WhatsApp» del detalle de
 * afiliación (piezas 3e/3i, D-08 · P-95 aprobado el 2026-09-27).
 */
import { describe, expect, it } from "vitest";
import {
  enlaceWhatsappAfiliacion,
  mensajeWhatsappAfiliacion,
  normalizarCelularColombiano,
  primerNombre,
} from "@/lib/admin/whatsapp";

describe("primerNombre", () => {
  it("toma la primera palabra de un nombre completo", () => {
    expect(primerNombre("Andrea Milena Suárez")).toBe("Andrea");
  });

  it("deja un nombre de una sola palabra igual", () => {
    expect(primerNombre("Andrea")).toBe("Andrea");
  });

  it("ignora espacios sueltos al inicio", () => {
    expect(primerNombre("  Andrea Milena")).toBe("Andrea");
  });
});

describe("normalizarCelularColombiano", () => {
  it("acepta 10 dígitos que empiezan por 3 y les antepone 57", () => {
    expect(normalizarCelularColombiano("3015556623")).toBe("573015556623");
  });

  it("acepta el celular ya con 57 delante (12 dígitos)", () => {
    expect(normalizarCelularColombiano("573015556623")).toBe("573015556623");
  });

  it("no duplica el prefijo 57 si ya viene puesto", () => {
    const normalizado = normalizarCelularColombiano("573015556623");
    expect(normalizado).toHaveLength(12);
    expect(normalizado?.startsWith("5757")).toBe(false);
  });

  it("limpia espacios, guiones y el signo +", () => {
    expect(normalizarCelularColombiano("+57 301 555 6623")).toBe("573015556623");
    expect(normalizarCelularColombiano("301-555-6623")).toBe("573015556623");
  });

  it("rechaza un celular que no empieza por 3", () => {
    expect(normalizarCelularColombiano("6015556623")).toBeNull();
  });

  it("rechaza un largo distinto de 10 (o 12 con 57)", () => {
    expect(normalizarCelularColombiano("30155566")).toBeNull();
    expect(normalizarCelularColombiano("301555662399")).toBeNull();
  });

  it("rechaza null, undefined y cadena vacía", () => {
    expect(normalizarCelularColombiano(null)).toBeNull();
    expect(normalizarCelularColombiano(undefined)).toBeNull();
    expect(normalizarCelularColombiano("")).toBeNull();
  });
});

describe("mensajeWhatsappAfiliacion", () => {
  it("interpola el primer nombre en el mensaje del lienzo (3e/3i)", () => {
    expect(mensajeWhatsappAfiliacion("Andrea Milena Suárez")).toBe(
      "Hola Andrea, soy del equipo de la cooperativa Green Alliance. Te escribimos por tu solicitud de afiliación, ¿tienes un momento?",
    );
  });
});

describe("enlaceWhatsappAfiliacion", () => {
  it("arma el enlace wa.me con el número normalizado y el mensaje codificado", () => {
    const enlace = enlaceWhatsappAfiliacion("301 555 6623", "Andrea Milena Suárez");
    expect(enlace).toBe(
      "https://wa.me/573015556623?text=" +
        encodeURIComponent(
          "Hola Andrea, soy del equipo de la cooperativa Green Alliance. Te escribimos por tu solicitud de afiliación, ¿tienes un momento?",
        ),
    );
  });

  it("devuelve null (botón deshabilitado) si no hay celular o no es válido", () => {
    expect(enlaceWhatsappAfiliacion(null, "Andrea")).toBeNull();
    expect(enlaceWhatsappAfiliacion("123", "Andrea")).toBeNull();
  });
});
