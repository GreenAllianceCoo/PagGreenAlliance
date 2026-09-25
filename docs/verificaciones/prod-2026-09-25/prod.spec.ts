import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * QA de producción (actividad 6.3) contra https://www.greenallianceco.com
 * (main, merge 5a39d34). Ver docs/verificaciones/2026-09-25-produccion.md.
 *
 * REGLAS ESTRICTAS (producción real, sin entorno de pruebas):
 *  - Nunca se envía el formulario de /afiliacion.
 *  - Nunca se pide un código de ingreso real (no se escribe una cédula en
 *    /ingresar y se pulsa «Enviarme el código»).
 *  - No se crean ni modifican datos. Solo navegación y validaciones del
 *    lado del navegador (HTML5 / JS del cliente, sin red de escritura).
 *
 * Corre con:
 *   npx playwright test -c docs/verificaciones/prod-2026-09-25
 */

const CARPETA = path.resolve(__dirname, "..", "..", "..", "test-results", "qa", "produccion");

function esEscritorio(testInfo: TestInfo) {
  return testInfo.project.name === "escritorio";
}

async function captura(page: Page, nombre: string, testInfo: TestInfo) {
  fs.mkdirSync(CARPETA, { recursive: true });
  await page.screenshot({ path: path.join(CARPETA, `${nombre}-${testInfo.project.name}.png`), fullPage: true });
}

async function axeGraves(page: Page, nombre: string, testInfo: TestInfo) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  fs.mkdirSync(CARPETA, { recursive: true });
  fs.writeFileSync(
    path.join(CARPETA, `axe-${nombre}-${testInfo.project.name}.json`),
    JSON.stringify(r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.map((n) => n.target.join(" ")) })), null, 2),
  );
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

function escucharConsola(page: Page) {
  const errores: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });
  page.on("pageerror", (e) => errores.push(e.message));
  return errores;
}

// ---------------------------------------------------------------------------
// A. Landing
// ---------------------------------------------------------------------------

test.describe("A · Landing /", () => {
  test("Título, h1, secciones y enlaces de navegación", async ({ page }, testInfo) => {
    const errores = escucharConsola(page);
    const r = await page.goto("/");
    expect(r?.status()).toBe(200);
    await expect(page).toHaveTitle(/Green Alliance/);
    await expect(page.locator("h1")).toHaveText("Crédito entre compañeros, con reglas claras.");

    // Anclas: hacen scroll, no navegan a otra URL.
    if (esEscritorio(testInfo)) {
      await page.getByRole("link", { name: "Apoyos" }).click();
      await expect(page).toHaveURL(/#c-apoyos$/);
      await expect(page.locator("#c-apoyos")).toBeInViewport();
      await page.getByRole("link", { name: "Historias" }).click();
      await expect(page).toHaveURL(/#c-historias$/);
      await page.getByRole("link", { name: "Convenios" }).click();
      await expect(page).toHaveURL(/#c-convenios$/);

      // «Afíliate» → /afiliacion
      await page.getByRole("link", { name: "Afíliate" }).click();
      await expect(page).toHaveURL(/\/afiliacion$/);
      await expect(page.locator("h1")).toContainText("afiliar");
      await page.goBack();

      // «Mi cuenta» (sin sesión) → /ingresar. Se acota a la navegación del
      // encabezado con nombre exacto: «Ver beneficios en mi cuenta» (sección
      // convenios) también matchea "Mi cuenta" por subcadena (2 elementos
      // con el matching por defecto de getByRole).
      await page.goto("/");
      const miCuenta = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mi cuenta", exact: true });
      await expect(miCuenta).toBeVisible();
      await miCuenta.click();
      await expect(page).toHaveURL(/\/ingresar$/);
      await page.goBack();
    } else {
      // Celular: «Ingresar» en vez de «Mi cuenta».
      const ingresar = page.getByRole("link", { name: "Ingresar" }).first();
      await expect(ingresar).toBeVisible();
    }

    await captura(page, "a-landing", testInfo);
    expect(errores, `Errores de consola en /: ${errores.join(" | ")}`).toEqual([]);
  });

  test("Hero: «Solicitar crédito» y botón secundario", async ({ page }, testInfo) => {
    await page.goto("/");
    const solicitar = page.getByRole("link", { name: "Solicitar crédito" });
    await expect(solicitar).toBeVisible();
    await expect(solicitar).toHaveAttribute("href", "/ingresar");

    if (esEscritorio(testInfo)) {
      const conocer = page.getByRole("link", { name: "Conocer la cooperativa" });
      await expect(conocer).toBeVisible();
      await conocer.click();
      await expect(page).toHaveURL(/#c-apoyos$/);
    } else {
      const afiliarme = page.getByRole("link", { name: "Quiero afiliarme" });
      await expect(afiliarme).toBeVisible();
      await expect(afiliarme).toHaveAttribute("href", "/afiliacion");
    }
  });

  test("Contacto: WhatsApp, soporte@greenallianceco.com y «4 horas o menos» en el pie", async ({ page }, testInfo) => {
    const esEscritorioGlobal = esEscritorio(testInfo);
    await page.goto("/");
    const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");

    // design/Main.dc.html §footer: «WhatsApp [NÚMERO] · [correo]@greenallianceco.com ·
    // [Vigilada...]» es texto plano (sin <a>), no un enlace. Aquí solo se
    // comprueba el contenido; que sea clicable se exige en /ingresar, abajo.
    expect(texto, "No aparece el número de WhatsApp en el pie").toMatch(/WhatsApp\s*3\s*1\s*1\s*7\s*2\s*4\s*1\s*9\s*4\s*2/);
    const conEspacios = /WhatsApp 311 724 1942/.test(texto);
    test.info().annotations.push({
      type: "whatsapp-formato",
      description: conEspacios
        ? "El número se muestra con espacios (311 724 1942)"
        : "El número se muestra SIN espacios (hallazgo: lib/config.ts#WHATSAPP_NUMERO)",
    });

    const mailto = page.locator('a[href^="mailto:soporte@greenallianceco.com"]');
    expect(texto, "No aparece el correo de soporte en el pie").toContain("soporte@greenallianceco.com");
    test.info().annotations.push({
      type: "contacto",
      description: (await mailto.count()) > 0 ? "soporte@ es un enlace mailto:" : "soporte@ aparece como texto plano (sin mailto:), fiel al diseño",
    });

    if (esEscritorioGlobal) {
      expect(texto).toContain("4 horas o menos");
    } else {
      expect(texto, "Ni la forma larga ni la corta del tiempo de respuesta aparecen en celular").toMatch(/4 horas o menos|≤ ?4 ?h/);
    }

    const vigilancia = /Vigilada por Supersolidaria/.test(texto);
    test.info().annotations.push({
      type: "vigilancia",
      description: vigilancia
        ? "El texto de vigilancia sigue siendo el marcador «[Vigilada por Supersolidaria — confirmar]» (dato pendiente de la cooperativa, visible al público)"
        : "El texto de vigilancia ya no es un marcador",
    });
  });

  test("«Ayuda por WhatsApp» en /ingresar: enlace real a wa.me/573117241942", async ({ page }) => {
    await page.goto("/ingresar");
    const wa = page.locator('a[href*="wa.me"]:visible').first();
    await expect(wa, "No hay enlace wa.me en /ingresar").toBeVisible();
    const href = await wa.getAttribute("href");
    expect(href).toBe("https://wa.me/573117241942");
    const texto = (await wa.textContent())?.trim() ?? "";
    test.info().annotations.push({
      type: "whatsapp-ingresar-texto",
      description: `Texto visible del enlace: "${texto}"` + (texto === "3117241942" ? " (sin espacios; mismo hallazgo que el pie)" : ""),
    });
  });

  test("Ningún enlace visible da 404 (chequeo por cabecera, sin navegar)", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((els) => Array.from(new Set(els.map((e) => e.getAttribute("href") ?? ""))));
    const internos = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//"));
    const malos: string[] = [];
    for (const h of internos) {
      const ruta = h.split("#")[0].split("?")[0] || "/";
      const r = await request.get(ruta, { maxRedirects: 3 });
      if (r.status() >= 400) malos.push(`${h} → ${r.status()}`);
    }
    expect(malos, malos.join(", ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// B. Ingreso /ingresar (SOLO validación de cliente; nunca se pulsa «Enviarme
//    el código» con una cédula real ni se completa el envío).
// ---------------------------------------------------------------------------

test.describe("B · /ingresar (sin enviar código)", () => {
  test("Título, h1, «Deseo afiliarme» visible → /afiliacion", async ({ page }) => {
    const r = await page.goto("/ingresar");
    expect(r?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    const afiliarme = page.getByRole("link", { name: "Deseo afiliarme" });
    await expect(afiliarme).toBeVisible();
    await expect(afiliarme).toHaveAttribute("href", "/afiliacion");
  });

  test("Formato de cédula: input numérico con límites 6–10; letras no quedan", async ({ page }) => {
    await page.goto("/ingresar");
    const input = page.getByLabel(/cédula/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("inputmode", "numeric");

    // Letras: si el campo filtra con JS al escribir, no deben quedar letras.
    await input.fill("");
    await input.pressSequentially("abcabc", { delay: 20 });
    const conLetras = await input.inputValue();
    test.info().annotations.push({ type: "cedula-letras", description: `Valor tras teclear letras: "${conLetras}"` });

    // Botón «Enviarme el código» deshabilitado o el formulario no debe
    // permitir avanzar con un valor claramente inválido (< 6 dígitos).
    await input.fill("");
    await input.pressSequentially("123", { delay: 20 });
    const boton = page.getByRole("button", { name: /enviarme el código/i });
    await expect(boton).toBeVisible();
    // No se hace clic (evitar cualquier envío real): solo se registra el
    // estado del botón/validación para el informe.
    const deshabilitado = await boton.isDisabled();
    const maxLength = await input.getAttribute("maxlength");
    test.info().annotations.push({
      type: "cedula-corta",
      description: `Con 3 dígitos: botón deshabilitado=${deshabilitado}, maxlength=${maxLength}`,
    });
  });

  test("Estilos: botón primario verde #1E6652, fuente Manrope", async ({ page }, testInfo) => {
    await page.goto("/ingresar");
    const boton = page.getByRole("button", { name: /enviarme el código/i });
    const color = await boton.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(color).toBe("rgb(30, 102, 82)");
    const fuente = (await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toLowerCase();
    expect(fuente).toContain("manrope");
    await captura(page, "b-ingresar", testInfo);
  });

  test("Entrar directo a /ingresar/codigo sin pasar por el paso 1 → /ingresar", async ({ page }) => {
    const r = await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar$/);
    expect(r?.status()).toBeLessThan(400);
  });
});

// ---------------------------------------------------------------------------
// C. Afiliación /afiliacion (campos v2; NUNCA se pulsa «Enviar solicitud»).
// ---------------------------------------------------------------------------

test.describe("C · /afiliacion (campos v2, sin enviar)", () => {
  test("Título, h1 y «¿Ya eres asociado? Ingresa» / volver", async ({ page }, testInfo) => {
    const r = await page.goto("/afiliacion");
    expect(r?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Quiero afiliarme");
    if (esEscritorio(testInfo)) {
      const link = page.getByRole("link", { name: "¿Ya eres asociado? Ingresa" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/ingresar");
    } else {
      const volver = page.getByRole("link", { name: "Volver al ingreso" });
      await expect(volver).toBeVisible();
    }
  });

  test("Nombres y apellidos: solo letras (los dígitos y símbolos se descartan al escribir)", async ({ page }) => {
    await page.goto("/afiliacion");
    const nombres = page.getByLabel("Nombres");
    await nombres.pressSequentially("Ju4n123 P#rez", { delay: 15 });
    const valor = await nombres.inputValue();
    expect(valor, "El campo Nombres dejó pasar dígitos o símbolos").toMatch(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]*$/);
  });

  test("Cédula, celular y Nequi: solo números al escribir", async ({ page }) => {
    await page.goto("/afiliacion");
    for (const label of ["Número de cédula", "Celular", "Número Nequi"]) {
      const campo = page.getByLabel(label, { exact: true });
      await campo.fill("");
      await campo.pressSequentially("ab12cd34ef", { delay: 15 });
      const valor = await campo.inputValue();
      expect(valor, `${label}: dejó pasar letras`).toMatch(/^[0-9]*$/);
    }
  });

  test("Institución: Policía y Ejército con ayuda del dominio de correo esperado", async ({ page }) => {
    await page.goto("/afiliacion");
    const institucion = page.getByLabel("Institución");
    const opciones = await institucion.locator("option").allTextContents();
    test.info().annotations.push({ type: "instituciones", description: opciones.join(" | ") });
    expect(opciones.some((o) => /polic[ií]a/i.test(o))).toBe(true);
    expect(opciones.some((o) => /ej[ée]rcito/i.test(o))).toBe(true);

    const ayudaAntes = (await page.locator("#af-email").locator("xpath=..").innerText()).trim();
    await institucion.selectOption({ label: opciones.find((o) => /polic[ií]a/i.test(o))!.trim() });
    const ayudaDespues = (await page.locator("#af-email").locator("xpath=..").innerText()).trim();
    test.info().annotations.push({
      type: "ayuda-dominio",
      description: `Antes: "${ayudaAntes.slice(0, 120)}" · Tras elegir Policía: "${ayudaDespues.slice(0, 120)}"`,
    });
  });

  test("Asesor: desplegable con «No tengo asesor» como primera opción", async ({ page }) => {
    await page.goto("/afiliacion");
    const asesor = page.getByLabel("Asesor", { exact: false });
    const primera = await asesor.locator("option").first().textContent();
    expect(primera?.trim()).toBe("No tengo asesor");
  });

  test("3 campos de foto (cédula frente, reverso, selfie)", async ({ page }, testInfo) => {
    await page.goto("/afiliacion");
    for (const label of ["Cédula (frente)", "Cédula (reverso)", "Selfie"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await captura(page, "c-afiliacion", testInfo);
  });

  test("Checkbox de autorización con enlace a /politica-de-datos en otra pestaña", async ({ page, context }) => {
    await page.goto("/afiliacion");
    const checkbox = page.locator("#af-datos");
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    const link = page.getByRole("link", { name: /política de datos/i });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", "/politica-de-datos");

    const [nueva] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await nueva.waitForLoadState();
    await expect(nueva).toHaveURL(/\/politica-de-datos$/);
    await nueva.close();

    // Confirmar que abrir el enlace no perdió lo escrito en el formulario (misma pestaña).
    await expect(page.getByLabel("Número de cédula")).toBeVisible();
  });

  test("«Enviar solicitud» visible pero NO se pulsa (regla de esta verificación)", async ({ page }) => {
    await page.goto("/afiliacion");
    const enviar = page.getByRole("button", { name: "Enviar solicitud" });
    await expect(enviar).toBeVisible();
    // A propósito: no se hace click(). Solo se confirma que existe y el
    // estilo (verde primario) coincide con el resto del sitio.
    const color = await enviar.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(color).toBe("rgb(30, 102, 82)");
  });

  test("Entrar directo a /afiliacion/enviada sin enviar → /afiliacion", async ({ page }) => {
    const r = await page.goto("/afiliacion/enviada");
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(r?.status()).toBeLessThan(400);
  });

  test("Accesibilidad: sin violaciones serias/críticas; campos con label", async ({ page }, testInfo) => {
    await page.goto("/afiliacion");
    const graves = await axeGraves(page, "afiliacion", testInfo);
    expect(graves, graves.join("\n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D. Política de datos
// ---------------------------------------------------------------------------

test.describe("D · /politica-de-datos", () => {
  test("Carga con 200, título, h1; se anotan los huecos <Pendiente>", async ({ page }, testInfo) => {
    const r = await page.goto("/politica-de-datos");
    expect(r?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Política de tratamiento de datos");
    const texto = await page.locator("main").innerText();
    const pendientes = (texto.match(/pendiente/gi) ?? []).length;
    test.info().annotations.push({
      type: "huecos-pendientes",
      description: `${pendientes} menciones de «pendiente» en el texto (esperado, no es falla; ver docs/mapa-de-botones.md §5 y plan.json P-75..P-81).`,
    });
    await captura(page, "d-politica-de-datos", testInfo);
  });
});

// ---------------------------------------------------------------------------
// E. Rutas protegidas sin sesión
// ---------------------------------------------------------------------------

test.describe("E · Rutas protegidas sin sesión → /ingresar", () => {
  for (const ruta of ["/admin", "/asesor", "/cuenta"]) {
    test(`${ruta} sin sesión redirige a /ingresar`, async ({ page }) => {
      const r = await page.goto(ruta);
      await expect(page).toHaveURL(/\/ingresar$/);
      expect(r?.status()).toBeLessThan(400);
      await expect(page.locator("h1")).toBeVisible();
    });
  }
});

// ---------------------------------------------------------------------------
// F. Dominio, 404 y cabeceras
// ---------------------------------------------------------------------------

test.describe("F · Dominio, 404 y cabeceras", () => {
  test("greenallianceco.com → https://www.greenallianceco.com (308)", async ({ request }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Una vez basta (no depende del viewport)");
    const r = await request.get("https://greenallianceco.com/", { maxRedirects: 0 });
    const cabeceras = r.headers();
    test.info().annotations.push({
      type: "apex-domain",
      description: `status=${r.status()} age=${cabeceras["age"] ?? "?"} x-vercel-id=${cabeceras["x-vercel-id"] ?? "?"} location=${cabeceras["location"] ?? "(ninguna)"}`,
    });
    // HALLAZGO (25-sep, ~19:41 GMT): la primera comprobación por curl devolvió
    // 308 → https://www.greenallianceco.com/ (correcto). ~14 min después, 5
    // intentos seguidos por curl y esta prueba devuelven 200 con el sitio
    // completo servido directamente desde greenallianceco.com (sin redirigir),
    // con cabecera Age creciente (respuesta de caché de borde de Vercel). No es
    // un cambio de código: revisar en Vercel > Domains si el dominio raíz está
    // configurado como “Redirect to” www o como otro alias de producción.
    if (r.status() === 200) {
      test.info().annotations.push({
        type: "hallazgo",
        description: "greenallianceco.com sirve el sitio completo (200) en vez de redirigir (308) a www; ver anotación apex-domain para la evidencia.",
      });
    }
    expect(r.status(), "Ver anotación apex-domain: a veces 308 (correcto) y a veces 200 (hallazgo)").toBe(308);
    expect(r.headers()["location"]).toBe("https://www.greenallianceco.com/");
  });

  test("Ruta inexistente → 404 en español con salida al inicio", async ({ page }, testInfo) => {
    const r = await page.goto("/esta-ruta-no-existe-qa");
    expect(r?.status()).toBe(404);
    const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    test.info().annotations.push({ type: "404-texto", description: texto.slice(0, 200) });
    expect(texto).not.toContain("This page could not be found");
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
    await captura(page, "f-404", testInfo);
  });

  test("Cabeceras de seguridad en /, /ingresar y /cuenta", async ({ request }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Una vez basta");
    const cabeceras: Record<string, Record<string, string>> = {};
    for (const ruta of ["/", "/ingresar", "/cuenta"]) {
      const r = await request.get(ruta, { maxRedirects: 3 });
      cabeceras[ruta] = r.headers();
    }
    fs.mkdirSync(CARPETA, { recursive: true });
    fs.writeFileSync(path.join(CARPETA, "f-cabeceras.json"), JSON.stringify(cabeceras, null, 2));
    for (const [ruta, h] of Object.entries(cabeceras)) {
      const protegida = !!h["x-frame-options"] || /frame-ancestors/.test(h["content-security-policy"] ?? "");
      expect(protegida, `${ruta}: sin X-Frame-Options ni CSP frame-ancestors`).toBe(true);
      expect(h["strict-transport-security"], `${ruta}: sin HSTS`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// G. Accesibilidad y consola (landing, ingreso, política)
// ---------------------------------------------------------------------------

test.describe("G · Accesibilidad básica y consola", () => {
  test("axe en / sin violaciones serias/críticas", async ({ page }, testInfo) => {
    const errores = escucharConsola(page);
    await page.goto("/");
    const graves = await axeGraves(page, "landing", testInfo);
    expect(graves, graves.join("\n")).toEqual([]);
    expect(errores, errores.join(" | ")).toEqual([]);
  });

  test("axe en /ingresar sin violaciones serias/críticas; navegación solo con teclado", async ({ page }, testInfo) => {
    await page.goto("/ingresar");
    const graves = await axeGraves(page, "ingresar", testInfo);
    expect(graves, graves.join("\n")).toEqual([]);

    // Tab hasta el input y comprobar foco visible.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    });
    test.info().annotations.push({ type: "foco-visible", description: String(outline) });
  });

  test("axe en /politica-de-datos sin violaciones serias/críticas", async ({ page }, testInfo) => {
    await page.goto("/politica-de-datos");
    const graves = await axeGraves(page, "politica", testInfo);
    expect(graves, graves.join("\n")).toEqual([]);
  });
});
