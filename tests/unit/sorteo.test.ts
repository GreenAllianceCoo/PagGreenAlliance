/**
 * Sorteo mensual (docs/spec-fase-2.md §4): fechas en hora de Colombia, qué
 * ve /cuenta según la fila de `boletas_sorteo` (nunca el número antes de
 * confirmar) y el confeti de la celebración (nada si prefers-reduced-motion).
 */
import { describe, expect, it } from "vitest";
import { generarConfeti } from "@/components/sorteo/confeti";
import {
  fechaBogota,
  mesSorteoActual,
  nombreMes,
  textoProximaApertura,
  ventanaSorteoAbierta,
} from "@/lib/sorteo/fecha";
import { vistaSorteo } from "@/lib/sorteo/vista";

// Mediodía en Bogotá (UTC-5) para evitar líos de huso al fijar el día en UTC.
function fechaEnBogota(anio: number, mes: number, dia: number) {
  return new Date(Date.UTC(anio, mes - 1, dia, 17, 0, 0)); // 17:00 UTC = 12:00 Bogotá
}

describe("fechaBogota", () => {
  it("lee año, mes y día en America/Bogota, no en UTC", () => {
    // 23:30 UTC del 5 de octubre = 18:30 en Bogotá (mismo día).
    const f = fechaBogota(new Date(Date.UTC(2026, 9, 5, 23, 30)));
    expect(f).toEqual({ anio: 2026, mes: 10, dia: 5 });
  });

  it("cruza el día cuando en UTC ya es el siguiente pero en Bogotá no", () => {
    // 02:00 UTC del 6 de octubre = 21:00 del 5 en Bogotá.
    const f = fechaBogota(new Date(Date.UTC(2026, 9, 6, 2, 0)));
    expect(f).toEqual({ anio: 2026, mes: 10, dia: 5 });
  });
});

describe("ventanaSorteoAbierta (debe coincidir con sorteo_ventana_abierta() de la base)", () => {
  it.each([1, 2, 3, 4, 5])("día %d: abierta", (dia) => {
    expect(ventanaSorteoAbierta(fechaEnBogota(2026, 3, dia))).toBe(true);
  });
  it.each([6, 15, 30, 31])("día %d: cerrada", (dia) => {
    expect(ventanaSorteoAbierta(fechaEnBogota(2026, 3, dia))).toBe(false);
  });
});

describe("nombreMes / mesSorteoActual / textoProximaApertura", () => {
  it("nombreMes: 1 = enero, 12 = diciembre", () => {
    expect(nombreMes(1)).toBe("enero");
    expect(nombreMes(12)).toBe("diciembre");
  });

  it("mesSorteoActual usa el mes de Bogotá", () => {
    expect(mesSorteoActual(fechaEnBogota(2026, 10, 3))).toBe("octubre");
  });

  it("textoProximaApertura es siempre el 1 del mes siguiente", () => {
    expect(textoProximaApertura(fechaEnBogota(2026, 10, 20))).toBe("1 de noviembre");
  });

  it("textoProximaApertura cruza de diciembre a enero", () => {
    expect(textoProximaApertura(fechaEnBogota(2026, 12, 20))).toBe("1 de enero");
  });
});

describe("vistaSorteo (nunca expone el número antes de confirmar)", () => {
  const AHORA = fechaEnBogota(2026, 10, 20); // ventana cerrada, para no mezclar variables

  it("sin fila: sin-participar, sin número", () => {
    const props = vistaSorteo(null, AHORA);
    expect(props.estadoInicial).toBe("sin-participar");
    expect(props.numeroInicial).toBeNull();
  });

  it("fila 'enviada' (ya se generó y se envió el número por correo): NUNCA expone el número", () => {
    const props = vistaSorteo({ estado: "enviada", numero: "123456" }, AHORA);
    expect(props.estadoInicial).toBe("enviada");
    expect(props.numeroInicial).toBeNull();
  });

  it("fila 'confirmada': ahí sí, porque el asociado ya lo escribió para confirmarlo", () => {
    const props = vistaSorteo({ estado: "confirmada", numero: "654321" }, AHORA);
    expect(props.estadoInicial).toBe("confirmada");
    expect(props.numeroInicial).toBe("654321");
  });

  it("arma ventanaAbierta, mesTexto y textoProximaApertura con la misma fecha", () => {
    const props = vistaSorteo(null, fechaEnBogota(2026, 10, 3));
    expect(props.ventanaAbierta).toBe(true);
    expect(props.mesTexto).toBe("octubre");
  });
});

describe("generarConfeti", () => {
  it("con prefers-reduced-motion: reduce, no genera ninguna pieza (nada que animar)", () => {
    expect(generarConfeti(24, true)).toEqual([]);
  });

  it("sin preferencia de menos movimiento, genera la cantidad pedida", () => {
    const piezas = generarConfeti(24, false);
    expect(piezas).toHaveLength(24);
    for (const pieza of piezas) {
      expect(pieza.izquierda).toBeGreaterThanOrEqual(0);
      expect(pieza.izquierda).toBeLessThanOrEqual(100);
      expect(pieza.duracion).toBeGreaterThan(0);
    }
  });

  it("es determinista (misma cantidad → mismo resultado, sin Math.random)", () => {
    expect(generarConfeti(10, false)).toEqual(generarConfeti(10, false));
  });

  it("cantidad 0 o negativa: sin piezas", () => {
    expect(generarConfeti(0, false)).toEqual([]);
    expect(generarConfeti(-3, false)).toEqual([]);
  });
});
