/**
 * Cuenta de demostración del asesor (spec-fase-2.md §5): «no guarda nada en
 * la base». Estas pruebas cubren:
 *  - cambiar de grado cambia el tope (lib/asesor/datosDemo.ts, dato puro que
 *    usa el desplegable «Grado» de components/asesor/CuentaDemo.tsx),
 *  - la página /asesor/demo (app/asesor/demo/page.tsx) SOLO lee la tabla
 *    de crédito con la RPC de lectura `tabla_credito_con_tasa()` (la tasa
 *    ya no se lee por la API, migración 20260930100100): con un Supabase
 *    simulado que lanza si algo llama a insert/update/delete o a otra RPC,
 *    la página nunca dispara ninguna escritura.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GRADOS, topeMaximoDemo, type CodigoGrado, type PaqueteDemo } from "@/lib/asesor/datosDemo";

/** Datos de PRUEBA (la tasa es ficticia: en el código no hay copia de la tabla real, RS-08). */
function paquete(porcentaje: "50" | "100", capacidad_maxima: number): PaqueteDemo {
  return { porcentaje, capacidad_maxima, tasa_interes_mensual: 0.01, plazo_meses: 3 };
}
const PAQUETES_DEMO: Record<CodigoGrado, PaqueteDemo[]> = {
  PP: [paquete("50", 1000000), paquete("100", 2100000)],
  PT: [paquete("50", 1300000), paquete("100", 2700000)],
  SI: [paquete("50", 1500000), paquete("100", 3000000)],
  IT: [paquete("50", 2000000), paquete("100", 4000000)],
  OF: [paquete("50", 2150000), paquete("100", 4200000)],
};

describe("PAQUETES_DEMO de prueba / topeMaximoDemo · cambiar de grado cambia el tope", () => {
  it("cada grado tiene un tope distinto (o igual por coincidencia, pero siempre calculable)", () => {
    const topes = GRADOS.map((g) => topeMaximoDemo(PAQUETES_DEMO[g]));
    expect(topes.every((t) => t > 0)).toBe(true);
  });

  it("PP tiene menor tope que OF (más alto grado, más tope)", () => {
    expect(topeMaximoDemo(PAQUETES_DEMO.PP)).toBeLessThan(topeMaximoDemo(PAQUETES_DEMO.OF));
  });

  it("el tope es el mayor entre el paquete de 50% y el de 100%", () => {
    const paquetes = PAQUETES_DEMO.PT;
    const maximoEsperado = Math.max(...paquetes.map((p) => p.capacidad_maxima));
    expect(topeMaximoDemo(paquetes)).toBe(maximoEsperado);
  });

  it("sin paquetes, el tope es 0 (no revienta)", () => {
    expect(topeMaximoDemo([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// /asesor/demo nunca inserta, actualiza ni borra nada.
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT ${ruta}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/servidor/registro", () => ({
  registrar: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import AsesorDemoPage from "@/app/asesor/demo/page";

/** Cliente de Supabase falso: LEE grados_credito; cualquier escritura hace fallar la prueba. */
function crearSupabaseFalso() {
  const escrituraLlamada = vi.fn();

  const from = vi.fn((tabla: string) => {
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn(() => consulta);
    consulta.single = vi.fn(async () => {
      if (tabla === "perfiles") {
        return { data: { nombre_completo: "Asesor de prueba", rol: "asesor" }, error: null };
      }
      return { data: null, error: null };
    });
    consulta.order = vi.fn(() => consulta);
    // grados_credito termina en .order(...).order(...), que debe ser "awaitable".
    consulta.then = (ok: (v: unknown) => unknown) => {
      if (tabla === "grados_credito") {
        return Promise.resolve({
          data: [{ grado: "PP", porcentaje: "50", capacidad_maxima: 1000000, tasa_interes_mensual: 0.079, plazo_meses: 3 }],
          error: null,
        }).then(ok);
      }
      return Promise.resolve({ data: null, error: null }).then(ok);
    };
    // Cualquier intento de escribir debe hacer fallar la prueba de inmediato.
    consulta.insert = vi.fn((...args: unknown[]) => {
      escrituraLlamada("insert", tabla, ...args);
      throw new Error(`No debía llamarse insert() en ${tabla}`);
    });
    consulta.update = vi.fn((...args: unknown[]) => {
      escrituraLlamada("update", tabla, ...args);
      throw new Error(`No debía llamarse update() en ${tabla}`);
    });
    consulta.delete = vi.fn((...args: unknown[]) => {
      escrituraLlamada("delete", tabla, ...args);
      throw new Error(`No debía llamarse delete() en ${tabla}`);
    });
    consulta.upsert = vi.fn((...args: unknown[]) => {
      escrituraLlamada("upsert", tabla, ...args);
      throw new Error(`No debía llamarse upsert() en ${tabla}`);
    });
    return consulta;
  });

  const cliente = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "asesor-1" } }, error: null })),
    },
    from,
    // Única RPC permitida: la de LECTURA de la tabla con tasa (solo asesor/admin).
    rpc: vi.fn(async (nombre: string) => {
      if (nombre !== "tabla_credito_con_tasa") {
        throw new Error(`La demo no debe llamar a la RPC ${nombre}.`);
      }
      return {
        data: [{ grado: "PP", porcentaje: "50", capacidad_maxima: 1000000, tasa_interes_mensual: 0.079, plazo_meses: 3 }],
        error: null,
      };
    }),
  };

  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, escrituraLlamada };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("/asesor/demo · nunca escribe en Supabase", () => {
  it("renderiza con los paquetes de tabla_credito_con_tasa() sin llamar insert/update/delete/upsert", async () => {
    const { escrituraLlamada, cliente } = crearSupabaseFalso();
    const elemento = await AsesorDemoPage();
    expect(elemento).toBeTruthy();
    expect(escrituraLlamada).not.toHaveBeenCalled();
    expect(cliente.rpc).toHaveBeenCalledTimes(1);
    expect(cliente.rpc).toHaveBeenCalledWith("tabla_credito_con_tasa");
    // Ya no se pide la tasa directo a la tabla.
    expect(cliente.from).not.toHaveBeenCalledWith("grados_credito");
  });

});

describe("RS-08 · la tasa NO viaja en el JavaScript del navegador", () => {
  it("datosDemo.ts (lo importan componentes cliente) no trae cifras de la tabla ni la tasa real", () => {
    const fuente = readFileSync("lib/asesor/datosDemo.ts", "utf8");
    expect(fuente).not.toContain("0.079");
    expect(fuente).not.toContain("PAQUETES_DEMO");
    expect(fuente).not.toMatch(/tasa_interes_mensual:s*[0-9]/);
  });

  it("ningún componente cliente (\"use client\") importa la copia de la tabla", () => {
    for (const ruta of ["components/asesor/CuentaDemo.tsx", "components/admin/PanelCreditos.tsx"]) {
      expect(readFileSync(ruta, "utf8")).not.toContain("PAQUETES_DEMO");
    }
  });

  it("si la RPC falla, cargarPaquetesDemo devuelve null (la demo muestra error, no una tasa de respaldo)", async () => {
    const { cargarPaquetesDemo } = await import("@/lib/asesor/cargarPaquetesDemo");
    const supabase = { rpc: vi.fn(async () => ({ data: null, error: { message: "boom", code: "X" } })) };
    expect(await cargarPaquetesDemo(supabase as never, "evento_prueba")).toBeNull();
  });

  it("si la RPC responde sin filas (p. ej. quien llama no es asesor/admin), también devuelve null", async () => {
    const { cargarPaquetesDemo } = await import("@/lib/asesor/cargarPaquetesDemo");
    const supabase = { rpc: vi.fn(async () => ({ data: [], error: null })) };
    expect(await cargarPaquetesDemo(supabase as never, "evento_prueba")).toBeNull();
  });

  it("con filas de la RPC, agrupa por grado y solo incluye lo que trajo la base", async () => {
    const { cargarPaquetesDemo } = await import("@/lib/asesor/cargarPaquetesDemo");
    const supabase = {
      rpc: vi.fn(async () => ({
        data: [
          { grado: "PP", porcentaje: "50", capacidad_maxima: "1000000", tasa_interes_mensual: "0.01", plazo_meses: 3 },
          { grado: "XX", porcentaje: "50", capacidad_maxima: 1, tasa_interes_mensual: 0.01, plazo_meses: 3 },
        ],
        error: null,
      })),
    };
    const r = await cargarPaquetesDemo(supabase as never, "evento_prueba");
    expect(Object.keys(r ?? {})).toEqual(["PP"]);
    expect(r?.PP[0].capacidad_maxima).toBe(1000000);
  });
});
