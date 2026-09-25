import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  adminRest,
  afiliacionesPorCedula,
  capturaCompleta,
  CARPETA_QA,
  CEDULA_NO_REGISTRADA,
  contextoConSesion,
  datosValidos,
  ENV_LOCAL,
  esEscritorio,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarAfiliacion,
  llenarOtp,
  MENSAJE_CODIGO_INVALIDO,
  mensajesPara,
  opcionesContexto,
  pedirCodigo,
  RAIZ,
  tokenDeUsuario,
  USUARIOS,
  usuarioRest,
} from "./utils";

/**
 * I. Verificación antes del despliegue (commit bf09975): lo que no cubrían
 * las secciones A–H.
 *  - /login, /dashboard y /dashboard/solicitar dan 404 y nada enlaza a ellas.
 *  - /cuenta/solicitar: pantalla, deslizador, tasa, validaciones del servidor
 *    (mínimo, tope, porcentaje), una sola pendiente, RLS y accesibilidad.
 *  - Límites de intentos (45 s y 5/15 min por cédula, 20/15 min por IP en el
 *    código; 5/h por IP y 3/día por cédula en la afiliación).
 *  - Código reemplazado por un reenvío y cookie del paso 1 vencida.
 *  - /politica-de-datos.
 * Solo local (utils.ts se niega a correr contra otro Supabase).
 */

const ID_CON_SOLICITUD = "4c7808d8-085f-42ed-9e5d-f53c117b4cd1";
const ID_SIN_SOLICITUDES = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";
const VERDE = "rgb(30, 102, 82)";

// ---------------------------------------------------------------------------
// Utilidades propias
// ---------------------------------------------------------------------------

/** Misma clave que lib/servidor/limite.ts#claveHmac (con el secreto LOCAL). */
function claveLimite(tipo: string, valor: string) {
  const secreto = ENV_LOCAL.LIMITE_HMAC_SECRET ?? "";
  const hmac = createHmac("sha256", secreto).update(`${tipo}:${valor}`).digest("hex").slice(0, 40);
  return `${tipo}:${hmac}`;
}

/** Llena un límite (service role, solo local) para simular que ya se gastaron los intentos. */
async function gastarLimite(tipo: string, valor: string, veces: number) {
  const filas = Array.from({ length: veces }, () => ({ clave: claveLimite(tipo, valor) }));
  const r = await adminRest("limites_intentos", { method: "POST", body: JSON.stringify(filas) });
  expect(r.status, `insertar límites ${tipo}: ${JSON.stringify(r.cuerpo)}`).toBeLessThan(300);
}

/** Misma cookie cifrada que lib/ingreso/servidor.ts (con el secreto LOCAL). */
function cookieIngreso(datos: { c: string; m: string; u: number }) {
  const llave = createHash("sha256").update(ENV_LOCAL.INGRESO_COOKIE_SECRET ?? "").digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave, iv);
  const cuerpo = Buffer.concat([c.update(JSON.stringify(datos), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), cuerpo]).toString("base64url");
}

async function solicitudesDe(id: string) {
  const { cuerpo } = await adminRest(
    `solicitudes_credito?select=id,estado,monto_solicitado,porcentaje_devolucion,tasa_interes_mensual&asociado_id=eq.${id}&order=fecha_solicitud.desc`,
  );
  return (Array.isArray(cuerpo) ? cuerpo : []) as {
    id: string;
    estado: string;
    monto_solicitado: number;
    porcentaje_devolucion: string;
    tasa_interes_mensual: number;
  }[];
}

async function borrarSolicitudesSinSolicitudes() {
  await adminRest(`solicitudes_credito?asociado_id=eq.${ID_SIN_SOLICITUDES}`, { method: "DELETE" });
}

/** Cambia el valor que se envía de un campo sin tocar el estado de React (simula un cliente manipulado). */
async function forzarCampo(page: Page, nombre: string, valor: string) {
  await page.evaluate(
    ({ nombre, valor }) => {
      const form = document.querySelector("main form") as HTMLFormElement;
      form.querySelectorAll(`[name="${nombre}"]`).forEach((el) => el.removeAttribute("name"));
      const oculto = document.createElement("input");
      oculto.type = "hidden";
      oculto.name = nombre;
      oculto.value = valor;
      form.appendChild(oculto);
    },
    { nombre, valor },
  );
}

async function axeGraves(page: Page, nombre: string, testInfo: TestInfo) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();
  fs.mkdirSync(CARPETA_QA, { recursive: true });
  fs.writeFileSync(
    path.join(CARPETA_QA, `axe-${nombre}-${testInfo.project.name}.json`),
    JSON.stringify(r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.map((n) => n.target.join(" ")) })), null, 2),
  );
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function sesionSinSolicitudes(browser: Browser, testInfo: TestInfo) {
  const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
  const page = await ctx.newPage();
  return { ctx, page };
}

// ---------------------------------------------------------------------------
// I1 · Rutas viejas
// ---------------------------------------------------------------------------

test.describe("I1 · /login y /dashboard ya no existen", () => {
  for (const ruta of ["/login", "/dashboard", "/dashboard/solicitar"]) {
    test(`${ruta} responde 404`, async ({ page }) => {
      const r = await page.goto(ruta);
      expect(r?.status()).toBe(404);
    });
  }

  test("Ninguna página (pública o con sesión) enlaza a /login o /dashboard", async ({ browser }, testInfo) => {
    const malos: string[] = [];
    const revisar = async (page: Page, ruta: string) => {
      await page.goto(ruta);
      const html = await page.content();
      const destinos = await page
        .locator("a[href], form[action], button[formaction]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? e.getAttribute("action") ?? e.getAttribute("formaction") ?? ""));
      for (const d of destinos) if (/^\/(login|dashboard)(\/|$|\?|#)/.test(d)) malos.push(`${ruta}: ${d}`);
      if (/["'(]\/(login|dashboard)(\/|["'?#)])/.test(html)) malos.push(`${ruta}: aparece en el HTML`);
    };
    const publica = await browser.newContext(opcionesContexto(testInfo));
    const p = await publica.newPage();
    for (const ruta of ["/", "/ingresar", "/afiliacion", "/politica-de-datos"]) await revisar(p, ruta);
    await pedirCodigo(p, CEDULA_NO_REGISTRADA);
    await revisar(p, "/ingresar/codigo");
    await publica.close();

    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    for (const ruta of ["/cuenta", "/cuenta/solicitar"]) await revisar(page, ruta);
    await ctx.close();
    expect(malos).toEqual([]);
  });

  test("El código de la app no menciona las rutas viejas", async ({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Revisión estática: una sola vez");
    const malos: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(ts|tsx|mjs|js)$/.test(e.name) && /["'`]\/(login|dashboard)\b/.test(fs.readFileSync(p, "utf8"))) {
          malos.push(path.relative(RAIZ, p));
        }
      }
    };
    for (const d of ["app", "components", "lib"]) recorrer(path.join(RAIZ, d));
    for (const f of ["proxy.ts", "next.config.mjs"]) {
      if (/["'`]\/(login|dashboard)\b/.test(fs.readFileSync(path.join(RAIZ, f), "utf8"))) malos.push(f);
    }
    expect(fs.existsSync(path.join(RAIZ, "app", "login"))).toBe(false);
    expect(fs.existsSync(path.join(RAIZ, "app", "dashboard"))).toBe(false);
    expect(malos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// I2 · /cuenta/solicitar
// ---------------------------------------------------------------------------

test.describe("I2 · /cuenta/solicitar", () => {
  test.beforeEach(async () => {
    await borrarSolicitudesSinSolicitudes();
    await limpiarLimites();
  });
  test.afterAll(borrarSolicitudesSinSolicitudes);

  test("Pantalla: título, 50/100 %, deslizador (mínimo 100.000, tope y pasos), tasa y plazo del grado", async ({
    browser,
  }, testInfo) => {
    const { cuerpo } = await adminRest("grados_credito?select=porcentaje,capacidad_maxima,tasa_interes_mensual,plazo_meses&grado=eq.SI");
    const paquetes = cuerpo as { porcentaje: string; capacidad_maxima: number; tasa_interes_mensual: number; plazo_meses: number }[];
    const tasaTexto = (t: number) => `${(Number(t) * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
    const pesos = (v: number) => `$${v.toLocaleString("es-CO")}`;

    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    const r = await page.goto("/cuenta/solicitar");
    expect(r?.status()).toBe(200);
    await expect(page).toHaveTitle("Nueva solicitud · Cooperativa Green Alliance");
    await expect(page.locator("h1")).toHaveText("Nueva solicitud");
    await expect(page.getByRole("heading", { level: 2, name: "Solicita tu crédito" })).toBeVisible();
    if (esEscritorio(testInfo)) {
      await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Nueva solicitud" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Convenios" })).toHaveAttribute("href", "/cuenta#convenios");
    }

    const monto = page.locator("#monto");
    for (const p of paquetes) {
      await page.getByText(`${p.porcentaje}% de devolución`, { exact: true }).click();
      await expect(page.getByRole("radio", { name: `${p.porcentaje}% de devolución` })).toBeChecked();
      await expect(monto).toHaveAttribute("min", "100000");
      await expect(monto).toHaveAttribute("max", String(p.capacidad_maxima));
      await expect(monto).toHaveAttribute("step", "50000");
      // Al elegir el paquete, el monto queda en el tope.
      await expect(monto).toHaveValue(String(p.capacidad_maxima));
      await expect(page.locator("output[for=monto]")).toHaveText(pesos(p.capacidad_maxima));
      await expect(page.getByText(`Tope ${pesos(p.capacidad_maxima)}`)).toBeVisible();
      await expect(page.getByText("Mínimo $100.000")).toBeVisible();
      const dl = page.locator("main dl");
      await expect(dl).toContainText(`Interés mensual${tasaTexto(p.tasa_interes_mensual)}`);
      await expect(dl).toContainText(`Plazo${p.plazo_meses} meses`);
      // No se calcula la cuota.
      await expect(page.locator("main")).not.toContainText(/cuota/i);
    }
    // Teclado en el deslizador: Home = mínimo; flecha derecha = +50.000.
    await monto.focus();
    await page.keyboard.press("Home");
    await expect(monto).toHaveValue("100000");
    await page.keyboard.press("ArrowRight");
    await expect(monto).toHaveValue("150000");
    await expect(page.locator("output[for=monto]")).toHaveText("$150.000");
    await expect(monto).toHaveAttribute("aria-valuetext", "$150.000");

    // Estilo: botón primario verde, Manrope.
    await page.mouse.move(1, 1);
    await page.waitForTimeout(400);
    const boton = page.getByRole("button", { name: "Enviar solicitud" });
    expect(await boton.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(VERDE);
    expect((await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toLowerCase()).toContain("manrope");
    await capturaCompleta(page, "i-cuenta-solicitar", testInfo);

    // Flecha volver → /cuenta.
    await page.getByRole("link", { name: "Volver", exact: true }).click();
    await expect(page).toHaveURL(/\/cuenta$/);
    expect(errores).toEqual([]);
    await ctx.close();
  });

  test("Envío válido (100 %, $100.000) → /cuenta con la solicitud; luego ya no deja pedir otra", async ({ browser }, testInfo) => {
    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    await page.goto("/cuenta/solicitar");
    await page.getByText("100% de devolución", { exact: true }).click();
    await page.locator("#monto").focus();
    await page.keyboard.press("Home");
    await expect(page.locator("output[for=monto]")).toHaveText("$100.000");
    // Doble clic: una sola fila.
    await page.getByRole("button", { name: "Enviar solicitud" }).dblclick();
    await page.waitForURL("**/cuenta", { timeout: 20_000 });
    const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(texto).toContain("En revisión");
    expect(texto).toContain("$ 100.000");
    expect(texto).toContain("100%");
    expect(texto).toMatch(/Interés mensual: 8,2\s?%/);
    const filas = await solicitudesDe(ID_SIN_SOLICITUDES);
    expect(filas.map((f) => [f.estado, Number(f.monto_solicitado), f.porcentaje_devolucion])).toEqual([["pendiente", 100000, "100"]]);

    await page.goto("/cuenta/solicitar");
    await expect(page.getByText("Ya tienes una solicitud pendiente de revisión. Espera la respuesta antes de enviar una nueva.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar solicitud" })).toHaveCount(0);
    await expect(page.locator("#monto")).toHaveCount(0);
    await page.getByRole("link", { name: "Volver a mi cuenta" }).click();
    await expect(page).toHaveURL(/\/cuenta$/);
    await ctx.close();
  });

  test("Con solicitud pendiente (asociado 1234567890): aviso y «Volver a mi cuenta»; axe sin graves", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta/solicitar");
    await expect(page.getByText(/Ya tienes una solicitud pendiente de revisión/)).toBeVisible();
    await expect(page.locator("form #monto")).toHaveCount(0);
    expect(await axeGraves(page, "cuenta-solicitar-pendiente", testInfo)).toEqual([]);
    await capturaCompleta(page, "i-cuenta-solicitar-pendiente", testInfo);
    await ctx.close();
  });

  test("Servidor: rechaza monto bajo el mínimo, sobre el tope y porcentaje inválido (cliente manipulado)", async ({
    browser,
  }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Validación del servidor: una vez basta");
    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    const casos = [
      { campo: "monto", valor: "50000", error: "El monto mínimo de un crédito es $100.000.", foco: "#monto" },
      { campo: "monto", valor: "1550000", error: "El monto supera el tope permitido para tu grado.", foco: "#monto" },
      { campo: "monto", valor: "abc", error: "Elige un monto válido.", foco: "#monto" },
      { campo: "porcentaje", valor: "75", error: "Elige el porcentaje de devolución.", foco: 'input[name="porcentaje"]' },
    ];
    for (const c of casos) {
      await page.goto("/cuenta/solicitar");
      await page.waitForLoadState("networkidle");
      await page.getByText("50% de devolución", { exact: true }).click();
      await forzarCampo(page, c.campo, c.valor);
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
      await expect(page.getByText(c.error), `${c.campo}=${c.valor}`).toBeVisible();
      await expect(page).toHaveURL(/\/cuenta\/solicitar$/);
      if (c.campo === "monto") {
        await expect(page.locator("#monto")).toBeFocused();
        await expect(page.locator("#monto")).toHaveAttribute("aria-invalid", "true");
        await expect(page.locator("#monto")).toHaveAttribute("aria-describedby", /monto-error/);
      }
      expect(await solicitudesDe(ID_SIN_SOLICITUDES), `sin fila tras ${c.campo}=${c.valor}`).toEqual([]);
    }
    await ctx.close();
  });

  test("Servidor: monto que no es múltiplo de 50.000 (registro del comportamiento)", async ({ browser }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Validación del servidor: una vez basta");
    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    await page.goto("/cuenta/solicitar");
    await page.waitForLoadState("networkidle");
    await page.getByText("50% de devolución", { exact: true }).click();
    await forzarCampo(page, "monto", "123457");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await page.waitForTimeout(3000);
    const filas = await solicitudesDe(ID_SIN_SOLICITUDES);
    fs.mkdirSync(CARPETA_QA, { recursive: true });
    fs.writeFileSync(
      path.join(CARPETA_QA, "i-monto-no-multiplo.json"),
      JSON.stringify({ url: page.url(), filas }, null, 2),
    );
    // Hallazgo informativo (Baja): el mapa pide pasos de $50.000 en el deslizador; el servidor no lo exige.
    test.info().annotations.push({
      type: "hallazgo",
      description: filas.length > 0 ? `El servidor guardó ${filas[0].monto_solicitado} (no múltiplo de 50.000)` : "Rechazado",
    });
    await ctx.close();
  });

  test("RLS / base: una sola pendiente, no a nombre de otro, no se aprueba sola, no supera el tope", async ({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), "API: una vez basta");
    const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);

    // A nombre de otro asociado → rechazado.
    const ajena = await usuarioRest("solicitudes_credito", token, {
      method: "POST",
      body: JSON.stringify({ asociado_id: ID_CON_SOLICITUD, porcentaje_devolucion: "50", monto_solicitado: 200000 }),
    });
    expect(ajena.status, JSON.stringify(ajena.cuerpo)).toBeGreaterThanOrEqual(400);

    // Sobre el tope (SI 50 % = 1.500.000) y bajo el mínimo → rechazado por la base.
    for (const monto of [1550000, 50000]) {
      const r = await usuarioRest("solicitudes_credito", token, {
        method: "POST",
        body: JSON.stringify({ asociado_id: ID_SIN_SOLICITUDES, porcentaje_devolucion: "50", monto_solicitado: monto }),
      });
      expect(r.status, `monto ${monto}: ${JSON.stringify(r.cuerpo)}`).toBeGreaterThanOrEqual(400);
    }

    // Intentar crearla ya aprobada y con otra tasa → nace pendiente con la tasa del grado.
    const primera = await usuarioRest("solicitudes_credito", token, {
      method: "POST",
      body: JSON.stringify({
        asociado_id: ID_SIN_SOLICITUDES,
        porcentaje_devolucion: "50",
        monto_solicitado: 200000,
        estado: "aprobado",
        tasa_interes_mensual: 0.0001,
      }),
    });
    expect(primera.status, JSON.stringify(primera.cuerpo)).toBeLessThan(300);
    let filas = await solicitudesDe(ID_SIN_SOLICITUDES);
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe("pendiente");
    expect(Number(filas[0].tasa_interes_mensual)).toBeCloseTo(0.082, 6);

    // Segunda pendiente → rechazada (índice único).
    const segunda = await usuarioRest("solicitudes_credito", token, {
      method: "POST",
      body: JSON.stringify({ asociado_id: ID_SIN_SOLICITUDES, porcentaje_devolucion: "100", monto_solicitado: 300000 }),
    });
    expect(segunda.status, JSON.stringify(segunda.cuerpo)).toBeGreaterThanOrEqual(400);

    // El asociado no puede aprobar su propia solicitud ni subir el monto sobre el tope.
    const aprobar = await usuarioRest(`solicitudes_credito?asociado_id=eq.${ID_SIN_SOLICITUDES}`, token, {
      method: "PATCH",
      body: JSON.stringify({ estado: "aprobado" }),
    });
    const subir = await usuarioRest(`solicitudes_credito?asociado_id=eq.${ID_SIN_SOLICITUDES}`, token, {
      method: "PATCH",
      body: JSON.stringify({ monto_solicitado: 9000000 }),
    });
    filas = await solicitudesDe(ID_SIN_SOLICITUDES);
    expect(filas, `PATCH estado → ${aprobar.status}; PATCH monto → ${subir.status}`).toHaveLength(1);
    expect(filas[0].estado).toBe("pendiente");
    expect(Number(filas[0].monto_solicitado)).toBe(200000);

    // No ve la solicitud del otro asociado.
    const ajenas = await usuarioRest(`solicitudes_credito?select=id&asociado_id=eq.${ID_CON_SOLICITUD}`, token);
    expect(ajenas.cuerpo).toEqual([]);
  });

  test("Teclado y axe en el formulario: radios con flechas, Enter envía; sin violaciones graves", async ({ browser }, testInfo) => {
    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    await page.goto("/cuenta/solicitar");
    await page.waitForLoadState("networkidle");
    expect(await axeGraves(page, "cuenta-solicitar", testInfo)).toEqual([]);
    // Todos los campos con nombre accesible.
    await expect(page.getByRole("radio", { name: "50% de devolución" })).toHaveCount(1);
    await expect(page.getByRole("radio", { name: "100% de devolución" })).toHaveCount(1);
    await expect(page.getByRole("slider", { name: "Monto a desembolsar" })).toHaveCount(1);

    // Tab hasta el primer radio; foco visible en su tarjeta.
    await page.getByRole("link", { name: "Volver", exact: true }).focus();
    await page.keyboard.press("Tab");
    const enfocado = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name);
    expect(enfocado).toBe("porcentaje");
    const outline = await page.evaluate(() => {
      const span = (document.activeElement as HTMLElement).nextElementSibling as HTMLElement;
      const s = getComputedStyle(span);
      return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    });
    expect(outline, "foco visible en la tarjeta del porcentaje").toBe(true);
    await page.keyboard.press("ArrowRight");
    const marcado = await page.locator('input[name="porcentaje"]:checked').getAttribute("value");
    expect(["50", "100"]).toContain(marcado);
    await ctx.close();
  });
});

// ---------------------------------------------------------------------------
// I3 · Límites de intentos
// ---------------------------------------------------------------------------

test.describe("I3 · Límites de intentos", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Límites del servidor: una vez basta");
    await limpiarLimites();
  });
  test.afterEach(limpiarLimites);

  test("Código: 1 cada 45 s por cédula (desde otro navegador tampoco), misma pantalla y sin correo", async ({ browser }, testInfo) => {
    const u = USUARIOS.sinSolicitudes;
    await esperarVentanaReenvio(u.correo);
    const a = await browser.newContext(opcionesContexto(testInfo));
    const pa = await a.newPage();
    const inicio = await pedirCodigo(pa, u.cedula);
    await esperarCodigo(u.correo, inicio);
    const antes = (await mensajesPara(u.correo)).length;
    const textoA = (await pa.locator("main").innerText()).replace(/\s+/g, " ");

    const b = await browser.newContext(opcionesContexto(testInfo));
    const pb = await b.newPage();
    await pedirCodigo(pb, u.cedula);
    await expect(pb.locator("h1")).toHaveText("Revisa tu correo");
    const textoB = (await pb.locator("main").innerText()).replace(/\s+/g, " ");
    expect(textoB).toBe(textoA);
    await pb.waitForTimeout(4000);
    expect((await mensajesPara(u.correo)).length, "no debe llegar un segundo correo antes de 45 s").toBe(antes);

    // Forzar «Reenviar código» antes de tiempo (botón habilitado a mano): el servidor lo frena.
    await pa.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("Reenviar código"));
      btn?.removeAttribute("disabled");
    });
    await pa.getByRole("button", { name: "Reenviar código" }).click({ force: true });
    await expect(pa.getByRole("status")).toContainText(/Espera \d+ segundos para pedir otro código|Enviando/);
    await pa.waitForTimeout(3000);
    expect((await mensajesPara(u.correo)).length).toBe(antes);
    await a.close();
    await b.close();
  });

  test("Código: tope de 5 por cédula en 15 min → misma pantalla, sin correo", async ({ page }) => {
    const u = USUARIOS.sinSolicitudes;
    await esperarVentanaReenvio(u.correo);
    await gastarLimite("otp-cedula", u.cedula, 5);
    const antes = (await mensajesPara(u.correo)).length;
    await pedirCodigo(page, u.cedula);
    await expect(page.locator("h1")).toHaveText("Revisa tu correo");
    // En escritorio el correo enmascarado va en el panel verde (fuera de <main>).
    await expect(page.locator("body")).toContainText(u.mascara);
    await page.waitForTimeout(5000);
    expect((await mensajesPara(u.correo)).length).toBe(antes);
  });

  test("Código: tope de 20 por IP en 15 min → misma pantalla, sin correo", async ({ browser }, testInfo) => {
    const u = USUARIOS.sinSolicitudes;
    const ip = "203.0.113.77";
    await esperarVentanaReenvio(u.correo);
    await gastarLimite("otp-ip", ip, 20);
    const ctx = await browser.newContext({ ...opcionesContexto(testInfo), extraHTTPHeaders: { "x-forwarded-for": ip } });
    const page = await ctx.newPage();
    const antes = (await mensajesPara(u.correo)).length;
    await pedirCodigo(page, u.cedula);
    await expect(page.locator("body")).toContainText(u.mascara);
    await page.waitForTimeout(5000);
    expect((await mensajesPara(u.correo)).length, "con la IP en el tope no debe salir correo").toBe(antes);
    await ctx.close();
  });

  test("Afiliación: 5 por hora por IP → mensaje general, sin fila", async ({ browser }, testInfo) => {
    const ip = "203.0.113.78";
    await gastarLimite("afiliacion-ip", ip, 5);
    const ctx = await browser.newContext({ ...opcionesContexto(testInfo), extraHTTPHeaders: { "x-forwarded-for": ip } });
    const page = await ctx.newPage();
    const d = datosValidos();
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, d);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("Recibimos varias solicitudes desde esta conexión. Intenta de nuevo en una hora.")).toBeVisible();
    await expect(page).toHaveURL(/\/afiliacion$/);
    expect(await afiliacionesPorCedula(d.cedula)).toHaveLength(0);
    await ctx.close();
  });

  test("Afiliación: 3 por día por cédula → error en la cédula, sin fila", async ({ page }) => {
    const d = datosValidos();
    await gastarLimite("afiliacion-cedula", d.cedula, 3);
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, d);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("Ya recibimos varias solicitudes con esta cédula hoy. Intenta de nuevo mañana.")).toBeVisible();
    expect(await afiliacionesPorCedula(d.cedula)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// I4 · Código reemplazado y cookie vencida
// ---------------------------------------------------------------------------

test.describe("I4 · Código viejo, cookie vencida y tiempos del paso 2", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Flujo de servidor: una vez basta");
    await limpiarLimites();
  });

  test("Tras «Reenviar código», el código anterior ya no sirve; el nuevo sí", async ({ page }) => {
    test.setTimeout(180_000);
    const u = USUARIOS.sinSolicitudes;
    await esperarVentanaReenvio(u.correo);
    const inicio = await pedirCodigo(page, u.cedula);
    const viejo = await esperarCodigo(u.correo, inicio);
    const reenviar = page.getByRole("button", { name: "Reenviar código" });
    await expect(reenviar).toBeEnabled({ timeout: 50_000 });
    await limpiarLimites();
    const t1 = Date.now();
    await reenviar.click();
    // Esperar la respuesta final: «Enviando un código nuevo…» también contiene «código nuevo»,
    // y si se pega antes de que termine el reenvío, la app vacía las casillas al terminar.
    await expect(page.getByRole("status")).toHaveText("Si tu cédula está registrada, te enviamos un código nuevo.");
    let nuevo = viejo;
    const limite = Date.now() + 20_000;
    while (nuevo === viejo && Date.now() < limite) {
      nuevo = await esperarCodigo(u.correo, t1);
      if (nuevo === viejo) await page.waitForTimeout(500);
    }
    test.skip(nuevo === viejo, "Supabase repitió el mismo código");
    await llenarOtp(page, viejo);
    await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
    await expect(page.getByText(MENSAJE_CODIGO_INVALIDO)).toBeVisible();
    await llenarOtp(page, nuevo);
    await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
    await page.waitForURL("**/cuenta");
  });

  test("Cookie del paso 1 con más de 10 min → /ingresar", async ({ context, page }) => {
    const valor = cookieIngreso({ c: USUARIOS.sinSolicitudes.cedula, m: USUARIOS.sinSolicitudes.mascara, u: Date.now() - 11 * 60_000 });
    await context.addCookies([{ name: "ga_ingreso", value: valor, url: "http://localhost:3000", httpOnly: true }]);
    await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar$/);
    // Control: la misma cookie con hora actual sí abre el paso 2 (la cookie de prueba es válida).
    await context.clearCookies();
    await context.addCookies([
      { name: "ga_ingreso", value: cookieIngreso({ c: CEDULA_NO_REGISTRADA, m: "zz•••@gmail.com", u: Date.now() }), url: "http://localhost:3000", httpOnly: true },
    ]);
    await page.goto("/ingresar/codigo");
    await expect(page).toHaveURL(/\/ingresar\/codigo$/);
  });

  test("Paso 2: el error con cédula registrada y no registrada tarda parecido (≤ 1 s)", async ({ context, page }) => {
    const medir = async (cedula: string, mascara: string) => {
      await context.clearCookies();
      await context.addCookies([
        { name: "ga_ingreso", value: cookieIngreso({ c: cedula, m: mascara, u: Date.now() - 50_000 }), url: "http://localhost:3000", httpOnly: true },
      ]);
      await page.goto("/ingresar/codigo");
      const tiempos: number[] = [];
      for (let i = 0; i < 3; i++) {
        await llenarOtp(page, "000001");
        const t0 = Date.now();
        await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
        await expect(page.getByText(MENSAJE_CODIGO_INVALIDO)).toBeVisible();
        tiempos.push(Date.now() - t0);
        await page.goto("/ingresar/codigo");
      }
      return Math.min(...tiempos);
    };
    const reg = await medir(USUARIOS.sinSolicitudes.cedula, USUARIOS.sinSolicitudes.mascara);
    const noReg = await medir(CEDULA_NO_REGISTRADA, "zz•••@gmail.com");
    fs.writeFileSync(path.join(CARPETA_QA, "i-tiempos-paso2.json"), JSON.stringify({ registradaMs: reg, noRegistradaMs: noReg }, null, 2));
    expect(Math.abs(reg - noReg), `registrada ${reg} ms vs no registrada ${noReg} ms`).toBeLessThanOrEqual(1000);
  });
});

// ---------------------------------------------------------------------------
// I5 · /politica-de-datos y privacidad de /cuenta
// ---------------------------------------------------------------------------

test.describe("I5 · Política de datos y privacidad", () => {
  test("/politica-de-datos: título, logo → /, se abre desde la afiliación en otra pestaña", async ({ page, context }, testInfo) => {
    const r = await page.goto("/politica-de-datos");
    expect(r?.status()).toBe(200);
    await expect(page).toHaveTitle("Política de tratamiento de datos · Cooperativa Green Alliance");
    await expect(page.locator("h1")).toHaveText("Política de tratamiento de datos");
    const cuerpo = await page.locator("main").innerText();
    test.info().annotations.push({ type: "pendiente", description: `Texto actual: ${cuerpo.replace(/\s+/g, " ").slice(0, 160)}` });
    await capturaCompleta(page, "i-politica-de-datos", testInfo);
    await page.getByRole("link", { name: "Ir al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/afiliacion");
    const [nueva] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: /política de datos/i }).click()]);
    await nueva.waitForLoadState();
    await expect(nueva).toHaveURL(/\/politica-de-datos$/);
    await expect(nueva.locator("h1")).toHaveText("Política de tratamiento de datos");
  });

  test("/cuenta y /cuenta/solicitar no traen el correo completo ni datos del otro asociado", async ({ browser }, testInfo) => {
    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    const cuerpos: string[] = [];
    page.on("response", async (r) => {
      try {
        if (r.url().startsWith("http://localhost:3000")) cuerpos.push(await r.text());
      } catch {
        /* sin cuerpo */
      }
    });
    for (const ruta of ["/cuenta", "/cuenta/solicitar"]) {
      await page.goto(ruta);
      await page.waitForLoadState("networkidle");
    }
    const otro = USUARIOS.conSolicitud;
    for (const c of cuerpos) {
      expect(c).not.toContain(otro.nombre);
      expect(c).not.toContain(otro.cedula);
      expect(c).not.toContain(otro.correo);
      expect(c).not.toContain("3001234567");
      expect(c).not.toContain(USUARIOS.sinSolicitudes.correo);
    }
    await ctx.close();
  });
});

// ---------------------------------------------------------------------------
// I6 · Inventario de marcadores «[…]» visibles (datos pendientes de la cooperativa)
// ---------------------------------------------------------------------------

test.describe("I6 · Marcadores pendientes visibles", () => {
  test("Inventario de textos entre corchetes en cada pantalla (informativo)", async ({ browser }, testInfo) => {
    const inventario: Record<string, string[]> = {};
    const tomar = async (page: Page, ruta: string) => {
      const texto = await page.locator("body").innerText();
      const hallados = Array.from(new Set(texto.match(/\[[^\]\n]{1,80}\]/g) ?? []));
      if (hallados.length) inventario[ruta] = hallados;
    };
    const publica = await browser.newContext(opcionesContexto(testInfo));
    const p = await publica.newPage();
    for (const ruta of ["/", "/ingresar", "/afiliacion", "/politica-de-datos"]) {
      await p.goto(ruta);
      await tomar(p, ruta);
    }
    await pedirCodigo(p, CEDULA_NO_REGISTRADA);
    await tomar(p, "/ingresar/codigo");
    await p.goto("/afiliacion");
    await llenarAfiliacion(p, datosValidos());
    await p.locator("#af-sitio").evaluate((el: HTMLInputElement) => (el.value = "spam"));
    await p.getByRole("button", { name: "Enviar solicitud" }).click();
    await p.waitForURL("**/afiliacion/enviada");
    await tomar(p, "/afiliacion/enviada");
    await publica.close();
    const { ctx, page } = await sesionSinSolicitudes(browser, testInfo);
    for (const ruta of ["/cuenta", "/cuenta/solicitar"]) {
      await page.goto(ruta);
      await tomar(page, ruta);
    }
    await ctx.close();
    fs.mkdirSync(CARPETA_QA, { recursive: true });
    fs.writeFileSync(path.join(CARPETA_QA, `i-marcadores-${testInfo.project.name}.json`), JSON.stringify(inventario, null, 2));
    test.info().annotations.push({ type: "marcadores", description: JSON.stringify(inventario) });
    // Nunca deben verse los marcadores de datos DEL USUARIO en sus páginas. En la landing,
    // «[Nombre], [grado] · asociado desde [año]» es un testimonio pendiente de la cooperativa
    // (se reporta como bloqueo de contenido, no como falla de esta prueba).
    const privadas = [...(inventario["/cuenta"] ?? []), ...(inventario["/cuenta/solicitar"] ?? [])].join(" ");
    expect(privadas).not.toContain("[Nombre]");
    expect(privadas).not.toContain("[TOPE]");
  });
});
