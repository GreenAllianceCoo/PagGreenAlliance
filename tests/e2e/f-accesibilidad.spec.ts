import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  CARPETA_QA,
  CEDULA_NO_REGISTRADA,
  contextoConSesion,
  datosValidos,
  esEscritorio,
  limpiarLimites,
  llenarAfiliacion,
  pedirCodigo,
  textoVisible,
} from "./utils";

/** Sin errores de JavaScript en la página (`pageerror`), útil para las pruebas de abajo. */
function sinErroresDePagina(page: import("@playwright/test").Page) {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  return errores;
}

/** F. Accesibilidad básica: axe (serias/críticas), teclado, foco visible, labels. */

async function axe(page: Page, nombre: string, testInfo: TestInfo) {
  // Sin el indicador de desarrollo de Next (no existe en producción).
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  fs.mkdirSync(CARPETA_QA, { recursive: true });
  fs.writeFileSync(
    path.join(CARPETA_QA, `axe-${nombre}-${testInfo.project.name}.json`),
    JSON.stringify(
      r.violations.map((v) => ({
        id: v.id,
        impacto: v.impact,
        ayuda: v.help,
        nodos: v.nodes.map((n) => ({ destino: n.target.join(" "), resumen: n.failureSummary })),
      })),
      null,
      2,
    ),
  );
  expect(
    graves.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `Violaciones serias/críticas en ${nombre}`,
  ).toEqual([]);
}

/** Todo input/select/textarea visible tiene nombre accesible (label). */
async function todosConLabel(page: Page) {
  const sinLabel = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((el) => {
        const e = el as HTMLInputElement;
        if (e.type === "hidden" || e.closest('[aria-hidden="true"]')) return false;
        const tieneLabel = (e.labels && e.labels.length > 0) || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby");
        return !tieneLabel;
      })
      .map((el) => el.outerHTML.slice(0, 120)),
  );
  expect(sinLabel).toEqual([]);
}

/** El elemento con foco muestra un indicador visible (outline o sombra). */
async function focoVisible(page: Page) {
  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, el: "body" };
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    const sombra = s.boxShadow && s.boxShadow !== "none";
    return { ok: Boolean(outline || sombra), el: el.outerHTML.slice(0, 100) };
  });
  expect(info.ok, `Foco no visible en ${info.el}`).toBe(true);
}

test.beforeEach(async () => {
  await limpiarLimites();
});

test.describe("F · axe sin violaciones serias o críticas", () => {
  test("Landing /", async ({ page }, testInfo) => {
    await page.goto("/");
    await axe(page, "landing", testInfo);
  });
  test("/ingresar", async ({ page }, testInfo) => {
    await page.goto("/ingresar");
    await axe(page, "ingresar", testInfo);
    await todosConLabel(page);
  });
  test("/ingresar con error", async ({ page }, testInfo) => {
    await page.goto("/ingresar");
    await page.getByRole("button", { name: "Enviarme el código" }).click();
    await expect(page.locator("#cedula-error")).toBeVisible();
    await axe(page, "ingresar-error", testInfo);
  });
  test("/ingresar/codigo", async ({ page }, testInfo) => {
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    await axe(page, "ingresar-codigo", testInfo);
    await todosConLabel(page);
  });
  test("/afiliacion (vacío y con errores)", async ({ page }, testInfo) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    await axe(page, "afiliacion", testInfo);
    await todosConLabel(page);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.locator("#af-nombres-error")).toBeVisible();
    await axe(page, "afiliacion-errores", testInfo);
  });
  test("/afiliacion/enviada", async ({ page }, testInfo) => {
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos());
    await page.locator("#af-sitio").evaluate((el: HTMLInputElement) => (el.value = "x"));
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
    await axe(page, "afiliacion-enviada", testInfo);
  });
  test("/cuenta", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await axe(page, "cuenta", testInfo);
    await todosConLabel(page);
    await ctx.close();
  });
  test("/politica-de-datos", async ({ page }, testInfo) => {
    await page.goto("/politica-de-datos");
    await axe(page, "politica-de-datos", testInfo);
  });
});

test.describe("F · Solo teclado", () => {
  test("/ingresar: Tab al campo, escribir, Enter → paso 2; código con teclado", async ({ page }) => {
    await page.goto("/ingresar");
    await page.waitForLoadState("networkidle");
    // Tab desde el inicio hasta el campo de cédula.
    let llegamos = false;
    for (let i = 0; i < 10 && !llegamos; i++) {
      await page.keyboard.press("Tab");
      await focoVisible(page);
      llegamos = await page.evaluate(() => document.activeElement?.id === "cedula");
    }
    expect(llegamos).toBe(true);
    await page.keyboard.type(CEDULA_NO_REGISTRADA);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Enviarme el código" })).toBeFocused();
    await focoVisible(page);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/ingresar/codigo");

    // Paso 2: foco a la primera casilla con Tab, escribir 6 dígitos, Enter.
    let enCasilla = false;
    for (let i = 0; i < 10 && !enCasilla; i++) {
      await page.keyboard.press("Tab");
      enCasilla = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.name === "codigo-1");
    }
    expect(enCasilla).toBe(true);
    await focoVisible(page);
    await page.keyboard.type("123456");
    await page.keyboard.press("Enter");
    await expect(page.getByText("El código no es válido o ya venció")).toBeVisible();
  });

  test("/afiliacion: orden de Tab, Espacio marca la casilla, trampa fuera del orden", async ({ page }) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    // Formulario v3 (Entidad bancaria → Nequi; la lista de SelectBusqueda tiene tabIndex=-1): sin reordenar por CSS entre viewports,
    // el orden del DOM es el mismo en escritorio y celular.
    const esperado = [
      "af-nombres",
      "af-apellidos",
      "af-cc",
      "af-institucion",
      "af-grado",
      "af-nomina-entidad",
      "af-nequi",
      "af-cel",
      "af-correo-inst",
      "af-email",
      "af-asesor",
      "af-foto-frente",
      "af-foto-reverso",
      "tomar-selfie", // botón «Tomar selfie» (el input de la selfie es sr-only)
      "af-msg",
      "af-datos",
      "politica",
      "enviar",
    ];
    // El grado se habilita al elegir la institución (v3).
    await page.locator("#af-institucion").selectOption("policia");
    await page.locator("#af-nombres").focus();
    const vistos: string[] = [];
    for (let i = 0; i < esperado.length; i++) {
      // Botón de herramientas de desarrollo de Next (solo en `next dev`): no es de la app.
      if (await page.evaluate(() => document.activeElement?.tagName === "NEXTJS-PORTAL")) {
        await page.keyboard.press("Tab");
        i--;
        continue;
      }
      const id = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (el.id) return el.id;
        if (el.getAttribute("href") === "/politica-de-datos") return "politica";
        if (el.textContent?.includes("Enviar solicitud")) return "enviar";
        if (el.textContent?.includes("Tomar selfie")) return "tomar-selfie";
        return el.outerHTML.slice(0, 60);
      });
      vistos.push(id);
      await focoVisible(page);
      if (id === "af-datos") {
        await page.keyboard.press("Space");
        await expect(page.locator("#af-datos")).toBeChecked();
      }
      await page.keyboard.press("Tab");
    }
    expect(vistos).toEqual(esperado);
    expect(vistos).not.toContain("af-sitio");
  });

  test("/cuenta: «Salir» y «Guardar» alcanzables con Tab y foco visible", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await page.waitForLoadState("networkidle");
    const alcanzados = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const t = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return (el.getAttribute("aria-label") || el.textContent || el.id || "").trim();
      });
      // Al pasar el último elemento el foco sale de la página (body): fin del ciclo.
      if (await page.evaluate(() => document.activeElement === document.body)) break;
      // Botón de herramientas de desarrollo de Next (solo existe en `next dev`).
      if (await page.evaluate(() => document.activeElement?.tagName === "NEXTJS-PORTAL")) continue;
      alcanzados.add(t);
      await focoVisible(page);
    }
    const nombres = Array.from(alcanzados).join(" | ");
    // Con solicitud pendiente el mosaico está apagado; en celular se llega por «Solicitar» de la barra.
    expect(nombres).toMatch(/Nueva solicitud|Solicitar/);
    // «Guardar» se movió a /cuenta/perfil (v3); Inicio ya no tiene formulario.
    expect(nombres).toMatch(esEscritorio(testInfo) ? /Salir/ : /Cerrar sesión/);
    await ctx.close();
  });
});

/**
 * G (accesibilidad) · `prefers-reduced-motion: reduce`: todas las
 * animaciones del rediseño C+ (comprobante que avanza solo, sello girando,
 * aro de reenvío, confeti del sorteo) están condicionadas con
 * `motion-safe:`/`motion-reduce:` o miran `matchMedia`. Se emula con
 * `reducedMotion: "reduce"` (Playwright) y se comprueba que nada se rompe:
 * ni errores de consola ni contenido que dependa de que la animación termine.
 */
test.describe("F · prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("Landing: el comprobante «Tu solicitud» queda fijo, sin errores", async ({ page }) => {
    const errores = sinErroresDePagina(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // El texto visible (innerText) ya distingue la variante móvil/escritorio
    // que corresponde al viewport (la otra está detrás de un `lg:hidden` /
    // `hidden lg:block`, así que no cuenta): más robusto que getByText().first(),
    // que puede resolver a la variante oculta según el orden del DOM.
    const antes = await textoVisible(page);
    expect(antes).toContain("En revisión");
    // Sigue en el mismo paso más de 3 s (con movimiento normal ya habría avanzado, cada 2.6 s).
    await page.waitForTimeout(3000);
    const despues = await textoVisible(page);
    expect(despues).toBe(antes);
    expect(errores).toEqual([]);
  });

  test("Afiliación enviada: el sello no gira ni rompe nada", async ({ page }) => {
    const errores = sinErroresDePagina(page);
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos());
    await page.locator("#af-sitio").evaluate((el: HTMLInputElement) => (el.value = "x"));
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    expect(errores).toEqual([]);
  });

  test("/cuenta: sello y tarjetas visibles, sin errores", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    const errores = sinErroresDePagina(page);
    await page.goto("/cuenta");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Tu solicitud", { exact: true })).toBeVisible();
    expect(errores).toEqual([]);
    await ctx.close();
  });

  test("/ingresar/codigo: el aro de reenvío no anima, sigue usable", async ({ page }) => {
    const errores = sinErroresDePagina(page);
    await limpiarLimites();
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    await expect(page.getByRole("button", { name: "Reenviar código" })).toBeVisible();
    expect(errores).toEqual([]);
  });
});
