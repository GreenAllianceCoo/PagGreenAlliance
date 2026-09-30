/**
 * «Quiero afiliarme» v3 (spec-requerimientos-ricardo §1–§2): esquema zod
 * compartido por el navegador y la Server Action. Casos válidos e inválidos
 * de cada campo: grado según la institución, cuenta de nómina en cascada
 * (banco / billetera / «Otra, ¿cuál?»), dos correos distintos, asesor de la
 * lista y rutas de fotos del prefijo de la solicitud.
 */
import { describe, expect, it } from "vitest";
import { buscarEntidades, OPCION_OTRA_ENTIDAD, pasosCuentaNomina } from "@/lib/afiliacion/entidades";
import {
  gradosDeInstitucion,
  gradoTrasCambiarInstitucion,
  nombreDeGrado,
  type GradoCatalogo,
} from "@/lib/gradosCatalogo";
import {
  crearEsquemaAfiliacion,
  crearEsquemaDatosAfiliacion,
  esquemaArchivosAfiliacion,
  esquemaPrepararSubida,
  leerArchivosAfiliacion,
  leerFormularioAfiliacion,
  valoresDeTextoAfiliacion,
} from "@/lib/validaciones/afiliacion";
import { erroresPorCampo } from "@/lib/validaciones/comunes";

/** Catálogo como el de la migración 20260929100100 (subconjunto suficiente). */
function g(codigo: string, policia: boolean, ejercito: boolean, grupo: GradoCatalogo["grupoCredito"], orden: number, seleccionable = true): GradoCatalogo {
  return { codigo, nombre: `Grado ${codigo}`, policia, ejercito, grupoCredito: grupo, orden, seleccionable };
}
const CATALOGO: GradoCatalogo[] = [
  g("PP", true, false, "PP", 1),
  g("IJ", true, false, null, 5),
  g("SLP", false, true, null, 6),
  g("CS", false, true, null, 8),
  g("TE", true, true, "OF", 14),
  g("OF", true, true, "OF", 99, false),
];
const ASESOR = "550e8400-e29b-41d4-a716-446655440000";
const CTX = { grados: CATALOGO, asesores: [{ id: ASESOR }] };
const SOLICITUD = "11111111-2222-4333-8444-555555555555";

const VALIDO = {
  nombres: "  Juan   Carlos  ",
  apellidos: "  Pérez   Gómez  ",
  cedula: "1.234.567.890",
  institucion: "policia",
  grado_id: "PP",
  nequi: "301 000 0000",
  nomina_entidad: "Bancolombia",
  nomina_entidad_otra: "",
  nomina_tipo: "ahorros",
  nomina_numero: "123-456 789",
  celular: "300 123 4567",
  correo_institucional: "Juan.Perez@Policia.Gov.Co",
  email: "  JUAN.perez@gmail.com ",
  asesor_id: "",
  mensaje: "   ",
  acepto_datos: true,
  foto_cedula_frente: `solicitudes/${SOLICITUD}/frente.jpg`,
  foto_cedula_reverso: `solicitudes/${SOLICITUD}/reverso.png`,
  foto_selfie: `solicitudes/${SOLICITUD}/selfie.webp`,
  fotos_ticket: "ticket",
};

const esquema = crearEsquemaAfiliacion(CTX);
const conCambio = (cambio: Partial<Record<keyof typeof VALIDO, unknown>>) => ({ ...VALIDO, ...cambio });
function errorDe(campo: string, entrada: unknown) {
  const r = esquema.safeParse(entrada);
  if (r.success) return undefined;
  return erroresPorCampo<string>(r.error)[campo];
}

describe("afiliación v3 · formulario válido", () => {
  it("acepta y normaliza (cédula, celulares, correos, nómina)", () => {
    const datos = esquema.parse(VALIDO);
    expect(datos).toMatchObject({
      nombres: "Juan Carlos",
      apellidos: "Pérez Gómez",
      cedula: "1234567890",
      institucion: "policia",
      grado_id: "PP",
      nequi: "3010000000",
      celular: "3001234567",
      correo_institucional: "juan.perez@policia.gov.co",
      email: "juan.perez@gmail.com",
      asesor_id: null,
      mensaje: null,
      nomina: { entidad: "Bancolombia", tipo: "ahorros", numero: "123456789" },
    });
  });

  it("el esquema de solo datos (sin fotos) también acepta el texto", () => {
    const { foto_cedula_frente: _a, foto_cedula_reverso: _b, foto_selfie: _c, fotos_ticket: _d, ...texto } = VALIDO;
    void [_a, _b, _c, _d];
    expect(crearEsquemaDatosAfiliacion(CTX).safeParse(texto).success).toBe(true);
  });
});

describe("afiliación v3 · campos de siempre", () => {
  it("nombres y apellidos: letras y espacios, 2 a 60", () => {
    expect(errorDe("nombres", conCambio({ nombres: "" }))).toBe("Escribe tus nombres.");
    expect(errorDe("nombres", conCambio({ nombres: "Juan2" }))).toMatch(/solo puede tener letras/);
    expect(errorDe("apellidos", conCambio({ apellidos: "A" }))).toMatch(/al menos 2/);
  });
  it("cédula: 6–10 dígitos", () => {
    expect(errorDe("cedula", conCambio({ cedula: "12345" }))).toBeTruthy();
    expect(errorDe("cedula", conCambio({ cedula: "123456" }))).toBeUndefined();
  });
  it("Nequi y celular: 10 dígitos que empiezan por 3", () => {
    expect(errorDe("nequi", conCambio({ nequi: "" }))).toBe("Escribe tu número Nequi.");
    expect(errorDe("celular", conCambio({ celular: "2001234567" }))).toMatch(/empezar por 3/);
  });
  it("mensaje opcional hasta 500 y autorización obligatoria", () => {
    expect(errorDe("mensaje", conCambio({ mensaje: "M".repeat(501) }))).toMatch(/máximo 500/);
    expect(errorDe("acepto_datos", conCambio({ acepto_datos: false }))).toMatch(/autorizar/);
  });
});

describe("afiliación v3 · institución y grado (§1)", () => {
  it.each(["", "armada", "Policia"])("institución: rechaza %j", (institucion) => {
    expect(errorDe("institucion", conCambio({ institucion }))).toBe("Selecciona tu institución.");
  });
  it("Policía: acepta PP, IJ y TE", () => {
    for (const grado_id of ["PP", "IJ", "TE"]) expect(errorDe("grado_id", conCambio({ grado_id }))).toBeUndefined();
  });
  it("Ejército: acepta SLP, CS y TE", () => {
    for (const grado_id of ["SLP", "CS", "TE"]) {
      expect(errorDe("grado_id", conCambio({ institucion: "ejercito", grado_id }))).toBeUndefined();
    }
  });
  it("rechaza un grado de la otra institución", () => {
    expect(errorDe("grado_id", conCambio({ institucion: "ejercito", grado_id: "PP" }))).toBe(
      "Ese grado no corresponde a la institución que elegiste.",
    );
    expect(errorDe("grado_id", conCambio({ institucion: "policia", grado_id: "CS" }))).toBe(
      "Ese grado no corresponde a la institución que elegiste.",
    );
  });
  it.each(["", "XX", "pp", "OF"])("rechaza %j (vacío, inexistente o heredado no seleccionable)", (grado_id) => {
    expect(errorDe("grado_id", conCambio({ grado_id }))).toBe("Selecciona tu grado.");
  });
});

describe("afiliación v3 · cuenta de nómina en cascada (§2.6)", () => {
  it("banco: exige tipo (ahorros/corriente) y 6–20 dígitos", () => {
    expect(errorDe("nomina_tipo", conCambio({ nomina_tipo: "" }))).toBe("Elige el tipo de cuenta.");
    expect(errorDe("nomina_tipo", conCambio({ nomina_tipo: "deposito_electronico" }))).toBe("Elige el tipo de cuenta.");
    expect(errorDe("nomina_numero", conCambio({ nomina_numero: "" }))).toBe("Escribe el número de tu cuenta de nómina.");
    expect(errorDe("nomina_numero", conCambio({ nomina_numero: "12345" }))).toMatch(/entre 6 y 20/);
    expect(errorDe("nomina_numero", conCambio({ nomina_numero: "1".repeat(21) }))).toMatch(/entre 6 y 20/);
    expect(errorDe("nomina_numero", conCambio({ nomina_numero: "12A456" }))).toMatch(/entre 6 y 20/);
    expect(esquema.parse(conCambio({ nomina_tipo: "corriente" })).nomina.tipo).toBe("corriente");
  });

  it("billetera (R-03): no pide tipo, guarda deposito_electronico y el número es un celular", () => {
    const datos = esquema.parse(conCambio({ nomina_entidad: "Nequi", nomina_tipo: "", nomina_numero: "+57 310 555 1234" }));
    expect(datos.nomina).toEqual({ entidad: "Nequi", tipo: "deposito_electronico", numero: "3105551234" });
    expect(errorDe("nomina_numero", conCambio({ nomina_entidad: "Daviplata", nomina_numero: "123456789" }))).toMatch(
      /10 dígitos que empiezan por 3/,
    );
    // Aunque llegue un tipo manipulado, una billetera siempre queda como depósito electrónico.
    expect(esquema.parse(conCambio({ nomina_entidad: "Dale!", nomina_tipo: "corriente", nomina_numero: "3001112233" })).nomina.tipo).toBe(
      "deposito_electronico",
    );
  });

  it("«Otra, ¿cuál?»: exige el nombre (2 a 60) y lo guarda como entidad", () => {
    expect(errorDe("nomina_entidad_otra", conCambio({ nomina_entidad: OPCION_OTRA_ENTIDAD }))).toBe(
      "Escribe el nombre de tu banco o entidad.",
    );
    expect(errorDe("nomina_entidad_otra", conCambio({ nomina_entidad: OPCION_OTRA_ENTIDAD, nomina_entidad_otra: "X" }))).toMatch(
      /entre 2 y 60/,
    );
    const datos = esquema.parse(conCambio({ nomina_entidad: OPCION_OTRA_ENTIDAD, nomina_entidad_otra: "  Cooperativa   X " }));
    expect(datos.nomina.entidad).toBe("Cooperativa X");
  });

  it("rechaza entidad vacía o que no está en la lista", () => {
    expect(errorDe("nomina_entidad", conCambio({ nomina_entidad: "" }))).toBe("Elige la entidad de tu cuenta de nómina.");
    expect(errorDe("nomina_entidad", conCambio({ nomina_entidad: "Banco Inventado" }))).toBe(
      "Elige la entidad de tu cuenta de nómina.",
    );
  });

  it("utilidades del desplegable: búsqueda sin tildes y pasos de la cascada", () => {
    expect(buscarEntidades("bogota").map((o) => o.valor)).toEqual(["Banco de Bogotá", OPCION_OTRA_ENTIDAD]);
    expect(buscarEntidades("UALA")[0].valor).toBe("Ualá");
    expect(buscarEntidades("").length).toBe(27 + 8 + 1);
    expect(pasosCuentaNomina("Nequi")).toEqual({ pideTipo: false, pideNumero: true, pideNombreOtra: false });
    expect(pasosCuentaNomina("Bancolombia")).toEqual({ pideTipo: true, pideNumero: true, pideNombreOtra: false });
    expect(pasosCuentaNomina(OPCION_OTRA_ENTIDAD).pideNombreOtra).toBe(true);
    expect(pasosCuentaNomina("")).toEqual({ pideTipo: false, pideNumero: false, pideNombreOtra: false });
  });
});

describe("afiliación v3 · dos correos (§2.8)", () => {
  it("los dos son obligatorios y con formato", () => {
    expect(errorDe("correo_institucional", conCambio({ correo_institucional: "" }))).toBe("Escribe tu correo institucional.");
    expect(errorDe("email", conCambio({ email: "" }))).toBe("Escribe tu correo personal.");
    expect(errorDe("email", conCambio({ email: "no-es-correo" }))).toMatch(/no es válido/);
  });
  it("deben ser distintos (sin importar mayúsculas ni espacios)", () => {
    expect(errorDe("email", conCambio({ email: " juan.PEREZ@policia.gov.co " }))).toBe(
      "Tu correo personal debe ser distinto del institucional.",
    );
  });
  it("exigen el dominio de la institución (§12.3)", () => {
    expect(errorDe("correo_institucional", conCambio({ correo_institucional: "juan@hotmail.com" }))).toBe(
      "Usa tu correo institucional de la Policía (@policia.gov.co)",
    );
    expect(errorDe("correo_institucional", conCambio({ correo_institucional: "Juan@Policia.gov.co" }))).toBeUndefined();
  });
});

describe("afiliación v3 · asesor (§2.9)", () => {
  it("vacío = «No tengo asesor» → null", () => {
    expect(esquema.parse(VALIDO).asesor_id).toBeNull();
  });
  it("acepta un asesor de la lista y rechaza uno que no está (aunque sea un uuid)", () => {
    expect(errorDe("asesor_id", conCambio({ asesor_id: ASESOR }))).toBeUndefined();
    expect(errorDe("asesor_id", conCambio({ asesor_id: "660e8400-e29b-41d4-a716-446655440000" }))).toBe(
      "Selecciona un asesor de la lista.",
    );
    expect(errorDe("asesor_id", conCambio({ asesor_id: "no-es-uuid" }))).toBe("Selecciona un asesor de la lista.");
  });
});

describe("afiliación v3 · fotos por URL firmada (§2.10)", () => {
  it.each(["foto_cedula_frente", "foto_cedula_reverso", "foto_selfie"] as const)("%s: obligatoria", (campo) => {
    expect(errorDe(campo, conCambio({ [campo]: "" }))).toBeTruthy();
  });
  it("rechaza rutas fuera del prefijo o con otro tipo de foto", () => {
    expect(errorDe("foto_cedula_frente", conCambio({ foto_cedula_frente: `${SOLICITUD}/frente.jpg` }))).toBeTruthy();
    expect(errorDe("foto_cedula_frente", conCambio({ foto_cedula_frente: `solicitudes/${SOLICITUD}/selfie.jpg` }))).toBeTruthy();
    expect(errorDe("foto_selfie", conCambio({ foto_selfie: `solicitudes/../otro/selfie.jpg` }))).toBeTruthy();
    expect(errorDe("foto_selfie", conCambio({ foto_selfie: `solicitudes/${SOLICITUD}/selfie.gif` }))).toBeTruthy();
  });
  it("exige el ticket", () => {
    expect(errorDe("fotos_ticket", conCambio({ fotos_ticket: "" }))).toBe("Vuelve a subir tus fotos.");
  });
  it("archivos en el navegador: tipo jpeg/png/webp y máximo 5 MB", () => {
    const foto = (tipo: string, bytes = 10) => new File([new Uint8Array(bytes)], "f", { type: tipo });
    const bien = { foto_cedula_frente: foto("image/jpeg"), foto_cedula_reverso: foto("image/png"), foto_selfie: foto("image/webp") };
    expect(esquemaArchivosAfiliacion.safeParse(bien).success).toBe(true);
    const gif = esquemaArchivosAfiliacion.safeParse({ ...bien, foto_selfie: foto("image/gif") });
    expect(gif.success).toBe(false);
    const pesada = esquemaArchivosAfiliacion.safeParse({ ...bien, foto_cedula_frente: foto("image/jpeg", 5 * 1024 * 1024 + 1) });
    expect(!pesada.success && pesada.error.issues[0].message).toMatch(/5 MB/);
    const falta = esquemaArchivosAfiliacion.safeParse({ ...bien, foto_selfie: null });
    expect(!falta.success && falta.error.issues[0].message).toBe("Toma tu selfie.");
  });
  it("prepararSubida solo acepta los 3 tipos permitidos", () => {
    expect(esquemaPrepararSubida.safeParse({ foto_cedula_frente: "image/jpeg", foto_cedula_reverso: "image/png", foto_selfie: "image/webp" }).success).toBe(true);
    expect(esquemaPrepararSubida.safeParse({ foto_cedula_frente: "image/gif", foto_cedula_reverso: "image/png", foto_selfie: "image/webp" }).success).toBe(false);
  });
});

describe("afiliación v3 · un error por campo inválido", () => {
  it("reporta todos los campos de una vez (también los de reglas cruzadas, como la nómina)", () => {
    const r = esquema.safeParse({
      nombres: "",
      apellidos: "",
      cedula: "",
      institucion: "",
      grado_id: "",
      nequi: "",
      nomina_entidad: "",
      nomina_entidad_otra: "",
      nomina_tipo: "",
      nomina_numero: "",
      celular: "",
      correo_institucional: "",
      email: "",
      asesor_id: "x",
      mensaje: "",
      acepto_datos: false,
      foto_cedula_frente: "",
      foto_cedula_reverso: "",
      foto_selfie: "",
      fotos_ticket: "",
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
          "correo_institucional",
          "email",
          "foto_cedula_frente",
          "foto_cedula_reverso",
          "foto_selfie",
          "fotos_ticket",
          "grado_id",
          "institucion",
          "nequi",
          "nomina_entidad",
          "nombres",
        ].sort(),
      );
    }
  });
});

describe("afiliación v3 · FormData", () => {
  it("lee texto, rutas y ticket; los archivos por separado", () => {
    const fd = new FormData();
    fd.append("nombres", "Ana");
    fd.append("acepto_datos", "on");
    fd.append("nomina_entidad", "Nequi");
    fd.append("foto_selfie", new File([new Uint8Array(4)], "s.jpg", { type: "image/jpeg" }));
    const entrada = leerFormularioAfiliacion(fd);
    expect(entrada).toMatchObject({ nombres: "Ana", acepto_datos: true, nomina_entidad: "Nequi", foto_selfie: "", fotos_ticket: "" });
    expect(leerArchivosAfiliacion(fd).foto_selfie).toBeInstanceOf(File);
    expect(leerArchivosAfiliacion(fd).foto_cedula_frente).toBeNull();
    const valores = valoresDeTextoAfiliacion(entrada);
    expect(valores).not.toHaveProperty("foto_selfie");
    expect(valores).not.toHaveProperty("fotos_ticket");
  });
});

describe("catálogo de grados · filtro por institución (§1)", () => {
  it("Policía y Ejército ven solo sus grados seleccionables, en orden", () => {
    expect(gradosDeInstitucion(CATALOGO, "policia").map((x) => x.codigo)).toEqual(["PP", "IJ", "TE"]);
    expect(gradosDeInstitucion(CATALOGO, "ejercito").map((x) => x.codigo)).toEqual(["SLP", "CS", "TE"]);
    expect(gradosDeInstitucion(CATALOGO, "")).toEqual([]);
  });
  it("al cambiar de institución, el grado se limpia si ya no aplica", () => {
    expect(gradoTrasCambiarInstitucion(CATALOGO, "ejercito", "PP")).toBe("");
    expect(gradoTrasCambiarInstitucion(CATALOGO, "ejercito", "TE")).toBe("TE");
    expect(gradoTrasCambiarInstitucion(CATALOGO, "policia", "")).toBe("");
  });
  it("nombreDeGrado", () => {
    expect(nombreDeGrado(CATALOGO, "TE")).toBe("Grado TE");
    expect(nombreDeGrado(CATALOGO, "ZZ")).toBe("ZZ");
    expect(nombreDeGrado(CATALOGO, null)).toBeNull();
  });
});
