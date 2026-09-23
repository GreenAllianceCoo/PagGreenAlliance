/**
 * Enmascarado de correos (ingreso y afiliación), enlace de WhatsApp y
 * cómo /cuenta muestra la última solicitud (lib/cuenta.ts).
 */
import { describe, expect, it } from "vitest";
import { enlaceWhatsapp } from "@/lib/config";
import { formatearPesos, textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { correoDeRelleno, enmascararCorreo } from "@/lib/mascara";

describe("enmascararCorreo", () => {
  it("deja 2 letras del usuario y el dominio", () => {
    expect(enmascararCorreo("juan.perez@correo.com")).toBe("ju•••@correo.com");
    expect(enmascararCorreo("  JUAN@Correo.com ")).toBe("ju•••@correo.com");
  });
  it("usuarios cortos muestran solo 1 letra", () => {
    expect(enmascararCorreo("ab@correo.com")).toBe("a•••@correo.com");
    expect(enmascararCorreo("a@correo.com")).toBe("a•••@correo.com");
  });
  it("nunca devuelve el correo completo", () => {
    const correo = "asociado.prueba@greenalliance.test";
    expect(enmascararCorreo(correo)).not.toContain("asociado.prueba");
  });
  it("texto sin @ no rompe", () => {
    expect(enmascararCorreo("no-es-correo")).toBe("•••");
  });
});

describe("correoDeRelleno", () => {
  it("tiene la misma forma que un correo enmascarado real", () => {
    expect(correoDeRelleno(new Uint8Array([0, 1, 2]))).toMatch(/^[a-z]{2}•••@[a-z]+\.com$/);
  });
  it("es estable para los mismos bytes", () => {
    const b = new Uint8Array([7, 9, 3]);
    expect(correoDeRelleno(b)).toBe(correoDeRelleno(b));
  });
});

describe("enlaceWhatsapp", () => {
  it("arma https://wa.me/57<NÚMERO> con 10 dígitos", () => {
    expect(enlaceWhatsapp("3001234567")).toBe("https://wa.me/573001234567");
    expect(enlaceWhatsapp("300 123 4567")).toBe("https://wa.me/573001234567");
  });
  it("sin número válido devuelve null (texto sin enlace)", () => {
    expect(enlaceWhatsapp("")).toBeNull();
    expect(enlaceWhatsapp(undefined)).toBeNull();
    expect(enlaceWhatsapp("[NÚMERO]")).toBeNull();
    expect(enlaceWhatsapp("12345")).toBeNull();
  });
});

const BASE: FilaSolicitud = {
  estado: "pendiente",
  monto_solicitado: 500000,
  porcentaje_devolucion: "50",
  plazo_meses: 3,
  tasa_interes_mensual: 0.079,
  fecha_solicitud: "2026-09-23T15:00:00Z",
  fecha_respuesta: null,
};

describe("vistaSolicitud", () => {
  it("pendiente: En revisión es el paso actual", () => {
    const v = vistaSolicitud(BASE);
    expect(v.estadoTexto).toBe("En revisión");
    expect(v.monto).toBe("$ 500.000");
    expect(v.modalidad).toBe("50%");
    expect(v.plazo).toBe("3 meses");
    expect(v.tasa).toBe("7,9 %");
    expect(v.pasos.map((p) => p.estado)).toEqual(["hecho", "actual", "pendiente", "pendiente"]);
    expect(v.pasos[0].fecha).toBeTruthy();
  });
  it("aprobada: Aprobada hecha con fecha de respuesta", () => {
    const v = vistaSolicitud({ ...BASE, estado: "aprobado", fecha_respuesta: "2026-09-25T15:00:00Z" });
    expect(v.estadoTexto).toBe("Aprobada");
    expect(v.pasos.map((p) => p.estado)).toEqual(["hecho", "hecho", "hecho", "actual"]);
    expect(v.pasos[2].fecha).toBeTruthy();
  });
  it("rechazada: el tercer paso dice Rechazada", () => {
    const v = vistaSolicitud({ ...BASE, estado: "rechazado", fecha_respuesta: "2026-09-25T15:00:00Z" });
    expect(v.estadoTexto).toBe("Rechazada");
    expect(v.pasos[2].etiqueta).toBe("Rechazada");
  });
  it("la tasa viene de la solicitud (numeric llega como texto)", () => {
    expect(vistaSolicitud({ ...BASE, tasa_interes_mensual: "0.05050000" }).tasa).toBe("5,05 %");
  });
});

describe("tope y pesos", () => {
  it("formatea pesos colombianos", () => {
    expect(formatearPesos(2100000)).toBe("$ 2.100.000");
    expect(formatearPesos("1000000")).toBe("$ 1.000.000");
  });
  it("el tope es el mayor del grado", () => {
    expect(textoTope([{ capacidad_maxima: 1000000 }, { capacidad_maxima: 2100000 }])).toBe("$ 2.100.000");
  });
  it("sin grado", () => {
    expect(textoTope(null)).toBe("Sin grado asignado");
    expect(textoTope([])).toBe("Sin grado asignado");
  });
});
