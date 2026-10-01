/**
 * Enmascarado de correos (ingreso y afiliación), enlace de WhatsApp y
 * cómo /cuenta muestra la última solicitud (lib/cuenta.ts).
 */
import { describe, expect, it } from "vitest";
import { enlaceWhatsapp } from "@/lib/config";
import { formatearPesos, textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { correoDeRelleno, enmascararCedula, enmascararCorreo } from "@/lib/mascara";

describe("enmascararCorreo", () => {
  it("deja 2 letras del usuario y oculta el dominio completo (F-01, correo de cualquier dominio)", () => {
    expect(enmascararCorreo("juan.perez@policia.gov.co")).toBe("ju•••@•••");
    expect(enmascararCorreo("  JUAN.PEREZ@Gmail.Com ")).toBe("ju•••@•••");
  });
  it("usuarios cortos muestran solo 1 letra", () => {
    expect(enmascararCorreo("ab@ej.co")).toBe("a•••@•••");
  });
  it("nunca deja ver nada del dominio", () => {
    for (const correo of ["asociado.prueba@buzonejercito.mil.co", "maria@gmail.com", "pedro@hotmail.es"]) {
      const m = enmascararCorreo(correo);
      expect(m.split("@")[1]).toBe("•••");
    }
  });
  it("texto sin @ no rompe", () => {
    expect(enmascararCorreo("no-es-correo")).toBe("•••");
  });
});

describe("correoDeRelleno (F-01: relleno indistinguible de un correo real)", () => {
  it("tiene la misma forma que un correo real enmascarado, sea del dominio que sea", () => {
    const relleno = correoDeRelleno(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(relleno).toMatch(/^[a-z]{2}•••@•••$/);
    for (const real of ["maria.gomez@policia.gov.co", "maria.gomez@gmail.com"]) {
      expect(enmascararCorreo(real)).toMatch(/^[a-z]{2}•••@•••$/);
    }
  });
  it("es estable para los mismos bytes (la misma cédula siempre muestra lo mismo)", () => {
    const b = new Uint8Array([7, 9, 3, 1, 8, 2, 4, 6]);
    expect(correoDeRelleno(b)).toBe(correoDeRelleno(b));
  });
});

describe("enmascararCedula (carné de asociado, pieza 2b)", () => {
  it("agrupa por miles y deja ver el primer grupo, 1 cifra del segundo y el último grupo", () => {
    expect(enmascararCedula("1032109876")).toBe("1.0••.•••.876");
    expect(enmascararCedula("1234567890")).toBe("1.2••.•••.890");
  });
  it("cédulas muy cortas (menos de 4 dígitos) se devuelven sin cambios: no hay nada que ocultar con sentido", () => {
    expect(enmascararCedula("123")).toBe("123");
  });
  it("no toca lo que ya ve el propio asociado en «Mis datos»: es una función aparte de la cédula sin formato", () => {
    // «Mis datos» sigue mostrando `perfiles.cedula` tal cual (sin puntos ni máscara);
    // esta función es solo para el carné, que sí puede mostrarse en público.
    expect(enmascararCedula("1234567890")).not.toBe("1234567890");
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
    expect(v.pasos.map((p) => p.estado)).toEqual(["hecho", "actual", "pendiente", "pendiente"]);
    expect(v.pasos[0].fecha).toBeTruthy();
  });
  it("aprobada sin desembolso: «Aprobado · pendiente de desembolso» (§12.2)", () => {
    const v = vistaSolicitud({ ...BASE, estado: "aprobado", fecha_respuesta: "2026-09-25T15:00:00Z" });
    expect(v.estadoTexto).toBe("Aprobado · pendiente de desembolso");
    expect(v.pasos.map((p) => p.estado)).toEqual(["hecho", "hecho", "hecho", "actual"]);
    expect(v.pasos[2].fecha).toBeTruthy();
  });
  it("rechazada: el tercer paso dice Rechazada", () => {
    const v = vistaSolicitud({ ...BASE, estado: "rechazado", fecha_respuesta: "2026-09-25T15:00:00Z" });
    expect(v.estadoTexto).toBe("Rechazada");
    expect(v.pasos[2].etiqueta).toBe("Rechazada");
  });
  it("no expone la tasa al asociado (uso interno, decisión 25-sep)", () => {
    expect(vistaSolicitud(BASE)).not.toHaveProperty("tasa");
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
