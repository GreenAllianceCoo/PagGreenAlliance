/**
 * Enmascarado de correos (ingreso y afiliación), enlace de WhatsApp y
 * cómo /cuenta muestra la última solicitud (lib/cuenta.ts).
 */
import { describe, expect, it } from "vitest";
import { enlaceWhatsapp } from "@/lib/config";
import { formatearPesos, textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { correoDeRelleno, DOMINIOS_ASOCIADOS, enmascararCorreo } from "@/lib/mascara";

describe("enmascararCorreo", () => {
  it("deja 2 letras del usuario y solo el primer bloque + TLD del dominio (F-01)", () => {
    expect(enmascararCorreo("juan.perez@policia.gov.co")).toBe("ju•••@po•••.co");
    expect(enmascararCorreo("  JUAN.PEREZ@Policia.Gov.Co ")).toBe("ju•••@po•••.co");
  });
  it("usuarios y dominios cortos muestran solo 1 letra", () => {
    expect(enmascararCorreo("ab@ej.co")).toBe("a•••@e•••.co");
    expect(enmascararCorreo("a@ejercito.mil.co")).toBe("a•••@ej•••.co");
  });
  it("nunca devuelve el correo completo, ni el dominio completo", () => {
    const correo = "asociado.prueba@buzonejercito.mil.co";
    expect(enmascararCorreo(correo)).not.toContain("asociado.prueba");
    expect(enmascararCorreo(correo)).not.toContain("buzonejercito");
    // Tampoco delata el segundo nivel (gov/mil), solo el TLD final.
    expect(enmascararCorreo(correo)).not.toContain("mil");
  });
  it("texto sin @ no rompe", () => {
    expect(enmascararCorreo("no-es-correo")).toBe("•••");
  });
  it("dominio sin punto (sin TLD reconocible) no rompe", () => {
    expect(enmascararCorreo("juan@localhost")).toBe("ju•••@•••");
  });
});

describe("correoDeRelleno (F-01: relleno indistinguible de un correo real)", () => {
  it("tiene EXACTAMENTE la misma forma que enmascararCorreo() sobre un dominio real", () => {
    const relleno = correoDeRelleno(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(relleno).toMatch(/^[a-z]{1,2}•••@[a-z]{1,2}•••\.[a-z]+$/);
  });
  it("solo usa los dominios reales de los asociados (nunca gmail ni otro dominio de relleno)", () => {
    for (let semilla = 0; semilla < 50; semilla++) {
      const bytes = new Uint8Array(8).map((_, i) => (semilla * 7 + i * 13) % 256);
      const relleno = correoDeRelleno(bytes);
      const tld = relleno.split(".").pop();
      const tldsReales = DOMINIOS_ASOCIADOS.map((d) => d.split(".").pop());
      expect(tldsReales).toContain(tld);
    }
  });
  it("es estable para los mismos bytes (la misma cédula siempre muestra lo mismo)", () => {
    const b = new Uint8Array([7, 9, 3, 1, 8, 2, 4, 6]);
    expect(correoDeRelleno(b)).toBe(correoDeRelleno(b));
  });
  it("un correo real y uno de relleno pueden coincidir en forma exacta (no hay forma de distinguirlos)", () => {
    // Con los 3 dominios institucionales, ambos casos producen "xx•••@yy•••.co".
    const real = enmascararCorreo("maria.gomez@policia.gov.co");
    const relleno = correoDeRelleno(new Uint8Array([12, 4, 17, 0, 3, 8, 9, 1]));
    expect(real).toMatch(/^[a-z]{2}•••@[a-z]{2}•••\.co$/);
    expect(relleno).toMatch(/^[a-z]{1,2}•••@[a-z]{1,2}•••\.co$/);
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
