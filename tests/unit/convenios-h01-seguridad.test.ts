/**
 * H-01 (revisión de seguridad del 8-oct): el WhatsApp de cada convenio es solo
 * para quien tiene sesión. La carga pública (landing, rol anon) no pide
 * `telefono_contacto` ni manda ningún número al navegador, tampoco desde el
 * respaldo estático; la carga con sesión (/cuenta y demos) sí lo trae.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ anonimo: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAnonimoSinSesion: m.anonimo }));

import { cargarConvenios, cargarConveniosAutenticados } from "@/lib/conveniosServidor";

const FILA = {
  id: "11111111-1111-4111-8111-111111111111",
  nombre_empresa: "Marca de prueba",
  nit: null,
  emoji: "🤝",
  especialidad: "Pruebas",
  descripcion: null,
  servicios: [],
  sedes: [],
  orden: 1,
  visible: true,
  logo_path: null,
  video_url: null,
  pdf_url: null,
  pdf_tamano: null,
};

/** Cliente falso: guarda las columnas pedidas y responde con `respuesta`. */
function clienteFalso(respuesta: { data: unknown; error: unknown }) {
  const columnas: string[] = [];
  const consulta = {
    select: vi.fn((c: string) => {
      columnas.push(c);
      return consulta;
    }),
    eq: vi.fn(() => consulta),
    order: vi.fn(() => consulta),
    then: (resolver: (v: unknown) => unknown) => Promise.resolve(respuesta).then(resolver),
  };
  return { cliente: { from: vi.fn(() => consulta) }, columnas };
}

function sinNumeros(lista: { whatsapp: unknown; whatsappTexto: unknown; whatsappUrl: unknown }[]) {
  return lista.every((c) => c.whatsapp === null && c.whatsappTexto === null && c.whatsappUrl === null);
}

beforeEach(() => m.anonimo.mockReset());

describe("H-01 · carga pública (landing)", () => {
  it("no pide telefono_contacto y devuelve los convenios sin WhatsApp", async () => {
    const { cliente, columnas } = clienteFalso({ data: [FILA], error: null });
    m.anonimo.mockReturnValue(cliente);
    const lista = await cargarConvenios();
    expect(columnas).toHaveLength(1);
    expect(columnas[0]).not.toContain("telefono_contacto");
    expect(lista).toHaveLength(1);
    expect(sinNumeros(lista)).toBe(true);
  });

  it("si la consulta falla, el respaldo estático tampoco trae números", async () => {
    const { cliente } = clienteFalso({ data: null, error: { message: "42501" } });
    m.anonimo.mockReturnValue(cliente);
    const lista = await cargarConvenios();
    expect(lista.length).toBeGreaterThan(0);
    expect(sinNumeros(lista)).toBe(true);
  });
});

describe("H-01 · carga con sesión (/cuenta y demos)", () => {
  it("pide telefono_contacto con el cliente de la sesión y arma el enlace de WhatsApp", async () => {
    const { cliente, columnas } = clienteFalso({ data: [{ ...FILA, telefono_contacto: "3214612714" }], error: null });
    const [convenio] = await cargarConveniosAutenticados(cliente as never);
    expect(m.anonimo).not.toHaveBeenCalled();
    expect(columnas[0]).toContain("telefono_contacto");
    expect(convenio.whatsappTexto).toBe("321 461 2714");
    expect(convenio.whatsappUrl).toMatch(/^https:\/\/wa\.me\/573214612714\?text=/);
  });
});
