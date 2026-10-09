import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import zlib from "node:zlib";
import {
  adminRest,
  anonRest,
  borrarAfiliaciones,
  cedulaUnica,
  datosValidos,
  type DatosFormulario,
  llenarAfiliacion,
  ENV_LOCAL,
  limpiarLimites,
  SUPABASE_URL,
  tokenDeUsuario,
  USUARIOS,
  usuarioRest,
} from "./utils";

/**
 * D. Formulario «Deseo afiliarme» v2 (docs/spec-fase-2.md §2, mapa-de-botones §5).
 *
 * Reescrito para la afiliación con nombres/apellidos separados, institución,
 * Nequi, asesor y 3 fotos (antes: un solo campo «Nombres y apellidos», sin
 * institución/Nequi/asesor/fotos). Ver components/pantallas/Afiliacion.tsx,
 * components/pantallas/afiliacion/CampoFoto.tsx, lib/validaciones/afiliacion.ts
 * y app/afiliacion/actions.ts.
 */

const SERVICE_KEY = ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ASESOR_PRUEBA_ID = "9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c"; // supabase/seed.sql

const creadas: string[] = [];

test.beforeEach(async () => {
  await limpiarLimites();
});

test.afterAll(async () => {
  for (const cedula of creadas) {
    await borrarAfiliaciones(cedula);
    await borrarFotosBucket(cedula);
  }
});

// ---------------------------------------------------------------------------
// Fila de la base y objetos del bucket (API de administración, service role)
// ---------------------------------------------------------------------------

async function filasPorCedula(cedula: string) {
  const { cuerpo } = await adminRest(
    `solicitudes_afiliacion?select=*&cedula=eq.${encodeURIComponent(cedula)}`,
  );
  return (Array.isArray(cuerpo) ? cuerpo : []) as Record<string, unknown>[];
}

/** `true` si el servidor (service role) puede leer ese objeto del bucket privado. */
async function objetoExisteEnBucket(rutaConBucket: string) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${rutaConBucket}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return r.status === 200;
}

/** Limpieza de las fotos que haya dejado una prueba (bucket local, solo QA). */
async function borrarFotosBucket(cedula: string) {
  const listado = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/afiliacion-documentos`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: `${cedula}/`, limit: 100 }),
    },
  );
  const archivos = (await listado.json().catch(() => [])) as { name: string }[];
  if (!Array.isArray(archivos) || archivos.length === 0) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/afiliacion-documentos`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefixes: archivos.map((a) => `${cedula}/${a.name}`),
    }),
  });
}

// ---------------------------------------------------------------------------
// Genera un PNG válido (de verdad decodificable) de un peso aproximado, para
// probar fotos «de cámara» pesadas sin depender de archivos en disco. Franjas
// de color suave (no ruido): así, cuando el navegador la recomprime a JPEG
// (CampoFoto, S-03), el resultado es liviano y la prueba no depende de cuánto
// comprime el motor JPEG un contenido al azar.
// ---------------------------------------------------------------------------

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++)
    crc = TABLA_CRC[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function trozoPng(tipo: string, datos: Buffer): Buffer {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length, 0);
  const tipoBuf = Buffer.from(tipo, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])), 0);
  return Buffer.concat([longitud, tipoBuf, datos, crc]);
}

function generarPng(pesoAprox: number, ancho = 400): Buffer {
  const bytesPorFila = 1 + ancho * 3; // 1 byte de filtro + RGB
  const alto = Math.max(1, Math.round(pesoAprox / bytesPorFila));
  const cruda = Buffer.alloc(bytesPorFila * alto);
  for (let f = 0; f < alto; f++) {
    const base = f * bytesPorFila;
    cruda[base] = 0; // filtro «None»
    const t = f / alto;
    const r = 20 + Math.floor(200 * t);
    const g = 20 + Math.floor(180 * (1 - t));
    for (let x = 0; x < ancho; x++) {
      const i = base + 1 + x * 3;
      cruda[i] = r;
      cruda[i + 1] = g;
      cruda[i + 2] = 140 + (x % 7);
    }
  }
  const idat = zlib.deflateSync(cruda, { level: 0 }); // «stored»: el peso lo decide el tamaño, no el contenido
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad de bit
  ihdr[9] = 2; // color: truecolor RGB
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    firma,
    trozoPng("IHDR", ihdr),
    trozoPng("IDAT", idat),
    trozoPng("IEND", Buffer.alloc(0)),
  ]);
}

type ArchivoSubida = { name: string; mimeType: string; buffer: Buffer };

function archivoPng(nombre: string, pesoAprox: number): ArchivoSubida {
  return { name: nombre, mimeType: "image/png", buffer: generarPng(pesoAprox) };
}

/** Declara ser JPEG (tipo que el navegador reporta) pero el contenido NO es una imagen. */
function archivoNoImagen(nombre: string): ArchivoSubida {
  return {
    name: nombre,
    mimeType: "image/jpeg",
    buffer: Buffer.from(
      "Esto no es una foto: son bytes de texto plano disfrazados de imagen. ".repeat(
        10,
      ),
      "utf8",
    ),
  };
}

type Fotos = {
  frente?: ArchivoSubida;
  reverso?: ArchivoSubida;
  selfie?: ArchivoSubida;
};

/** 3 fotos válidas y livianas (~8 KB), suficientes para pasar la validación y el envío real. */
function fotosValidas(): Required<Fotos> {
  return {
    frente: archivoPng("frente.png", 8 * 1024),
    reverso: archivoPng("reverso.png", 8 * 1024),
    selfie: archivoPng("selfie.png", 8 * 1024),
  };
}

/** 3 fotos «de cámara», ~3 MB cada una (S-03: deben comprimirse antes de enviarse). */
function fotosGrandes(): Required<Fotos> {
  const PESO = 3 * 1024 * 1024;
  return {
    frente: archivoPng("frente-camara.png", PESO),
    reverso: archivoPng("reverso-camara.png", PESO),
    selfie: archivoPng("selfie-camara.png", PESO),
  };
}

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------

/** v3 (spec-requerimientos-ricardo §2 y §12.3): mismo tipo y datos que tests/e2e/utils.ts. */
type DatosAfiliacionV2 = DatosFormulario;
const datosValidosV2 = (cedula = cedulaUnica()): DatosAfiliacionV2 =>
  datosValidos(cedula);

const enviar = (page: Page) =>
  page.getByRole("button", { name: "Enviar solicitud" }).click();

/** Llena el formulario v3 con utils.llenarAfiliacion y luego sube las fotos indicadas. */
async function llenarFormulario(
  page: Page,
  d: Partial<DatosAfiliacionV2>,
  fotos: Fotos = {},
) {
  await llenarAfiliacion(page, d, false);
  if (fotos.frente)
    await page
      .locator('input[name="foto_cedula_frente"]')
      .setInputFiles(fotos.frente);
  if (fotos.reverso)
    await page
      .locator('input[name="foto_cedula_reverso"]')
      .setInputFiles(fotos.reverso);
  if (fotos.selfie)
    await page.locator('input[name="foto_selfie"]').setInputFiles(fotos.selfie);
}

/** id del control de cada campo → id de su mensaje de error (components/pantallas/Afiliacion.tsx). */
const ERROR = {
  nombres: "#af-nombres-error",
  apellidos: "#af-apellidos-error",
  cedula: "#af-cc-error",
  grado: "#af-grado-error",
  nequi: "#af-nequi-error",
  institucion: "#af-institucion-error",
  celular: "#af-cel-error",
  email: "#af-email-error",
  correoInstitucional: "#af-correo-inst-error",
  nominaEntidad: "#af-nomina-entidad-error",
  asesor: "#af-asesor-error",
  fotoFrente: "#af-foto-frente-error",
  fotoReverso: "#af-foto-reverso-error",
  fotoSelfie: "#af-foto-selfie-error",
  mensaje: "#af-msg-error",
  acepto: "#af-datos-error",
} as const;

// ---------------------------------------------------------------------------

test.describe("D1 · Enviar vacío", () => {
  test("Errores en todos los obligatorios (asesor y mensaje no) y foco en el primero", async ({
    page,
  }) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    await enviar(page);

    const obligatorios = [
      "nombres",
      "apellidos",
      "cedula",
      "grado",
      "institucion",
      "nequi",
      "celular",
      "email",
      "correoInstitucional",
      "nominaEntidad",
      "fotoFrente",
      "fotoReverso",
      "fotoSelfie",
      "acepto",
    ] as const;
    for (const campo of obligatorios) {
      await expect(page.locator(ERROR[campo]), campo).toBeVisible();
    }
    for (const campo of ["asesor", "mensaje"] as const) {
      await expect(page.locator(ERROR[campo]), campo).toHaveCount(0);
    }

    await expect(page.locator("#af-nombres")).toBeFocused();
    await expect(page.locator("#af-nombres")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.locator("#af-nombres")).toHaveAttribute(
      "aria-describedby",
      /af-nombres-error/,
    );
    await expect(page.locator("#af-datos")).toHaveAttribute(
      "aria-describedby",
      /af-datos-error/,
    );
    await expect(page).toHaveURL(/\/afiliacion$/);
  });
});

test.describe("D2 · Los campos quitan caracteres no permitidos al escribir (o pegar)", () => {
  // El navegador dispara el mismo evento «input» al escribir y al pegar, y
  // Afiliacion.tsx usa el mismo manejador (onChange) para los dos: esta
  // prueba, con `.fill()`, ejercita ese manejador igual que un pegado real.
  test("Nombres y apellidos: solo letras, tildes y ñ", async ({ page }) => {
    await page.goto("/afiliacion");
    await page.getByLabel("Nombres").fill("María1 José!.ñÑáéíóúÜ@");
    await expect(page.getByLabel("Nombres")).toHaveValue("María JoséñÑáéíóúÜ");
    await page.getByLabel("Apellidos").fill("Pérez-Gómez #2");
    await expect(page.getByLabel("Apellidos")).toHaveValue("PérezGómez ");
  });

  test("Cédula, celular y Nequi: solo dígitos", async ({ page }) => {
    await page.goto("/afiliacion");
    await page.getByLabel("Número de cédula").fill("1.234.567-8");
    await expect(page.getByLabel("Número de cédula")).toHaveValue("12345678");
    await page.getByLabel("Celular").fill("300.111-2233");
    await expect(page.getByLabel("Celular")).toHaveValue("3001112233");
    await page.getByLabel("Número Nequi").fill("300a999b8877x");
    await expect(page.getByLabel("Número Nequi")).toHaveValue("3009998877");
  });
});

test.describe("D3 · Reglas de validación por campo", () => {
  // Cada caso llena todo válido, cambia un campo y desmarca la autorización
  // (para que nunca se envíe de verdad): se revisa solo el error del campo
  // probado. No hace falta adjuntar fotos: al quedar sin marcar la
  // autorización, la validación del propio navegador ya bloquea el envío
  // antes de llamar a la Server Action.
  const casos: {
    campo: keyof typeof ERROR;
    nombre: string;
    cambio: Partial<DatosAfiliacionV2>;
    valido: boolean;
  }[] = [
    {
      campo: "nombres",
      nombre: "nombres de 1 carácter",
      cambio: { nombres: "A" },
      valido: false,
    },
    {
      campo: "nombres",
      nombre: "nombres de 2 caracteres",
      cambio: { nombres: "Al" },
      valido: true,
    },
    {
      campo: "nombres",
      nombre: "nombres de 60 caracteres",
      cambio: { nombres: "A".repeat(60) },
      valido: true,
    },
    {
      campo: "nombres",
      nombre: "nombres de 61 caracteres",
      cambio: { nombres: "A".repeat(61) },
      valido: false,
    },
    {
      campo: "apellidos",
      nombre: "apellidos de 1 carácter",
      cambio: { apellidos: "B" },
      valido: false,
    },
    {
      campo: "apellidos",
      nombre: "apellidos de 2 caracteres",
      cambio: { apellidos: "Bo" },
      valido: true,
    },
    {
      campo: "apellidos",
      nombre: "apellidos de 60 caracteres",
      cambio: { apellidos: "B".repeat(60) },
      valido: true,
    },
    {
      campo: "apellidos",
      nombre: "apellidos de 61 caracteres",
      cambio: { apellidos: "B".repeat(61) },
      valido: false,
    },
    {
      campo: "cedula",
      nombre: "cédula de 5 dígitos",
      cambio: { cedula: "12345" },
      valido: false,
    },
    {
      campo: "cedula",
      nombre: "cédula de 6 dígitos",
      cambio: { cedula: "123456" },
      valido: true,
    },
    {
      campo: "cedula",
      nombre: "cédula de 10 dígitos",
      cambio: { cedula: "1234567899" },
      valido: true,
    },
    {
      campo: "cedula",
      nombre: "cédula de 11 dígitos",
      cambio: { cedula: "12345678901" },
      valido: false,
    },
    {
      campo: "grado",
      nombre: "grado sin elegir",
      cambio: { grado: "" },
      valido: false,
    },
    {
      campo: "institucion",
      nombre: "institución sin elegir",
      cambio: { institucion: "" },
      valido: false,
    },
    {
      campo: "nequi",
      nombre: "Nequi que no empieza por 3",
      cambio: { nequi: "2001112233" },
      valido: false,
    },
    {
      campo: "nequi",
      nombre: "Nequi de 9 dígitos",
      cambio: { nequi: "300111223" },
      valido: false,
    },
    {
      campo: "nequi",
      nombre: "Nequi de 10 dígitos que empieza por 3",
      cambio: { nequi: "3001112233" },
      valido: true,
    },
    {
      campo: "celular",
      nombre: "celular que no empieza por 3",
      cambio: { celular: "2104567890" },
      valido: false,
    },
    {
      campo: "celular",
      nombre: "celular de 9 dígitos",
      cambio: { celular: "310456789" },
      valido: false,
    },
    {
      campo: "celular",
      nombre: "celular de 10 dígitos que empieza por 3",
      cambio: { celular: "3104567890" },
      valido: true,
    },
    {
      campo: "mensaje",
      nombre: "mensaje de 500",
      cambio: { mensaje: "m".repeat(500) },
      valido: true,
    },
    {
      campo: "mensaje",
      nombre: "mensaje de 501 (maxLength=500 recorta)",
      cambio: { mensaje: "m".repeat(501) },
      valido: true,
    },
  ];

  for (const caso of casos) {
    test(`${caso.valido ? "Válido" : "Inválido"}: ${caso.nombre}`, async ({
      page,
    }) => {
      await page.goto("/afiliacion");
      await llenarFormulario(page, {
        ...datosValidosV2(),
        ...caso.cambio,
        acepto: false,
      });
      await enviar(page);
      // La autorización sin marcar siempre da error (y evita el envío real).
      await expect(page.locator(ERROR.acepto)).toBeVisible();
      if (caso.valido) {
        await expect(page.locator(ERROR[caso.campo])).toHaveCount(0);
      } else {
        await expect(page.locator(ERROR[caso.campo])).toBeVisible();
      }
      if (caso.campo === "mensaje") {
        expect(((await page.locator("#af-msg").inputValue()) ?? "").length).toBeLessThanOrEqual(500);
      }
      await expect(page).toHaveURL(/\/afiliacion$/);
    });
  }
});

test.describe("D4 · Correos v3: institucional con dominio de la institución (§12.3) y personal de cualquier dominio", () => {
  const casos = [
    {
      nombre: "Policía + institucional @policia.gov.co",
      institucion: "policia" as const,
      inst: "agente.qa@policia.gov.co",
      campo: "correoInstitucional" as const,
      valido: true,
    },
    {
      nombre: "Policía + institucional @correo.policia.gov.co",
      institucion: "policia" as const,
      inst: "agente.qa@correo.policia.gov.co",
      campo: "correoInstitucional" as const,
      valido: true,
    },
    {
      nombre: "Policía + institucional @gmail.com",
      institucion: "policia" as const,
      inst: "agente.qa@gmail.com",
      campo: "correoInstitucional" as const,
      valido: false,
    },
    {
      nombre: "Policía + institucional del Ejército",
      institucion: "policia" as const,
      inst: "agente.qa@ejercito.mil.co",
      campo: "correoInstitucional" as const,
      valido: false,
    },
    {
      nombre: "Ejército + institucional @buzonejercito.mil.co",
      institucion: "ejercito" as const,
      inst: "soldado.qa@buzonejercito.mil.co",
      campo: "correoInstitucional" as const,
      valido: true,
    },
    {
      nombre: "Ejército + institucional @ejercito.mil.co",
      institucion: "ejercito" as const,
      inst: "soldado.qa@ejercito.mil.co",
      campo: "correoInstitucional" as const,
      valido: true,
    },
    {
      nombre: "Ejército + institucional @policia.gov.co",
      institucion: "ejercito" as const,
      inst: "soldado.qa@policia.gov.co",
      campo: "correoInstitucional" as const,
      valido: false,
    },
    {
      nombre: "Personal @hotmail.com",
      institucion: "policia" as const,
      personal: "persona.qa@hotmail.com",
      campo: "email" as const,
      valido: true,
    },
    {
      nombre: "Personal sin arroba",
      institucion: "policia" as const,
      personal: "persona.qa-hotmail.com",
      campo: "email" as const,
      valido: false,
    },
  ];

  for (const caso of casos) {
    test(`${caso.valido ? "Válido" : "Inválido"}: ${caso.nombre}`, async ({
      page,
    }) => {
      const base = datosValidosV2();
      const grado = caso.institucion === "ejercito" ? "" : base.grado;
      await page.goto("/afiliacion");
      await llenarFormulario(page, {
        ...base,
        institucion: caso.institucion,
        grado,
        correoInstitucional: caso.inst ?? base.correoInstitucional,
        email: caso.personal ?? base.email,
        acepto: false,
      });
      await enviar(page);
      await expect(page.locator(ERROR.acepto)).toBeVisible();
      if (caso.valido) {
        await expect(page.locator(ERROR[caso.campo])).toHaveCount(0);
      } else {
        await expect(page.locator(ERROR[caso.campo])).toBeVisible();
        if (caso.campo === "correoInstitucional") {
          await expect(page.locator(ERROR.correoInstitucional)).toContainText(
            caso.institucion === "policia"
              ? "@policia.gov.co"
              : "@ejercito.mil.co",
          );
        }
      }
      await expect(page).toHaveURL(/\/afiliacion$/);
    });
  }

  test("Inválido: institucional y personal iguales", async ({ page }) => {
    const base = datosValidosV2();
    await page.goto("/afiliacion");
    await llenarFormulario(page, {
      ...base,
      email: base.correoInstitucional,
      acepto: false,
    });
    await enviar(page);
    await expect(
      page.locator(`${ERROR.email}, ${ERROR.correoInstitucional}`).first(),
    ).toBeVisible();
  });

  test("Grado depende de la institución: deshabilitado sin institución y se recarga al cambiarla", async ({
    page,
  }) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#af-grado")).toBeDisabled();
    await page.locator("#af-institucion").selectOption("policia");
    await expect(page.locator("#af-grado")).toBeEnabled();
    const policia = await page.locator("#af-grado option").allTextContents();
    await page.locator("#af-institucion").selectOption("ejercito");
    const ejercito = await page.locator("#af-grado option").allTextContents();
    expect(policia.length).toBeGreaterThan(1);
    expect(ejercito.length).toBeGreaterThan(1);
    expect(ejercito).not.toEqual(policia);
  });

  test("Cuenta de nómina en cascada: banco pide tipo y número; billetera solo el número", async ({
    page,
  }) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('input[name="nomina_tipo"]')).toHaveCount(0);
    await llenarAfiliacion(page, { nominaEntidad: "Bancolombia" }, false);
    await expect(page.locator('input[name="nomina_tipo"]')).toHaveCount(2);
    await expect(page.getByLabel("Número de cuenta")).toBeVisible();
    await llenarAfiliacion(page, { nominaEntidad: "Daviplata" }, false);
    await expect(page.locator('input[name="nomina_tipo"]')).toHaveCount(0);
    await expect(
      page.getByLabel("Número de esa billetera (tu celular)"),
    ).toBeVisible();
  });
});

test.describe("D5 · Autorización de datos", () => {
  test("Sin marcar → error y foco ahí; lo escrito en los demás campos se conserva", async ({
    page,
  }) => {
    const d = datosValidosV2();
    await page.goto("/afiliacion");
    await llenarFormulario(page, { ...d, acepto: false }, fotosValidas());
    await enviar(page);
    await expect(page.locator(ERROR.acepto)).toBeVisible();
    await expect(page.locator("#af-datos")).toBeFocused();
    await expect(page.getByLabel("Nombres")).toHaveValue(d.nombres);
    await expect(page.getByLabel("Apellidos")).toHaveValue(d.apellidos);
    await expect(page.getByLabel("Número de cédula")).toHaveValue(d.cedula);
    await expect(page.locator("#af-grado")).toHaveValue(d.grado);
    await expect(page.locator("#af-institucion")).toHaveValue(d.institucion);
    await expect(page.getByLabel("Número Nequi")).toHaveValue(d.nequi);
    await expect(page.locator("#af-cel")).toHaveValue(d.celular);
    await expect(page.locator("#af-email")).toHaveValue(d.email);
    await expect(page.locator("#af-correo-inst")).toHaveValue(
      d.correoInstitucional,
    );
    expect(await filasPorCedula(d.cedula)).toHaveLength(0);
  });
});

test.describe("D6 · Cada una de las 3 fotos es obligatoria por separado", () => {
  const campos = [
    { campo: "fotoFrente" as const, falta: "frente" as const },
    { campo: "fotoReverso" as const, falta: "reverso" as const },
    { campo: "fotoSelfie" as const, falta: "selfie" as const },
  ];
  for (const { campo, falta } of campos) {
    test(`Falta ${falta} → error solo en esa foto`, async ({ page }) => {
      const todas: Fotos = fotosValidas();
      delete todas[falta];
      await page.goto("/afiliacion");
      await llenarFormulario(
        page,
        { ...datosValidosV2(), acepto: true },
        todas,
      );
      await enviar(page);
      await expect(page.locator(ERROR[campo])).toBeVisible();
      for (const otra of (
        ["fotoFrente", "fotoReverso", "fotoSelfie"] as const
      ).filter((c) => c !== campo)) {
        await expect(page.locator(ERROR[otra])).toHaveCount(0);
      }
      await expect(page).toHaveURL(/\/afiliacion$/);
    });
  }
});

test.describe("D7 · El servidor detecta el tipo real del archivo (magic bytes, S-04)", () => {
  test("Un archivo que no es imagen, aunque declare ser .jpg, no se guarda", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    const validas = fotosValidas();
    await page.goto("/afiliacion");
    await llenarFormulario(
      page,
      { ...datosValidosV2(cedula), acepto: true },
      {
        frente: archivoNoImagen("cedula-frente.jpg"),
        reverso: validas.reverso,
        selfie: validas.selfie,
      },
    );
    await enviar(page);
    // La validación del navegador solo mira el tipo DECLARADO (pasa); el
    // servidor lee los bytes reales antes de subir y rechaza con un error
    // general (no delata cuál regla de seguridad falló).
    // `p[role="alert"]` (no getByRole("alert") a secas): Next.js también pone
    // role="alert" en su propio anunciador de rutas (__next-route-announcer__).
    await expect(page.locator('p[role="alert"]')).toContainText(
      "No pudimos subir tus fotos",
    );
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(await filasPorCedula(cedula)).toHaveLength(0);
  });
});

test.describe("D8 · Opciones de los desplegables", () => {
  test("Grado (Policía): grados de la institución desde el catálogo, sin el heredado OF ni PP", async ({ page }) => {
    await page.goto("/afiliacion");
    await page.locator("#af-institucion").selectOption("policia");
    const opciones = await page
      .locator("#af-grado option")
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(opciones).toEqual(["", "PP", "PT", "SI", "IT", "IJ", "ST", "TE", "CT", "MY", "TC"]);
    await expect(page.locator("#af-grado option").first()).toHaveText(
      "Selecciona tu grado",
    );
  });

  test("Institución: Policía Nacional y Ejército Nacional", async ({
    page,
  }) => {
    await page.goto("/afiliacion");
    const valores = await page
      .locator("#af-institucion option")
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(valores).toEqual(["", "policia", "ejercito"]);
    const textos = await page
      .locator("#af-institucion option")
      .allTextContents();
    expect(textos).toEqual([
      "Selecciona tu institución",
      "Policía Nacional",
      "Ejército Nacional",
    ]);
  });

  test("Asesor: «No tengo asesor» y el Asesor de Prueba (obtener_asesores_publico)", async ({
    page,
  }) => {
    await page.goto("/afiliacion");
    const textos = await page.locator("#af-asesor option").allTextContents();
    expect(textos[0]).toBe("No tengo asesor");
    expect(textos).toContain("Asesor de Prueba");
  });
});

test.describe("D9 · Envío feliz con 3 fotos grandes (foto de cámara sin comprimir)", () => {
  test("Sube 3 fotos de ~3 MB, llega a /afiliacion/enviada y quedan en el bucket privado", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const cedula = cedulaUnica();
    creadas.push(cedula);
    const d = datosValidosV2(cedula);
    // Correo con mayúsculas y espacios: se guarda en minúsculas y recortado.
    const correoSucio = `  ${d.email.toUpperCase()}  `;

    await page.goto("/afiliacion");
    const antes = Date.now();
    await llenarFormulario(page, { ...d, email: correoSucio }, fotosGrandes());
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 45_000 });
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    // Correo enmascarado (usuario y dominio, lib/mascara.ts): «la•••@•••» (dominio oculto).
    await expect(page.locator("main")).toContainText("la•••@•••");
    const html = await page.content();
    expect(html.toLowerCase()).not.toContain(d.email.toLowerCase());

    const filas = await filasPorCedula(cedula);
    expect(filas).toHaveLength(1);
    const fila = filas[0] as Record<string, string | null>;
    expect(fila.estado).toBe("pendiente");
    expect(fila.nombres).toBe(d.nombres);
    expect(fila.apellidos).toBe(d.apellidos);
    expect(fila.nombre).toBe(`${d.nombres} ${d.apellidos}`); // trigger componer_nombre_afiliacion
    expect(fila.cedula).toBe(cedula);
    expect(fila.grado).toBe(d.grado);
    expect(fila.institucion).toBe("policia");
    expect(fila.unidad).toBeNull(); // en desuso: no se manda desde el formulario v2
    expect(fila.celular).toBe(d.celular);
    expect(fila.nequi).toBe(d.nequi);
    expect(fila.celular).not.toBe(fila.nequi); // independientes (spec-fase-2 §2)
    expect(fila.email).toBe(d.email.toLowerCase());
    expect(fila.asesor_id).toBeNull();
    expect(fila.acepto_datos_at).not.toBeNull();
    expect(
      Math.abs(Date.parse(fila.acepto_datos_at as string) - antes),
    ).toBeLessThan(60_000);

    for (const columna of [
      "foto_cedula_frente",
      "foto_cedula_reverso",
      "foto_selfie",
    ] as const) {
      const ruta = fila[columna];
      expect(ruta, columna).toMatch(
        /^afiliacion-documentos\/solicitudes\/[0-9a-f-]{36}\/.+\.(jpe?g|png|webp)$/,
      );
      expect(
        await objetoExisteEnBucket(ruta as string),
        `${columna}: ${ruta}`,
      ).toBe(true);
    }
    // Los 3 archivos son de rutas distintas (uuid propio cada una).
    expect(
      new Set([
        fila.foto_cedula_frente,
        fila.foto_cedula_reverso,
        fila.foto_selfie,
      ]).size,
    ).toBe(3);

    // Sin correos personales en el registro del servidor (si QA_DEV_LOG está activo).
    const log = process.env.QA_DEV_LOG;
    if (log && fs.existsSync(log)) {
      for (const linea of fs
        .readFileSync(log, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes(cedula))) {
        expect(linea).not.toContain(d.email.toLowerCase());
      }
    }
  });
});

test.describe("D10 · Selección de asesor", () => {
  test("Elegir «Asesor de Prueba» guarda su asesor_id en la solicitud", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarFormulario(
      page,
      { ...datosValidosV2(cedula), asesor: "Asesor de Prueba" },
      fotosValidas(),
    );
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 30_000 });
    const [fila] = await filasPorCedula(cedula);
    expect(fila.asesor_id).toBe(ASESOR_PRUEBA_ID);
  });
});

test.describe("D11 · Segunda solicitud con la misma cédula pendiente (S-06)", () => {
  test("Responde igual que un envío exitoso, sin crear una segunda fila", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarFormulario(page, datosValidosV2(cedula), fotosValidas());
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 30_000 });

    await limpiarLimites();
    await page.goto("/afiliacion");
    await llenarFormulario(
      page,
      { ...datosValidosV2(cedula), email: `otro.${cedula}@policia.gov.co` },
      fotosValidas(),
    );
    await enviar(page);
    // S-06: mismo destino y mismo mensaje que un envío exitoso, sin delatar
    // por el mensaje (ni el tiempo de respuesta) que la cédula ya está en trámite.
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 30_000 });
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    expect(await filasPorCedula(cedula)).toHaveLength(1);
  });
});

test.describe("D12 · Campo trampa (honeypot)", () => {
  test("Lleno → responde como éxito pero no guarda fila", async ({ page }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    // Oculto a personas: fuera de pantalla, sin tabulación, sin lector de pantalla.
    const trampa = page.locator("#af-sitio");
    await expect(trampa).toHaveAttribute("tabindex", "-1");
    await expect(
      page.locator('div[aria-hidden="true"]:has(#af-sitio)'),
    ).toHaveCount(1);
    const caja = await trampa.boundingBox();
    expect(caja === null || caja.x + caja.width < 0).toBe(true);

    await llenarFormulario(page, datosValidosV2(cedula), fotosValidas());
    await trampa.evaluate(
      (el: HTMLInputElement) => (el.value = "https://spam.example"),
    );
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 30_000 });
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    expect(await filasPorCedula(cedula)).toHaveLength(0);
  });
});

test.describe("D13 · Doble clic en «Enviar solicitud»", () => {
  test("Una sola fila, aunque se envíe dos veces seguidas", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarFormulario(page, datosValidosV2(cedula), fotosValidas());
    await page.getByRole("button", { name: "Enviar solicitud" }).dblclick();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    expect(await filasPorCedula(cedula)).toHaveLength(1);
  });

  test("Estado de carga: «Enviando…» y botón deshabilitado", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarFormulario(page, datosValidosV2(cedula), fotosValidas());
    await page.route("**/afiliacion", async (ruta) => {
      if (ruta.request().method() === "POST")
        await new Promise((r) => setTimeout(r, 1500));
      await ruta.continue();
    });
    await enviar(page);
    const cargando = page.getByRole("button", { name: "Enviando…" });
    await expect(cargando).toBeVisible();
    await expect(cargando).toBeDisabled();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 30_000 });
  });
});

test.describe("D14 · Entrar directo a /afiliacion/enviada", () => {
  test("Sin envío previo → redirige a /afiliacion", async ({ page }) => {
    await page.goto("/afiliacion/enviada");
    await expect(page).toHaveURL(/\/afiliacion$/);
    await expect(page.locator("h1")).toHaveText("Quiero afiliarme");
  });
});

test.describe("D15 · RLS de solicitudes_afiliacion", () => {
  const payload = (cedula: string) => ({
    nombres: "Intruso",
    apellidos: "Directo",
    cedula,
    grado: "PT",
    institucion: "policia",
    celular: "3001112233",
    nequi: "3001112233",
    email: "intruso@policia.gov.co",
    foto_cedula_frente: "afiliacion-documentos/x/frente.jpg",
    foto_cedula_reverso: "afiliacion-documentos/x/reverso.jpg",
    foto_selfie: "afiliacion-documentos/x/selfie.jpg",
    acepto_datos_at: new Date().toISOString(),
  });

  test("Con la clave anon no se puede leer ni insertar", async () => {
    const lectura = await anonRest("solicitudes_afiliacion?select=*");
    expect(
      lectura.status,
      JSON.stringify(lectura.cuerpo),
    ).toBeGreaterThanOrEqual(400);

    const cedula = cedulaUnica();
    creadas.push(cedula);
    const insercion = await anonRest("solicitudes_afiliacion", {
      method: "POST",
      body: JSON.stringify(payload(cedula)),
    });
    expect(insercion.status).toBeGreaterThanOrEqual(400);
    expect(await filasPorCedula(cedula)).toHaveLength(0);
  });

  test("Con sesión de asociado (authenticated) tampoco", async () => {
    const token = await tokenDeUsuario(USUARIOS.conSolicitud.correo);
    const lectura = await usuarioRest("solicitudes_afiliacion?select=*", token);
    const filas = Array.isArray(lectura.cuerpo) ? lectura.cuerpo : [];
    expect(lectura.status >= 400 || filas.length === 0).toBe(true);

    const cedula = cedulaUnica();
    creadas.push(cedula);
    const insercion = await usuarioRest("solicitudes_afiliacion", token, {
      method: "POST",
      body: JSON.stringify(payload(cedula)),
    });
    expect(insercion.status).toBeGreaterThanOrEqual(400);
    expect(await filasPorCedula(cedula)).toHaveLength(0);
  });
});
