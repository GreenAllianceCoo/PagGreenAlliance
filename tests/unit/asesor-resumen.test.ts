/**
 * Funciones puras sobre `resumen_clientes_asesor()` (lib/asesor/resumen.ts).
 * «El resumen no incluye campos privados»: aunque llegara un objeto con
 * celular/correo/nequi/fotos (por error de la RPC o de un mock en pruebas),
 * `sanitizarFilaResumen` nunca los deja pasar a la UI.
 */
import { describe, expect, it } from "vitest";
import {
  estadoCliente,
  filtrarClientes,
  idFilaResumen,
  opcionesEstadoCliente,
  sanitizarFilaResumen,
  type FilaResumenAsesor,
} from "@/lib/asesor/resumen";

function fila(datos: Partial<FilaResumenAsesor> & Pick<FilaResumenAsesor, "origen" | "nombre" | "cedula" | "grado">): FilaResumenAsesor {
  return {
    perfil_id: null,
    solicitud_id: null,
    estado_afiliacion: null,
    estado_credito: null,
    ...datos,
  };
}

describe("sanitizarFilaResumen · nunca campos privados", () => {
  it("descarta celular, email, nequi y fotos aunque vengan en la fila cruda", () => {
    const cruda = {
      origen: "asociado",
      perfil_id: "id-1",
      nombre: "Juan Pérez",
      cedula: "1234567890",
      grado: "PP",
      estado_afiliacion: null,
      estado_credito: "pendiente",
      // Campos que NUNCA debe exponer resumen_clientes_asesor(); si llegaran
      // por error, sanitizarFilaResumen los debe quitar igual.
      celular: "3001234567",
      email: "juan@correo.com",
      nequi: "3001234567",
      foto_cedula_frente: "afiliacion-documentos/x/frente.jpg",
      foto_selfie: "afiliacion-documentos/x/selfie.jpg",
    };
    const limpia = sanitizarFilaResumen(cruda);
    expect(limpia).not.toHaveProperty("celular");
    expect(limpia).not.toHaveProperty("email");
    expect(limpia).not.toHaveProperty("nequi");
    expect(limpia).not.toHaveProperty("foto_cedula_frente");
    expect(limpia).not.toHaveProperty("foto_selfie");
    expect(Object.keys(limpia).sort()).toEqual(
      ["cedula", "estado_afiliacion", "estado_credito", "grado", "nombre", "origen", "perfil_id", "solicitud_id"].sort(),
    );
    expect(limpia.nombre).toBe("Juan Pérez");
    expect(limpia.cedula).toBe("1234567890");
  });

  it("no serializa nada más si se pasa el objeto entero a JSON (control extra de fuga)", () => {
    const cruda = { origen: "asociado", nombre: "A", cedula: "1", grado: "PP", nequi: "3009998877" };
    const limpia = sanitizarFilaResumen(cruda);
    expect(JSON.stringify(limpia)).not.toContain("3009998877");
  });
});

describe("idFilaResumen", () => {
  it("usa perfil_id cuando es un asociado", () => {
    expect(idFilaResumen(fila({ origen: "asociado", nombre: "A", cedula: "1", grado: "PP", perfil_id: "p-1" }))).toBe("p-1");
  });
  it("usa solicitud_id cuando es una solicitud de afiliación", () => {
    expect(
      idFilaResumen(fila({ origen: "solicitud_afiliacion", nombre: "A", cedula: "1", grado: "PP", solicitud_id: "s-1" })),
    ).toBe("s-1");
  });
});

describe("estadoCliente", () => {
  it("asociado sin solicitud de crédito", () => {
    expect(estadoCliente(fila({ origen: "asociado", nombre: "A", cedula: "1", grado: "PP" }))).toEqual({
      clave: "asociado",
      etiqueta: "Asociado sin solicitud",
    });
  });
  it.each([
    ["pendiente", "Crédito en revisión"],
    ["aprobado", "Crédito aprobado"],
    ["rechazado", "Crédito rechazado"],
  ] as const)("asociado con crédito %s", (estado, etiqueta) => {
    const f = fila({ origen: "asociado", nombre: "A", cedula: "1", grado: "PP", estado_credito: estado });
    expect(estadoCliente(f)).toEqual({ clave: `credito_${estado}`, etiqueta });
  });
  it.each([
    ["pendiente", "Afiliación pendiente"],
    ["contactado", "Afiliación contactada"],
    ["aprobada", "Afiliación aprobada"],
    ["rechazada", "Afiliación rechazada"],
  ] as const)("solicitud de afiliación %s", (estado, etiqueta) => {
    const f = fila({ origen: "solicitud_afiliacion", nombre: "A", cedula: "1", grado: "PP", estado_afiliacion: estado });
    expect(estadoCliente(f)).toEqual({ clave: `afiliacion_${estado}`, etiqueta });
  });
});

describe("filtrarClientes", () => {
  const filas = [
    fila({ origen: "asociado", nombre: "Juan Pérez", cedula: "1000000001", grado: "PP", estado_credito: "aprobado" }),
    fila({ origen: "asociado", nombre: "María Gómez", cedula: "1000000002", grado: "OF" }),
    fila({ origen: "solicitud_afiliacion", nombre: "Andrés Ruiz", cedula: "1000000003", grado: "PT", estado_afiliacion: "pendiente" }),
  ];

  it("sin filtros devuelve todo", () => {
    expect(filtrarClientes(filas, {})).toHaveLength(3);
  });

  it("busca por nombre sin distinguir tildes ni mayúsculas", () => {
    expect(filtrarClientes(filas, { busqueda: "perez" })).toHaveLength(1);
    expect(filtrarClientes(filas, { busqueda: "PÉREZ" })).toHaveLength(1);
  });

  it("busca por cédula (coincidencia parcial)", () => {
    expect(filtrarClientes(filas, { busqueda: "0002" })).toHaveLength(1);
  });

  it("filtra por estado", () => {
    expect(filtrarClientes(filas, { estado: "credito_aprobado" })).toHaveLength(1);
    expect(filtrarClientes(filas, { estado: "afiliacion_pendiente" })).toHaveLength(1);
    expect(filtrarClientes(filas, { estado: "asociado" })).toHaveLength(1);
  });

  it("combina búsqueda y estado", () => {
    expect(filtrarClientes(filas, { busqueda: "maria", estado: "asociado" })).toHaveLength(1);
    expect(filtrarClientes(filas, { busqueda: "maria", estado: "credito_aprobado" })).toHaveLength(0);
  });
});

describe("opcionesEstadoCliente", () => {
  it("siempre incluye «Todos» y solo los estados presentes, sin repetir", () => {
    const filas = [
      fila({ origen: "asociado", nombre: "A", cedula: "1", grado: "PP", estado_credito: "aprobado" }),
      fila({ origen: "asociado", nombre: "B", cedula: "2", grado: "PP", estado_credito: "aprobado" }),
    ];
    const opciones = opcionesEstadoCliente(filas);
    expect(opciones[0].clave).toBe("todos");
    expect(opciones).toHaveLength(2);
  });

  it("sin clientes solo devuelve «Todos»", () => {
    expect(opcionesEstadoCliente([])).toEqual([{ clave: "todos", etiqueta: "Todos los estados" }]);
  });
});
