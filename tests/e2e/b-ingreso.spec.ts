import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  CARPETA_QA,
  CEDULA_NO_REGISTRADA,
  esEscritorio,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  MENSAJE_CODIGO_INVALIDO,
  pedirCodigo,
  TEXTO_PRIVACIDAD,
  USUARIOS,
} from "./utils";

/** B. Ingreso con cédula + código. */

test.beforeEach(async () => {
  await limpiarLimites();
});

test.describe("B1 · Validación de la cédula (paso 1)", () => {
  for (const [caso, valor] of [
    ["con letras", "12ab5678"],
    ["menos de 6 dígitos", "12345"],
    ["más de 10 dígitos", "12345678901"],
    ["vacía", ""],
  ] as const) {
    test(`Cédula ${caso} → error y no navega`, async ({ page }) => {
      await page.goto("/ingresar");
      await page.getByLabel("Número de cédula").fill(valor);
      await page.getByRole("button", { name: "Enviarme el código" }).click();
      const campo = page.getByLabel("Número de cédula");
      await expect(campo).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#cedula-error")).toBeVisible();
      await expect(page).toHaveURL(/\/ingresar$/);
      await expect(campo).toBeFocused();
    });
  }

  test("Input: inputmode=numeric y autocomplete=username", async ({ page }) => {
    await page.goto("/ingresar");
    const campo = page.getByLabel("Número de cédula");
    await expect(campo).toHaveAttribute("inputmode", "numeric");
    await expect(campo).toHaveAttribute("autocomplete", "username");
  });
});

test.describe("B2/B3 · Privacidad: misma respuesta exista o no la cédula", () => {
  test("Mismo mensaje, misma pantalla, tiempo similar y correo solo enmascarado", async ({ page }, testInfo) => {
    const u = USUARIOS.sinSolicitudes;
    await esperarVentanaReenvio(u.correo);

    // Captura de todo lo que llega del servidor, para buscar el correo completo.
    const cuerpos: string[] = [];
    page.on("response", async (r) => {
      try {
        if (r.url().startsWith("http://localhost:3000")) cuerpos.push(await r.text());
      } catch {
        /* redirecciones sin cuerpo */
      }
    });

    const medir = async (cedula: string) => {
      await page.goto("/ingresar");
      await expect(page.getByText(TEXTO_PRIVACIDAD, { exact: false })).toBeVisible();
      await page.getByLabel("Número de cédula").fill(cedula);
      const t0 = Date.now();
      await page.getByRole("button", { name: "Enviarme el código" }).click();
      await page.waitForURL("**/ingresar/codigo");
      await expect(page.locator("h1")).toHaveText("Revisa tu correo");
      const ms = Date.now() - t0;
      const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      const html = await page.content();
      return { ms, texto, html };
    };

    const registrada = await medir(u.cedula);
    const noRegistrada = await medir(CEDULA_NO_REGISTRADA);

    // Mismo mensaje en el paso 1 (se vio en ambos) y misma pantalla en el paso 2.
    const estructura = (t: string) => t.replace(/[a-z]{2}•••@[a-z.]+/g, "<CORREO>");
    expect(estructura(noRegistrada.texto)).toBe(estructura(registrada.texto));

    // Tiempo: diferencia <= 1 s.
    const diferencia = Math.abs(registrada.ms - noRegistrada.ms);
    fs.mkdirSync(CARPETA_QA, { recursive: true });
    fs.writeFileSync(
      path.join(CARPETA_QA, `tiempos-ingreso-${testInfo.project.name}.json`),
      JSON.stringify({ registradaMs: registrada.ms, noRegistradaMs: noRegistrada.ms, diferencia }, null, 2),
    );
    expect(diferencia, `registrada ${registrada.ms} ms vs no registrada ${noRegistrada.ms} ms`).toBeLessThanOrEqual(1000);

    // B3: correo enmascarado sí; correo completo nunca (HTML ni respuestas de red).
    expect(registrada.texto).toContain(u.mascara);
    expect(registrada.html).not.toContain(u.correo);
    for (const c of cuerpos) expect(c).not.toContain(u.correo);
    expect(noRegistrada.texto).toMatch(/[a-z]{2}•••@(gmail|hotmail|outlook|yahoo)\.com/);

    // La cookie del paso 1 es httpOnly y no tiene el correo en claro.
    const cookies = await page.context().cookies();
    const ingreso = cookies.find((c) => c.name === "ga_ingreso");
    expect(ingreso?.httpOnly).toBe(true);
    expect(decodeURIComponent(ingreso?.value ?? "")).not.toContain("@");
    // La URL no lleva datos.
    expect(page.url()).toMatch(/\/ingresar\/codigo$/);
  });

  test("Cédula no registrada: el código siempre da el mismo error genérico", async ({ page }) => {
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    await llenarOtp(page, "123456");
    await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
    await expect(page.getByText(MENSAJE_CODIGO_INVALIDO)).toBeVisible();
    await expect(page).toHaveURL(/\/ingresar\/codigo$/);
  });
});

test.describe("B4 · «Deseo afiliarme»", () => {
  test("Visible en el paso 1 y lleva a /afiliacion", async ({ page }) => {
    await page.goto("/ingresar");
    const enlace = page.getByRole("link", { name: "Deseo afiliarme" });
    await expect(enlace).toBeVisible();
    await enlace.click();
    await expect(page).toHaveURL(/\/afiliacion$/);
  });
});

test.describe("B5 · Casillas del código", () => {
  test("Deshabilitado hasta 6 dígitos; teclear avanza; Backspace retrocede; pegar llena todo", async ({ page }) => {
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    const entrar = page.getByRole("button", { name: "Entrar a mi cuenta" });
    const casilla = (i: number) => page.locator(`input[name="codigo-${i}"]`);

    await expect(casilla(1)).toHaveAttribute("autocomplete", "one-time-code");
    await expect(entrar).toBeDisabled();

    // Teclear: avance automático.
    await casilla(1).click();
    await page.keyboard.type("12345");
    for (let i = 1; i <= 5; i++) await expect(casilla(i)).toHaveValue(String(i));
    await expect(casilla(6)).toBeFocused();
    await expect(entrar).toBeDisabled();

    // Backspace en casilla vacía: borra la anterior y retrocede.
    await page.keyboard.press("Backspace");
    await expect(casilla(5)).toHaveValue("");
    await expect(casilla(5)).toBeFocused();

    // Completar 6 → habilitado.
    await page.keyboard.type("56");
    await expect(casilla(6)).toHaveValue("6");
    await expect(entrar).toBeEnabled();

    // Borrar la última → otra vez deshabilitado.
    await page.keyboard.press("Backspace");
    await expect(casilla(6)).toHaveValue("");
    await expect(entrar).toBeDisabled();

    // Pegar 6 dígitos desde la primera casilla llena todas.
    await llenarOtp(page, "987654");
    const valores = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => casilla(i).inputValue()));
    expect(valores.join("")).toBe("987654");
    await expect(entrar).toBeEnabled();

    // Letras no entran.
    await casilla(3).click();
    await page.keyboard.press("Backspace");
    await page.keyboard.type("x");
    await expect(casilla(3)).toHaveValue("");
  });
});

test.describe("B6 · Código incorrecto y correcto", () => {
  test("Incorrecto → error genérico; correcto (de Mailpit) → /cuenta", async ({ page }) => {
    const u = USUARIOS.conSolicitud;
    await esperarVentanaReenvio(u.correo);
    const inicio = await pedirCodigo(page, u.cedula);
    const codigo = await esperarCodigo(u.correo, inicio);
    const errado = codigo === "000000" ? "111111" : "000000";

    await llenarOtp(page, errado);
    await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
    await expect(page.getByText(MENSAJE_CODIGO_INVALIDO)).toBeVisible();
    await expect(page).toHaveURL(/\/ingresar\/codigo$/);
    // Las casillas se vacían para escribir de nuevo.
    await expect(page.locator('input[name="codigo-1"]')).toHaveValue("");

    await llenarOtp(page, codigo);
    await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
    await page.waitForURL("**/cuenta");
    await expect(page.locator("h1")).toContainText(u.nombre);

    // La cookie del paso 1 se borra al entrar.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "ga_ingreso")).toBeUndefined();

    // Con sesión, /ingresar redirige a /cuenta.
    await page.goto("/ingresar");
    await expect(page).toHaveURL(/\/cuenta$/);
  });
});

test.describe("B7 · «Reenviar código»", () => {
  test("Deshabilitado durante el contador; habilitado después; al pulsar reinicia", async ({ page }) => {
    test.setTimeout(150_000);
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    const reenviar = page.getByRole("button", { name: "Reenviar código" });
    await expect(reenviar).toBeDisabled();
    await expect(page.getByText(/en 0:4\d/)).toBeVisible();

    await expect(reenviar).toBeEnabled({ timeout: 50_000 });
    await reenviar.click();
    await expect(page.getByRole("status")).toContainText(/te enviamos un código nuevo/i);
    await expect(reenviar).toBeDisabled();
    await expect(page.getByText(/en 0:4\d/)).toBeVisible();
    await expect(page).toHaveURL(/\/ingresar\/codigo$/);
  });
});

test.describe("B8 · «Cambiar cédula» / volver", () => {
  test("Vuelve a /ingresar y borra la cookie del paso 1", async ({ page }, testInfo) => {
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    if (esEscritorio(testInfo)) {
      await page.getByRole("link", { name: "Cambiar cédula" }).click();
    } else {
      await page.getByRole("link", { name: "Volver" }).click();
    }
    await expect(page).toHaveURL(/\/ingresar$/);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "ga_ingreso")).toBeUndefined();
    await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar$/);
  });
});

test.describe("B9 · Entrar directo al paso 2", () => {
  test("/ingresar/codigo sin paso 1 → /ingresar", async ({ page }) => {
    await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar$/);
    await expect(page.locator("h1")).toHaveText("Hola de nuevo");
  });

  test("Cookie manipulada → /ingresar", async ({ page, context }) => {
    await context.addCookies([{ name: "ga_ingreso", value: "manipulada", url: "http://localhost:3000" }]);
    await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar$/);
  });
});

test.describe("B · Estado de carga del paso 1", () => {
  test("«Enviando…» y botón deshabilitado mientras responde", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByLabel("Número de cédula").fill(CEDULA_NO_REGISTRADA);
    await page.getByRole("button", { name: "Enviarme el código" }).click();
    const cargando = page.getByRole("button", { name: "Enviando…" });
    await expect(cargando).toBeVisible();
    await expect(cargando).toBeDisabled();
    await page.waitForURL("**/ingresar/codigo");
  });
});

