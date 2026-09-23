/**
 * Esquemas zod compartidos por cliente y servidor (lib/validaciones/).
 * Casos válidos e inválidos de cada campo + normalización.
 */
import { describe, expect, it } from "vitest";
import { esquemaAfiliacion, leerFormularioAfiliacion } from "@/lib/validaciones/afiliacion";
import {
  erroresPorCampo,
  esquemaCedula,
  esquemaCelular,
  esquemaCorreo,
  normalizarCedula,
  normalizarCelular,
  normalizarCorreo,
} from "@/lib/validaciones/comunes";
import { esquemaCodigo, esquemaIngresoCedula, leerCodigo } from "@/lib/validaciones/ingreso";
import { esquemaTelefono } from "@/lib/validaciones/perfil";

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------
describe("normalización", () => {
  it("cédula: quita espacios, puntos y guiones", () => {
    expect(normalizarCedula(" 1.234.567 890 ")).toBe("1234567890");
    expect(normalizarCedula("12-345-678")).toBe("12345678");
  });
  it("celular: quita separadores y el indicativo +57 / 57", () => {
    expect(normalizarCelular("300 123 4567")).toBe("3001234567");
    expect(normalizarCelular("(300) 123-45.67")).toBe("3001234567");
    expect(normalizarCelular("+57 300 123 4567")).toBe("3001234567");
    expect(normalizarCelular("573001234567")).toBe("3001234567");
  });
  it("correo: sin espacios y en minúsculas", () => {
    expect(normalizarCorreo("  Juan.Perez@Correo.COM ")).toBe("juan.perez@correo.com");
  });
});

// ---------------------------------------------------------------------------
// Cédula
// ---------------------------------------------------------------------------
describe("esquemaCedula", () => {
  it.each(["123456", "1234567890", "1.234.567", " 12 345 678 "])("acepta %j", (v) => {
    expect(esquemaCedula.safeParse(v).success).toBe(true);
  });
  it("devuelve la cédula normalizada", () => {
    expect(esquemaCedula.parse("1.234.567.890")).toBe("1234567890");
  });
  it.each(["", "   ", "12345", "12345678901", "12a456", "abcdef", "1234567,8", "+123456"])(
    "rechaza %j",
    (v) => {
      expect(esquemaCedula.safeParse(v).success).toBe(false);
    },
  );
  it("mensaje distinto para vacío y formato", () => {
    const vacio = esquemaCedula.safeParse("");
    const corto = esquemaCedula.safeParse("123");
    expect(vacio.success || vacio.error.issues[0].message).toBe("Escribe tu número de cédula.");
    expect(corto.success || corto.error.issues[0].message).toMatch(/entre 6 y 10/);
  });
  it("rechaza valores que no son texto", () => {
    expect(esquemaCedula.safeParse(123456).success).toBe(false);
    expect(esquemaCedula.safeParse(null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Celular
// ---------------------------------------------------------------------------
describe("esquemaCelular", () => {
  it.each(["3001234567", "310 987 6543", "+57 321 000 0000", "573150000000"])("acepta %j", (v) => {
    expect(esquemaCelular.safeParse(v).success).toBe(true);
  });
  it.each(["", "300123456", "30012345678", "2001234567", "6011234567", "300-123-456a", "+1 300 123 4567"])(
    "rechaza %j",
    (v) => {
      expect(esquemaCelular.safeParse(v).success).toBe(false);
    },
  );
  it("esquemaTelefono («Mis datos») usa la misma regla y normaliza", () => {
    expect(esquemaTelefono.parse({ telefono: "+57 300 123 4567" })).toEqual({ telefono: "3001234567" });
    expect(esquemaTelefono.safeParse({ telefono: "12345" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Correo
// ---------------------------------------------------------------------------
describe("esquemaCorreo", () => {
  it.each(["nombre@correo.com", "  Nombre.Apellido@Correo.co ", "a.b+c@sub.dominio.org"])("acepta %j", (v) => {
    expect(esquemaCorreo.safeParse(v).success).toBe(true);
  });
  it("lo deja en minúsculas", () => {
    expect(esquemaCorreo.parse("JUAN@CORREO.COM")).toBe("juan@correo.com");
  });
  it.each(["", "sin-arroba", "a@b", "@correo.com", "nombre@", "nom bre@correo.com", `${"a".repeat(250)}@correo.com`])(
    "rechaza %j",
    (v) => {
      expect(esquemaCorreo.safeParse(v).success).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// Ingreso
// ---------------------------------------------------------------------------
describe("ingreso", () => {
  it("paso 1: valida la cédula", () => {
    expect(esquemaIngresoCedula.parse({ cedula: "1.234.567.890" })).toEqual({ cedula: "1234567890" });
    expect(esquemaIngresoCedula.safeParse({ cedula: "12" }).success).toBe(false);
  });
  it.each(["123456", "000000", " 123 456 "])("código: acepta %j", (v) => {
    expect(esquemaCodigo.safeParse(v).success).toBe(true);
  });
  it.each(["", "12345", "1234567", "12a456", "abcdef"])("código: rechaza %j", (v) => {
    const r = esquemaCodigo.safeParse(v);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("El código no es válido o ya venció");
  });
  it("une las 6 casillas del formulario", () => {
    const fd = new FormData();
    ["4", "8", "1", "5", "9", "2"].forEach((d, i) => fd.append(`codigo-${i + 1}`, d));
    expect(leerCodigo(fd)).toBe("481592");
    expect(leerCodigo(new FormData())).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Afiliación
// ---------------------------------------------------------------------------
const VALIDO = {
  nombre: "  Juan   Pérez  ",
  cedula: "1.234.567.890",
  grado_id: "PT",
  unidad: "",
  celular: "300 123 4567",
  email: "Juan@Correo.com",
  mensaje: "   ",
  acepto_datos: true,
};

function conCambio(cambio: Partial<Record<keyof typeof VALIDO, unknown>>) {
  return { ...VALIDO, ...cambio };
}

function errorDe(campo: string, entrada: unknown) {
  const r = esquemaAfiliacion.safeParse(entrada);
  if (r.success) return undefined;
  return erroresPorCampo<string>(r.error)[campo];
}

describe("esquemaAfiliacion", () => {
  it("acepta un formulario válido y normaliza", () => {
    expect(esquemaAfiliacion.parse(VALIDO)).toEqual({
      nombre: "Juan Pérez",
      cedula: "1234567890",
      grado_id: "PT",
      unidad: null,
      celular: "3001234567",
      email: "juan@correo.com",
      mensaje: null,
      acepto_datos: true,
    });
  });

  it("nombre: 3–120 caracteres", () => {
    expect(errorDe("nombre", conCambio({ nombre: "" }))).toBe("Escribe tus nombres y apellidos.");
    expect(errorDe("nombre", conCambio({ nombre: "Al" }))).toMatch(/al menos 3/);
    expect(errorDe("nombre", conCambio({ nombre: "A".repeat(121) }))).toMatch(/máximo 120/);
    expect(errorDe("nombre", conCambio({ nombre: "Ana" }))).toBeUndefined();
    expect(errorDe("nombre", conCambio({ nombre: "A".repeat(120) }))).toBeUndefined();
  });

  it("cédula: 6–10 dígitos", () => {
    expect(errorDe("cedula", conCambio({ cedula: "12345" }))).toBeTruthy();
    expect(errorDe("cedula", conCambio({ cedula: "12345678901" }))).toBeTruthy();
    expect(errorDe("cedula", conCambio({ cedula: "123456" }))).toBeUndefined();
  });

  it.each(["PP", "PT", "SI", "IT", "OF"])("grado: acepta %s", (grado) => {
    expect(errorDe("grado_id", conCambio({ grado_id: grado }))).toBeUndefined();
  });
  it.each(["", "pp", "XX", "Patrullero"])("grado: rechaza %j", (grado) => {
    expect(errorDe("grado_id", conCambio({ grado_id: grado }))).toBe("Selecciona tu grado.");
  });

  it("unidad: opcional, hasta 120", () => {
    expect(errorDe("unidad", conCambio({ unidad: "" }))).toBeUndefined();
    expect(errorDe("unidad", conCambio({ unidad: "U".repeat(120) }))).toBeUndefined();
    expect(errorDe("unidad", conCambio({ unidad: "U".repeat(121) }))).toMatch(/máximo 120/);
  });

  it("celular: 10 dígitos que empiezan por 3", () => {
    expect(errorDe("celular", conCambio({ celular: "" }))).toBe("Escribe tu número de celular.");
    expect(errorDe("celular", conCambio({ celular: "2001234567" }))).toMatch(/empezar por 3/);
    expect(errorDe("celular", conCambio({ celular: "300123456" }))).toMatch(/10 dígitos/);
  });

  it("correo: obligatorio y con formato", () => {
    expect(errorDe("email", conCambio({ email: "" }))).toBe("Escribe tu correo electrónico.");
    expect(errorDe("email", conCambio({ email: "no-es-correo" }))).toMatch(/Revisa el correo/);
  });

  it("mensaje: opcional, hasta 500", () => {
    expect(errorDe("mensaje", conCambio({ mensaje: "M".repeat(500) }))).toBeUndefined();
    expect(errorDe("mensaje", conCambio({ mensaje: "M".repeat(501) }))).toMatch(/máximo 500/);
  });

  it("autorización de datos: obligatoria", () => {
    expect(errorDe("acepto_datos", conCambio({ acepto_datos: false }))).toMatch(/autorizar/);
    expect(errorDe("acepto_datos", conCambio({ acepto_datos: "on" }))).toMatch(/autorizar/);
  });

  it("reporta un error por cada campo inválido", () => {
    const r = esquemaAfiliacion.safeParse({
      nombre: "",
      cedula: "",
      grado_id: "",
      unidad: "",
      celular: "",
      email: "",
      mensaje: "",
      acepto_datos: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(erroresPorCampo(r.error)).sort()).toEqual(
        ["acepto_datos", "cedula", "celular", "email", "grado_id", "nombre"].sort(),
      );
    }
  });

  it("lee el FormData del formulario (checkbox marcado = «on»)", () => {
    const fd = new FormData();
    fd.append("nombre", "Ana Ruiz");
    fd.append("acepto_datos", "on");
    const entrada = leerFormularioAfiliacion(fd);
    expect(entrada.nombre).toBe("Ana Ruiz");
    expect(entrada.cedula).toBe("");
    expect(entrada.acepto_datos).toBe(true);
    expect(leerFormularioAfiliacion(new FormData()).acepto_datos).toBe(false);
  });
});
