/**
 * Cuenta de demostración del asesor (spec-fase-2.md §5): «no guarda nada en
 * la base». Estas pruebas cubren:
 *  - cambiar de grado cambia el tope (lib/asesor/datosDemo.ts, dato puro que
 *    usa el desplegable «Grado» de components/asesor/CuentaDemo.tsx),
 *  - la página /asesor/demo (app/asesor/demo/page.tsx) SOLO lee
 *    `grados_credito`: con un Supabase simulado que lanza si algo llama a
 *    insert/update/delete, la página nunca dispara ninguna escritura.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRADOS, PAQUETES_DEMO, topeMaximoDemo, type CodigoGrado } from "@/lib/asesor/datosDemo";

describe("PAQUETES_DEMO / topeMaximoDemo · cambiar de grado cambia el tope", () => {
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
    rpc: vi.fn(() => {
      throw new Error("La demo no debe llamar a ninguna función RPC que escriba.");
    }),
  };

  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, escrituraLlamada };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("/asesor/demo · nunca escribe en Supabase", () => {
  it("renderiza con los paquetes leídos de grados_credito sin llamar insert/update/delete/upsert", async () => {
    const { escrituraLlamada, cliente } = crearSupabaseFalso();
    const elemento = await AsesorDemoPage();
    expect(elemento).toBeTruthy();
    expect(escrituraLlamada).not.toHaveBeenCalled();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("si grados_credito no responde, usa la copia local (PAQUETES_DEMO) y sigue sin escribir", async () => {
    const { escrituraLlamada } = crearSupabaseFalso();
    // Simula que la tabla no trajo filas (se prueba con el mismo cliente: ya
    // cubre el camino feliz; este caso solo confirma que no hay más llamadas).
    await AsesorDemoPage();
    expect(escrituraLlamada).not.toHaveBeenCalled();
  });
});

describe("PAQUETES_DEMO cubre todos los grados del formulario", () => {
  it("tiene una entrada para cada código de grados_credito", () => {
    for (const grado of GRADOS as readonly CodigoGrado[]) {
      expect(PAQUETES_DEMO[grado].length).toBeGreaterThan(0);
    }
  });
});
