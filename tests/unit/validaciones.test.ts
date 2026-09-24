/**
 * Esquemas zod compartidos por cliente y servidor (lib/validaciones/).
 * Casos válidos e inválidos de cada campo + normalización.
 */
import { describe, expect, it } from "vitest";
import {
  esquemaAfiliacion,
  leerFormularioAfiliacion,
  valoresDeTextoAfiliacion,
} from "@/lib/validaciones/afiliacion";
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
// Afiliación (spec-fase-2 §2: nombres/apellidos, institución, Nequi, asesor, fotos)
// ---------------------------------------------------------------------------

/** Archivo de prueba válido (jpeg, 10 bytes: muy por debajo del límite de 5 MB). */
function fotoValida(nombre = "foto.jpg", tipo = "image/jpeg", bytes = 10) {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

const VALIDO = {
  nombres: "  Juan   Carlos  ",
  apellidos: "  Pérez   Gómez  ",
  cedula: "1.234.567.890",
  grado_id: "PT",
  institucion: "policia",
  nequi: "301 000 0000",
  celular: "300 123 4567",
  email: "Juan.Perez@Policia.Gov.Co",
  asesor_id: "",
  foto_cedula_frente: fotoValida("frente.jpg"),
  foto_cedula_reverso: fotoValida("reverso.jpg"),
  foto_selfie: fotoValida("selfie.jpg"),
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
    const datos = esquemaAfiliacion.parse(VALIDO);
    expect(datos).toMatchObject({
      nombres: "Juan Carlos",
      apellidos: "Pérez Gómez",
      cedula: "1234567890",
      grado_id: "PT",
      institucion: "policia",
      nequi: "3010000000",
      celular: "3001234567",
      email: "juan.perez@policia.gov.co",
      asesor_id: null,
      mensaje: null,
      acepto_datos: true,
    });
    expect(datos.foto_cedula_frente).toBeInstanceOf(File);
  });

  it("nombres: solo letras (con tildes y ñ) y espacios, 2 a 60 caracteres", () => {
    expect(errorDe("nombres", conCambio({ nombres: "" }))).toBe("Escribe tus nombres.");
    expect(errorDe("nombres", conCambio({ nombres: "A" }))).toMatch(/al menos 2/);
    expect(errorDe("nombres", conCambio({ nombres: "A".repeat(61) }))).toMatch(/máximo 60/);
    expect(errorDe("nombres", conCambio({ nombres: "Juan2" }))).toMatch(/solo puede tener letras/);
    expect(errorDe("nombres", conCambio({ nombres: "José Ñáñez" }))).toBeUndefined();
    expect(errorDe("nombres", conCambio({ nombres: "An" }))).toBeUndefined();
  });

  it("apellidos: misma regla que nombres, con su propio mensaje de vacío", () => {
    expect(errorDe("apellidos", conCambio({ apellidos: "" }))).toBe("Escribe tus apellidos.");
    expect(errorDe("apellidos", conCambio({ apellidos: "Ruiz-Gómez" }))).toMatch(/solo puede tener letras/);
    expect(errorDe("apellidos", conCambio({ apellidos: "Ruiz Gómez" }))).toBeUndefined();
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

  it.each(["policia", "ejercito"])("institución: acepta %s", (institucion) => {
    expect(errorDe("institucion", conCambio({ institucion }))).toBeUndefined();
  });
  it.each(["", "armada", "Policia"])("institución: rechaza %j", (institucion) => {
    expect(errorDe("institucion", conCambio({ institucion }))).toBe("Selecciona tu institución.");
  });

  it("Nequi: 10 dígitos que empiezan por 3, con su propio mensaje de vacío", () => {
    expect(errorDe("nequi", conCambio({ nequi: "" }))).toBe("Escribe tu número Nequi.");
    expect(errorDe("nequi", conCambio({ nequi: "2001234567" }))).toMatch(/empezar por 3/);
    expect(errorDe("nequi", conCambio({ nequi: "300123456" }))).toMatch(/10 dígitos/);
    expect(errorDe("nequi", conCambio({ nequi: "300 123 4567" }))).toBeUndefined();
  });

  it("celular: 10 dígitos que empiezan por 3", () => {
    expect(errorDe("celular", conCambio({ celular: "" }))).toBe("Escribe tu número de celular.");
    expect(errorDe("celular", conCambio({ celular: "2001234567" }))).toMatch(/empezar por 3/);
    expect(errorDe("celular", conCambio({ celular: "300123456" }))).toMatch(/10 dígitos/);
  });

  it("correo institucional: obligatorio, con formato y dominio según la institución", () => {
    expect(errorDe("email", conCambio({ email: "" }))).toBe("Escribe tu correo institucional.");
    expect(errorDe("email", conCambio({ email: "no-es-correo" }))).toMatch(/Revisa el correo/);
    // Formato válido pero dominio equivocado para la institución elegida.
    expect(errorDe("email", conCambio({ institucion: "policia", email: "juan@gmail.com" }))).toMatch(
      /institucional.*@policia\.gov\.co/,
    );
    expect(
      errorDe("email", conCambio({ institucion: "ejercito", email: "juan@policia.gov.co" })),
    ).toMatch(/institucional.*ejercito\.mil\.co/);
  });
  it.each([
    ["policia", "juan.perez@policia.gov.co"],
    ["ejercito", "juan.perez@ejercito.mil.co"],
    ["ejercito", "juan.perez@buzonejercito.mil.co"],
  ])("correo institucional: acepta %s con %s", (institucion, email) => {
    expect(errorDe("email", conCambio({ institucion, email }))).toBeUndefined();
  });

  it("asesor: opcional (vacío → null), si viene debe ser un uuid", () => {
    expect(esquemaAfiliacion.parse(conCambio({ asesor_id: "" })).asesor_id).toBeNull();
    expect(errorDe("asesor_id", conCambio({ asesor_id: "no-es-un-uuid" }))).toMatch(/asesor válido/);
    expect(
      errorDe("asesor_id", conCambio({ asesor_id: "550e8400-e29b-41d4-a716-446655440000" })),
    ).toBeUndefined();
  });

  it.each(["foto_cedula_frente", "foto_cedula_reverso", "foto_selfie"] as const)(
    "%s: obligatoria",
    (campo) => {
      expect(errorDe(campo, conCambio({ [campo]: null }))).toBeTruthy();
    },
  );
  it("fotos: rechaza un tipo que no sea jpeg/png/webp", () => {
    expect(
      errorDe("foto_cedula_frente", conCambio({ foto_cedula_frente: fotoValida("f.gif", "image/gif") })),
    ).toMatch(/JPG, PNG o WEBP/);
  });
  it("fotos: rechaza más de 5 MB", () => {
    const pesada = fotoValida("f.jpg", "image/jpeg", 5 * 1024 * 1024 + 1);
    expect(errorDe("foto_cedula_frente", conCambio({ foto_cedula_frente: pesada }))).toMatch(/5 MB/);
  });
  it.each(["image/jpeg", "image/png", "image/webp"])("fotos: acepta %s", (tipo) => {
    expect(errorDe("foto_selfie", conCambio({ foto_selfie: fotoValida("f", tipo) }))).toBeUndefined();
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
      nombres: "",
      apellidos: "",
      cedula: "",
      grado_id: "",
      institucion: "",
      nequi: "",
      celular: "",
      email: "",
      asesor_id: "no-es-un-uuid",
      foto_cedula_frente: null,
      foto_cedula_reverso: null,
      foto_selfie: null,
      mensaje: "",
      acepto_datos: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(erroresPorCampo(r.error)).sort()).toEqual(
        [
          "acepto_datos",
          "apellidos",
          "asesor_id",
          "cedula",
          "celular",
          "email",
          "foto_cedula_frente",
          "foto_cedula_reverso",
          "foto_selfie",
          "grado_id",
          "institucion",
          "nequi",
          "nombres",
        ].sort(),
      );
    }
  });

  it("lee el FormData del formulario (checkbox marcado = «on», fotos como File)", () => {
    const fd = new FormData();
    fd.append("nombres", "Ana");
    fd.append("acepto_datos", "on");
    fd.append("foto_selfie", fotoValida("selfie.jpg"));
    const entrada = leerFormularioAfiliacion(fd);
    expect(entrada.nombres).toBe("Ana");
    expect(entrada.cedula).toBe("");
    expect(entrada.acepto_datos).toBe(true);
    expect(entrada.foto_selfie).toBeInstanceOf(File);
    expect(entrada.foto_cedula_frente).toBeNull();
    expect(leerFormularioAfiliacion(new FormData()).acepto_datos).toBe(false);
  });

  it("valoresDeTextoAfiliacion: quita las 3 fotos y deja el resto de campos", () => {
    const entrada = leerFormularioAfiliacion(new FormData());
    const valores = valoresDeTextoAfiliacion(entrada);
    expect(valores).not.toHaveProperty("foto_cedula_frente");
    expect(valores).not.toHaveProperty("foto_cedula_reverso");
    expect(valores).not.toHaveProperty("foto_selfie");
    expect(valores).toMatchObject({ nombres: "", cedula: "", acepto_datos: false });
  });
});
