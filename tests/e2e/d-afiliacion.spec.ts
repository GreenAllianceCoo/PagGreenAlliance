import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import {
  afiliacionesPorCedula,
  anonRest,
  borrarAfiliaciones,
  cedulaUnica,
  datosValidos,
  limpiarLimites,
  llenarAfiliacion,
  tokenDeUsuario,
  USUARIOS,
  usuarioRest,
  type DatosFormulario,
} from "./utils";

/** D. Formulario «Deseo afiliarme». */

const creadas: string[] = [];

test.beforeEach(async () => {
  await limpiarLimites();
});

test.afterAll(async () => {
  for (const c of creadas) await borrarAfiliaciones(c);
});

const enviar = (page: Page) => page.getByRole("button", { name: "Enviar solicitud" }).click();

/** id del control de cada campo → id de su mensaje de error. */
const ERROR = {
  nombre: "#af-nombre-error",
  cedula: "#af-cc-error",
  grado: "#af-grado-error",
  unidad: "#af-unidad-error",
  celular: "#af-cel-error",
  email: "#af-email-error",
  mensaje: "#af-msg-error",
  acepto: "#af-datos-error",
} as const;

test.describe("D1 · Enviar vacío", () => {
  test("Errores en todos los obligatorios y foco en el primero", async ({ page }) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    await enviar(page);
    for (const campo of ["nombre", "cedula", "grado", "celular", "email", "acepto"] as const) {
      await expect(page.locator(ERROR[campo]), campo).toBeVisible();
    }
    for (const campo of ["unidad", "mensaje"] as const) {
      await expect(page.locator(ERROR[campo]), campo).toHaveCount(0);
    }
    await expect(page.locator("#af-nombre")).toBeFocused();
    await expect(page.locator("#af-nombre")).toHaveAttribute("aria-invalid", "true");
    // Errores enlazados con aria-describedby.
    await expect(page.locator("#af-nombre")).toHaveAttribute("aria-describedby", /af-nombre-error/);
    await expect(page.locator("#af-datos")).toHaveAttribute("aria-describedby", /af-datos-error/);
    await expect(page).toHaveURL(/\/afiliacion$/);
  });
});

test.describe("D2 · Reglas de la tabla de la spec", () => {
  // Cada caso llena todo válido, cambia un campo y desmarca la autorización
  // (para que nunca se envíe): se revisa solo el error del campo probado.
  const casos: { campo: keyof typeof ERROR; nombre: string; cambio: Partial<DatosFormulario>; valido: boolean }[] = [
    { campo: "nombre", nombre: "nombre de 2 caracteres", cambio: { nombre: "Al" }, valido: false },
    { campo: "nombre", nombre: "nombre de 3 caracteres", cambio: { nombre: "Ana" }, valido: true },
    { campo: "nombre", nombre: "nombre de 120 caracteres", cambio: { nombre: "A".repeat(120) }, valido: true },
    { campo: "nombre", nombre: "nombre de 121 caracteres", cambio: { nombre: "A".repeat(121) }, valido: false },
    { campo: "cedula", nombre: "cédula de 5 dígitos", cambio: { cedula: "12345" }, valido: false },
    { campo: "cedula", nombre: "cédula de 6 dígitos", cambio: { cedula: "123456" }, valido: true },
    { campo: "cedula", nombre: "cédula de 10 dígitos", cambio: { cedula: "1234567899" }, valido: true },
    { campo: "cedula", nombre: "cédula de 11 dígitos", cambio: { cedula: "12345678901" }, valido: false },
    { campo: "cedula", nombre: "cédula con letras", cambio: { cedula: "12345a78" }, valido: false },
    { campo: "cedula", nombre: "cédula con puntos (se normaliza)", cambio: { cedula: "1.234.567" }, valido: true },
    { campo: "grado", nombre: "grado sin elegir", cambio: { grado: "" }, valido: false },
    { campo: "unidad", nombre: "unidad de 120", cambio: { unidad: "U".repeat(120) }, valido: true },
    { campo: "unidad", nombre: "unidad de 121", cambio: { unidad: "U".repeat(121) }, valido: false },
    { campo: "celular", nombre: "celular que no empieza por 3", cambio: { celular: "2104567890" }, valido: false },
    { campo: "celular", nombre: "celular de 9 dígitos", cambio: { celular: "310456789" }, valido: false },
    { campo: "celular", nombre: "celular de 10 dígitos que empieza por 3", cambio: { celular: "3104567890" }, valido: true },
    { campo: "email", nombre: "correo inválido", cambio: { email: "laura@" }, valido: false },
    { campo: "email", nombre: "correo sin arroba", cambio: { email: "laura.correo.com" }, valido: false },
    { campo: "email", nombre: "correo válido", cambio: { email: "laura@correo.com" }, valido: true },
    { campo: "mensaje", nombre: "mensaje de 500", cambio: { mensaje: "m".repeat(500) }, valido: true },
    { campo: "mensaje", nombre: "mensaje de 501", cambio: { mensaje: "m".repeat(501) }, valido: false },
  ];

  for (const caso of casos) {
    test(`${caso.valido ? "Válido" : "Inválido"}: ${caso.nombre}`, async ({ page }) => {
      await page.goto("/afiliacion");
      await llenarAfiliacion(page, { ...datosValidos(), ...caso.cambio, acepto: false });
      await enviar(page);
      // La autorización sin marcar siempre da error (y evita el envío).
      await expect(page.locator(ERROR.acepto)).toBeVisible();
      if (caso.valido) {
        await expect(page.locator(ERROR[caso.campo])).toHaveCount(0);
      } else {
        await expect(page.locator(ERROR[caso.campo])).toBeVisible();
      }
      await expect(page).toHaveURL(/\/afiliacion$/);
    });
  }

  test("Checkbox sin marcar → error; lo escrito se conserva", async ({ page }) => {
    const d = datosValidos();
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, { ...d, acepto: false });
    await enviar(page);
    await expect(page.locator(ERROR.acepto)).toBeVisible();
    await expect(page.locator("#af-datos")).toBeFocused();
    // No se borra lo escrito al mostrar el error.
    await expect(page.getByLabel("Nombres y apellidos")).toHaveValue(d.nombre);
    await expect(page.getByLabel("Número de cédula")).toHaveValue(d.cedula);
    await expect(page.getByLabel("Grado")).toHaveValue(d.grado);
    await expect(page.getByLabel("Correo electrónico")).toHaveValue(d.email);
    expect(await afiliacionesPorCedula(d.cedula)).toHaveLength(0);
  });
});

test.describe("D4 · Select «Grado»", () => {
  test("Opciones desde grados_credito (PP, PT, SI, IT, OF)", async ({ page }) => {
    await page.goto("/afiliacion");
    const opciones = await page.locator("#af-grado option").evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value),
    );
    expect(opciones).toEqual(["", "PP", "PT", "SI", "IT", "OF"]);
    await expect(page.locator("#af-grado option").first()).toHaveText("Selecciona tu grado");
  });
});

test.describe("D5/D3 · Envío válido", () => {
  test("→ /afiliacion/enviada con correo enmascarado; fila pendiente, correo en minúsculas, cédula normalizada", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    const conPuntos = `${cedula.slice(0, 1)}.${cedula.slice(1, 4)}.${cedula.slice(4, 7)}.${cedula.slice(7)}`;
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, {
      ...datosValidos(cedula),
      cedula: conPuntos,
      email: "  Laura.QA@Correo.COM ",
      celular: "+57 310 456 7890",
    });
    const antes = Date.now();
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    await expect(page.locator("main")).toContainText("la•••@correo.com");
    const html = await page.content();
    expect(html.toLowerCase()).not.toContain("laura.qa@correo.com");

    const filas = await afiliacionesPorCedula(cedula);
    expect(filas).toHaveLength(1);
    const [f] = filas;
    expect(f.estado).toBe("pendiente");
    expect(f.email).toBe("laura.qa@correo.com");
    expect(f.cedula).toBe(cedula);
    expect(f.celular).toBe("3104567890");
    expect(f.grado).toBe("PT");
    expect(f.nombre).toBe("Laura Gómez Prueba");
    expect(f.acepto_datos_at).not.toBeNull();
    expect(Math.abs(Date.parse(f.acepto_datos_at!) - antes)).toBeLessThan(60_000);

    // Correos (spec §2 pasos 3 y 4): con QA_DEV_LOG se revisa que se intentaron para ESTA
    // solicitud (sin RESEND_API_KEY quedan registrados como no enviados) y sin datos personales.
    const log = process.env.QA_DEV_LOG;
    if (log && fs.existsSync(log)) {
      await expect
        .poll(() => fs.readFileSync(log, "utf8").split(/\r?\n/).filter((l) => l.includes(f.id) && /evento\?":\?"afiliacion_correo/.test(l)).length, {
          timeout: 10_000,
          message: "registro del envío (o intento) de los correos de afiliación",
        })
        .toBeGreaterThan(0);
      for (const l of fs.readFileSync(log, "utf8").split(/\r?\n/).filter((x) => x.includes(f.id))) {
        expect(l).not.toContain("laura.qa@correo.com");
        expect(l).not.toContain(cedula);
        expect(l).not.toContain("3104567890");
      }
    }

    // Recargar la página de confirmación mantiene el mensaje (cookie de 10 min).
    await page.reload();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
  });
});

test.describe("D6 · Segunda solicitud con la misma cédula pendiente", () => {
  test("Rechazada con mensaje claro y sin fila nueva", async ({ page }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos(cedula));
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);

    await limpiarLimites();
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, { ...datosValidos(cedula), email: "otro.correo@correo.com" });
    await enviar(page);
    await expect(page.locator(ERROR.cedula)).toHaveText(
      "Ya tenemos una solicitud pendiente con esta cédula. El equipo te contactará pronto.",
    );
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(await afiliacionesPorCedula(cedula)).toHaveLength(1);
    // F-01: con un error del servidor se conserva lo escrito, incluido «Grado».
    await expect(page.getByLabel("Grado")).toHaveValue("PT");
    await expect(page.getByLabel("Número de cédula")).toHaveValue(cedula);
    await expect(page.getByLabel("Correo electrónico")).toHaveValue("otro.correo@correo.com");
    await expect(page.locator("#af-datos")).toBeChecked();
  });
});

test.describe("D7 · Campo trampa (honeypot)", () => {
  test("Lleno → responde como éxito pero no guarda fila", async ({ page }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    // Oculto a personas: fuera de pantalla, tabindex=-1, aria-hidden.
    const trampa = page.locator("#af-sitio");
    await expect(trampa).toHaveAttribute("tabindex", "-1");
    await expect(page.locator('div[aria-hidden="true"]:has(#af-sitio)')).toHaveCount(1);
    const caja = await trampa.boundingBox();
    expect(caja === null || caja.x + caja.width < 0).toBe(true);

    await llenarAfiliacion(page, datosValidos(cedula));
    await trampa.evaluate((el: HTMLInputElement) => (el.value = "https://spam.example"));
    await enviar(page);
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    expect(await afiliacionesPorCedula(cedula)).toHaveLength(0);
  });
});

test.describe("D8 · Doble clic en «Enviar solicitud»", () => {
  test("Una sola fila", async ({ page }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos(cedula));
    await page.getByRole("button", { name: "Enviar solicitud" }).dblclick();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(await afiliacionesPorCedula(cedula)).toHaveLength(1);
  });

  test("Estado de carga: «Enviando…» y botón deshabilitado", async ({ page }) => {
    const cedula = cedulaUnica();
    creadas.push(cedula);
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos(cedula));
    // Frena la respuesta del servidor para ver el estado de carga.
    await page.route("**/afiliacion", async (ruta) => {
      if (ruta.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
      await ruta.continue();
    });
    await enviar(page);
    const cargando = page.getByRole("button", { name: "Enviando…" });
    await expect(cargando).toBeVisible();
    await expect(cargando).toBeDisabled();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 20_000 });
  });
});

test.describe("D9 · Entrar directo a /afiliacion/enviada", () => {
  test("Sin envío previo → /afiliacion", async ({ page }) => {
    await page.goto("/afiliacion/enviada");
    await expect(page).toHaveURL(/\/afiliacion$/);
    await expect(page.locator("h1")).toHaveText("Quiero afiliarme");
  });
});

test.describe("D10 · RLS de solicitudes_afiliacion", () => {
  test("Con la clave anon no se puede leer ni insertar", async () => {
    const lectura = await anonRest("solicitudes_afiliacion?select=*");
    expect(lectura.status, JSON.stringify(lectura.cuerpo)).toBeGreaterThanOrEqual(400);

    const cedula = cedulaUnica();
    creadas.push(cedula);
    const insercion = await anonRest("solicitudes_afiliacion", {
      method: "POST",
      body: JSON.stringify({
        nombre: "Intruso Anon",
        cedula,
        grado: "PP",
        celular: "3001112233",
        email: "intruso@correo.com",
        acepto_datos_at: new Date().toISOString(),
      }),
    });
    expect(insercion.status).toBeGreaterThanOrEqual(400);
    expect(await afiliacionesPorCedula(cedula)).toHaveLength(0);
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
      body: JSON.stringify({
        nombre: "Intruso Auth",
        cedula,
        grado: "PP",
        celular: "3001112233",
        email: "intruso@correo.com",
        acepto_datos_at: new Date().toISOString(),
      }),
    });
    expect(insercion.status).toBeGreaterThanOrEqual(400);
    expect(await afiliacionesPorCedula(cedula)).toHaveLength(0);
  });
});
