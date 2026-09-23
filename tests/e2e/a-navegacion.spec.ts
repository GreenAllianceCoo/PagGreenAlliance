import { expect, test, type Page } from "@playwright/test";
import {
  afiliacionesPorCedula,
  CEDULA_NO_REGISTRADA,
  contextoConSesion,
  datosValidos,
  esEscritorio,
  limpiarLimites,
  llenarAfiliacion,
  pedirCodigo,
} from "./utils";

/**
 * A. Navegación: cada fila «→ ruta» del mapa de botones, anclas y enlaces
 * Pendientes (href="#") que no deben romper la página.
 */

const H1 = {
  "/": "Crédito entre compañeros, con reglas claras.",
  "/ingresar": "Hola de nuevo",
  "/afiliacion": "Quiero afiliarme",
  "/cuenta": "Hola,",
};

async function h1(page: Page) {
  return (await page.locator("h1").first().innerText()).replace(/\s+/g, " ").trim();
}

async function estaEnPantalla(page: Page, selector: string) {
  // La sección quedó dentro del viewport después del scroll.
  await expect
    .poll(async () =>
      page.locator(selector).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0 && Math.abs(r.top) < window.innerHeight;
      }),
    )
    .toBe(true);
}

test.describe("A · Landing /", () => {
  test("Logo → /", async ({ page }) => {
    await page.goto("/#c-convenios");
    await page.getByRole("link", { name: "Cooperativa Green Alliance, inicio" }).click();
    await expect(page).toHaveURL(/\/$|\/#?$/);
    expect(await h1(page)).toBe(H1["/"]);
  });

  test("Anclas del nav (escritorio): Apoyos, Historias, Convenios", async ({ page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "El nav de anclas solo existe en escritorio.");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const [texto, id] of [
      ["Apoyos", "#c-apoyos"],
      ["Historias", "#c-historias"],
      ["Convenios", "#c-convenios"],
    ] as const) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await nav.getByRole("link", { name: texto, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${id}$`));
      await estaEnPantalla(page, id);
    }
  });

  test("«Afíliate» (escritorio) → /afiliacion", async ({ page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Solo escritorio.");
    await page.goto("/");
    await page.getByRole("link", { name: "Afíliate" }).click();
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(await h1(page)).toBe(H1["/afiliacion"]);
  });

  test("«Mi cuenta» (escritorio) / «Ingresar» (celular) → /ingresar", async ({ page }, testInfo) => {
    await page.goto("/");
    const nombre = esEscritorio(testInfo) ? "Mi cuenta" : "Ingresar";
    const enlace = page.getByRole("link", { name: nombre, exact: true });
    await expect(enlace).toBeVisible();
    await enlace.click();
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(await h1(page)).toBe(H1["/ingresar"]);
  });

  test("«Solicitar crédito» → /ingresar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Solicitar crédito" }).click();
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(await h1(page)).toBe(H1["/ingresar"]);
  });

  test("«Conocer la cooperativa» (escritorio) → #c-apoyos", async ({ page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Solo escritorio.");
    await page.goto("/");
    await page.getByRole("link", { name: "Conocer la cooperativa" }).click();
    await expect(page).toHaveURL(/#c-apoyos$/);
    await estaEnPantalla(page, "#c-apoyos");
  });

  test("«Quiero afiliarme» (celular) → /afiliacion", async ({ page }, testInfo) => {
    test.skip(esEscritorio(testInfo), "Solo celular.");
    await page.goto("/");
    await page.getByRole("link", { name: "Quiero afiliarme" }).click();
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(await h1(page)).toBe(H1["/afiliacion"]);
  });

  test("«Ver beneficios en mi cuenta» (escritorio) → /ingresar", async ({ page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "El diseño Móvil no tiene este enlace.");
    await page.goto("/");
    await page.getByRole("link", { name: "Ver beneficios en mi cuenta" }).click();
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(await h1(page)).toBe(H1["/ingresar"]);
  });

  test("Tarjetas de convenios: 5, solo lectura (sin enlaces)", async ({ page }) => {
    await page.goto("/");
    const seccion = page.locator("#c-convenios");
    for (const nombre of [
      "AMB Móvil S.A.S.",
      "Locos por los Viajes S.A.S.",
      "Dr. Ribero Dental Group",
      "Racing Tours Villa de Leyva",
      "Dream & Go Visas",
    ]) {
      await expect(seccion.getByText(nombre, { exact: true })).toBeVisible();
    }
  });
});

test.describe("A · Landing con sesión → /cuenta", () => {
  test("«Solicitar crédito», «Mi cuenta/Ingresar» y «Ver beneficios» llevan a /cuenta con sesión", async ({
    browser,
  }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("link", { name: "Solicitar crédito" }).click();
    await expect(page).toHaveURL(/\/cuenta$/);
    await expect(page.locator("h1")).toContainText("Hola,");

    await page.goto("/");
    await page.getByRole("link", { name: esEscritorio(testInfo) ? "Mi cuenta" : "Ingresar", exact: true }).click();
    await expect(page).toHaveURL(/\/cuenta$/);

    if (esEscritorio(testInfo)) {
      await page.goto("/");
      await page.getByRole("link", { name: "Ver beneficios en mi cuenta" }).click();
      await expect(page).toHaveURL(/\/cuenta$/);
    }
    await ctx.close();
  });
});

test.describe("A · Ingreso", () => {
  test("/ingresar: Logo → / y «Deseo afiliarme» → /afiliacion", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await h1(page)).toBe(H1["/"]);

    await page.goto("/ingresar");
    await page.getByRole("link", { name: "Deseo afiliarme" }).click();
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(await h1(page)).toBe(H1["/afiliacion"]);
  });

  test("/ingresar/codigo: Logo → / y «Cambiar cédula»/Volver → /ingresar", async ({ page }, testInfo) => {
    await limpiarLimites();
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar\/codigo$/);
    if (esEscritorio(testInfo)) {
      await page.getByRole("link", { name: "Cambiar cédula" }).click();
    } else {
      await page.getByRole("link", { name: "Volver" }).click();
    }
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(await h1(page)).toBe(H1["/ingresar"]);
  });
});

test.describe("A · Afiliación", () => {
  test("Logo → /, «¿Ya eres asociado? Ingresa» / flecha volver → /ingresar", async ({ page }, testInfo) => {
    await page.goto("/afiliacion");
    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/afiliacion");
    const volver = esEscritorio(testInfo)
      ? page.getByRole("link", { name: "¿Ya eres asociado? Ingresa" })
      : page.getByRole("link", { name: "Volver al ingreso" });
    await expect(volver).toBeVisible();
    await volver.click();
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(await h1(page)).toBe(H1["/ingresar"]);
  });

  test("«política de datos» (Pendiente) abre /politica-de-datos sin romper", async ({ page }) => {
    await page.goto("/afiliacion");
    const [nueva] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("link", { name: "política de datos" }).click(),
    ]);
    await nueva.waitForLoadState();
    await expect(nueva).toHaveURL(/\/politica-de-datos$/);
    await expect(nueva.locator("h1")).toHaveText("Política de tratamiento de datos");
    await nueva.close();
  });
});

test.describe("A · Cuenta", () => {
  test("Logo, «Inicio», «Nueva solicitud», «Convenios» y tarjetas href=#", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));

    await page.goto("/cuenta");
    if (esEscritorio(testInfo)) {
      const nav = page.getByRole("navigation", { name: "Principal" });
      await nav.getByRole("link", { name: "Inicio" }).click();
      await expect(page).toHaveURL(/\/cuenta$/);

      await nav.getByRole("link", { name: "Convenios" }).click();
      await expect(page).toHaveURL(/\/cuenta#convenios$/);
      await estaEnPantalla(page, "#convenios");

      await page.goto("/cuenta");
      await nav.getByRole("link", { name: "Nueva solicitud" }).click();
      await expect(page).toHaveURL(/\/dashboard\/solicitar$/);
    } else {
      const accesos = page.getByRole("navigation", { name: "Accesos" });
      await accesos.getByRole("link", { name: "Convenios" }).click();
      await expect(page).toHaveURL(/\/cuenta#convenios$/);
      await estaEnPantalla(page, "#convenios");
    }

    await page.goto("/cuenta");
    await page.getByRole("navigation", { name: "Accesos" }).getByRole("link", { name: "Nueva solicitud" }).click();
    await expect(page).toHaveURL(/\/dashboard\/solicitar$/);
    // El formulario de solicitud vuelve a /cuenta.
    await page.getByRole("link", { name: /volver|cuenta|inicio/i }).first().click();
    await expect(page).toHaveURL(/\/cuenta$/);

    // Tarjetas de convenio (Pendiente, href="#"): no rompen la página.
    await page.goto("/cuenta");
    await page.locator("#convenios a").first().click();
    await expect(page).toHaveURL(/\/cuenta#?$/);
    await expect(page.locator("h1")).toContainText("Hola,");

    // Logo → /
    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errores).toEqual([]);
    await ctx.close();
  });
});

test.describe("A · Afiliación enviada", () => {
  test("«Volver al inicio» → / (llegando con el campo trampa: no guarda filas)", async ({ page }) => {
    const datos = datosValidos();
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datos);
    await page.locator("#af-sitio").evaluate((el: HTMLInputElement) => (el.value = "spam"));
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
    await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await h1(page)).toBe(H1["/"]);
    expect(await afiliacionesPorCedula(datos.cedula)).toHaveLength(0);
  });
});

test.describe("A · Sin 404", () => {
  for (const ruta of ["/", "/ingresar", "/afiliacion", "/politica-de-datos"]) {
    test(`${ruta} responde 200`, async ({ page }) => {
      const r = await page.goto(ruta);
      expect(r?.status()).toBe(200);
    });
  }

  test("Todos los enlaces internos de las páginas públicas existen", async ({ page, request }) => {
    const vistos = new Set<string>();
    for (const ruta of ["/", "/ingresar", "/afiliacion", "/politica-de-datos"]) {
      await page.goto(ruta);
      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      for (const h of hrefs) {
        if (!h.startsWith("/") || h.startsWith("//")) continue;
        const limpio = h.split("#")[0] || "/";
        if (vistos.has(limpio)) continue;
        vistos.add(limpio);
        const r = await request.get(limpio, { maxRedirects: 5 });
        expect(r.status(), `${limpio} desde ${ruta}`).toBeLessThan(400);
      }
    }
  });
});
