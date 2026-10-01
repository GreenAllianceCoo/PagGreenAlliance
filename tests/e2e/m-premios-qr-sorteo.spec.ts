/**
 * Premios de asesores (50/100 asociados, clic registrado), carné con QR en
 * pantalla propia (/cuenta/carne), verificación pública (/verificar/<token>)
 * e inscritos al sorteo en el panel del admin. Solo Supabase local.
 *
 * Migraciones: 20261002100000_premios_asesores, 20261002200000_carne_qr,
 * 20261002300000_sorteo_inscritos_admin.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  contextoConSesion,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  pedirCodigo,
  SUPABASE_URL,
  ANON_KEY,
  tokenDeUsuario,
  USUARIOS,
} from "./utils";

test.describe.configure({ mode: "serial" });

const ASESOR = { cedula: "1234567892", correo: "asesor.prueba@greenalliance.test" };
const ADMIN = { cedula: "1234567899", correo: "admin.prueba@greenalliance.test" };
/** seed.sql: asociada sin solicitudes (1234567891). */
const ID_ASOCIADA = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";

async function ingresar(page: Page, cedula: string, correo: string, destino: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

async function rpc(nombre: string, token: string | null, cuerpo: object = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token ?? ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  return { status: r.status, cuerpo: json };
}

async function idPorCedula(cedula: string) {
  const { cuerpo } = await adminRest(`perfiles?select=id,nombre_completo&cedula=eq.${cedula}`);
  return (cuerpo as { id: string; nombre_completo: string }[])[0];
}

async function clicsDe(asesorId: string) {
  const { cuerpo } = await adminRest(
    `premios_asesores_clics?select=meta,created_at&asesor_id=eq.${asesorId}&order=created_at.desc`,
  );
  return Array.isArray(cuerpo) ? (cuerpo as { meta: number | null }[]) : [];
}

// ---------------------------------------------------------------------------
// M1 · Premios del asesor (escritorio: escribe clics)
// ---------------------------------------------------------------------------
test.describe("M1 · Premios del asesor", () => {
  test.skip(({ isMobile }) => isMobile, "escribe datos: solo escritorio");

  test("asesor ve Premios con su progreso; abrir y tocar queda registrado; admin lo ve", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const asesor = await idPorCedula(ASESOR.cedula);
    expect(asesor, "asesor del seed").toBeTruthy();
    await adminRest(`premios_asesores_clics?asesor_id=eq.${asesor.id}`, { method: "DELETE" });

    await ingresar(page, ASESOR.cedula, ASESOR.correo, "/asesor");
    const seccion = page.locator("section", { has: page.getByRole("heading", { name: "Premios", exact: true }) });
    await expect(seccion).toBeVisible();
    await expect(seccion).toContainText(/Llevas \d+ asociados?/);
    await expect(seccion).toContainText("Bono comercial al mérito");
    await expect(seccion).toContainText("$1.000.000 al alcanzar 50 asociados");
    await expect(seccion).toContainText("Bono comercial al compromiso");
    await expect(seccion).toContainText("San Andrés");
    await expect(seccion).toContainText("Hacia 50 asociados");
    await expect(seccion).toContainText("Hacia 100 asociados");
    await expect(seccion).toContainText("lo gana el primer asesor");
    await expect(seccion.getByText(/Disponible|Ya fue ganado|¡Lo ganaste!/).first()).toBeVisible();
    await seccion.screenshot({ path: "test-results/qa/asesor-premios.png" });

    // Abrir la sección registra un clic (meta null).
    await expect.poll(async () => (await clicsDe(asesor.id)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    expect((await clicsDe(asesor.id))[0].meta).toBeNull();

    // Tocar el premio de 50 (se borra el registro previo para saltar el tope de 1/min).
    await adminRest(`premios_asesores_clics?asesor_id=eq.${asesor.id}`, { method: "DELETE" });
    await seccion.getByRole("button", { name: /Bono comercial al mérito/ }).click();
    await expect.poll(async () => (await clicsDe(asesor.id))[0]?.meta ?? "nada", { timeout: 15_000 }).toBe(50);

    // El tope de 1/min es por meta: el toque en 100 sí suma; repetir el de 50 dentro del minuto no.
    await seccion.getByRole("button", { name: /Bono comercial al compromiso/ }).click();
    await expect.poll(async () => (await clicsDe(asesor.id)).length, { timeout: 15_000 }).toBe(2);
    await seccion.getByRole("button", { name: /Bono comercial al mérito/ }).click();
    await page.waitForTimeout(2_000);
    expect(await clicsDe(asesor.id)).toHaveLength(2);

    // Un asociado no puede registrar clics ni leer premios.
    const tokAsociado = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
    const r = await rpc("registrar_clic_premios", tokAsociado, { p_meta: 50 });
    expect(r.cuerpo).toBe(false);
    const adm = await rpc("admin_premios_asesores", tokAsociado);
    expect(adm.cuerpo).toEqual([]);

    // Admin: /admin/asesores muestra los toques del asesor y el estado de los premios.
    const ctx = await browser.newContext();
    const adminPage = await ctx.newPage();
    await ingresar(adminPage, ADMIN.cedula, ADMIN.correo, "/admin");
    await adminPage.goto("/admin/asesores");
    await expect(adminPage.getByText(/Bono de 50 asociados \(\$1\.000\.000\):/)).toBeVisible();
    await expect(adminPage.getByText(/Viaje por 100:/)).toBeVisible();
    const fila = adminPage.locator("li", { hasText: asesor.nombre_completo }).first();
    await expect(fila).toContainText(/Premios: \d+ asociados operando · 2 toques en la sección · último: (?!nunca).*toques en 50: 1, en 100: 1/);
    await adminPage.screenshot({ path: "test-results/qa/admin-asesores-premios.png", fullPage: true });
    await ctx.close();
  });
});

// ---------------------------------------------------------------------------
// M2 · Carné con QR y verificación pública (ambos proyectos)
// ---------------------------------------------------------------------------
test.describe("M2 · Carné con QR", () => {
  test("/cuenta enlaza a /cuenta/carne, que muestra el QR; /verificar sin cédula; regenerar invalida", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(240_000);
    const u = USUARIOS.sinSolicitudes;
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    const enlace = page.getByRole("link", { name: "Ver carné con QR" });
    await expect(enlace).toBeVisible();
    await enlace.click();
    await page.waitForURL("**/cuenta/carne");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu carné con QR");
    const qr = page.getByRole("img", { name: /Código QR que lleva a la verificación/ });
    await expect(qr).toBeVisible();
    await expect(qr.locator("svg")).toHaveCount(1);
    await expect(page.getByLabel("Carné de asociado")).toContainText(u.nombre);
    // La pantalla del QR no repite el enlace a sí misma.
    await expect(page.getByRole("link", { name: "Ver carné con QR" })).toHaveCount(0);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde, "scroll horizontal").toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/qa/cuenta-carne-${testInfo.project.name}.png`, fullPage: true });

    // «Volver a mi cuenta».
    await page.getByRole("link", { name: /Volver a mi cuenta/ }).click();
    await page.waitForURL("**/cuenta");

    // Token propio (el mismo que pinta el QR).
    const tok = await tokenDeUsuario(u.correo);
    const { cuerpo: token } = await rpc("mi_carne_token", tok);
    expect(typeof token).toBe("string");

    // Verificación pública sin sesión.
    const anon = await browser.newContext({ viewport: testInfo.project.use.viewport });
    const pub = await anon.newPage();
    await pub.goto(`/verificar/${token}`);
    await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Afiliado verificado");
    await expect(pub.getByText(u.nombre)).toBeVisible();
    await expect(pub.getByText("Grado", { exact: true })).toBeVisible();
    await expect(pub.getByText(/Asociado (activo|inactivo)/)).toBeVisible();
    const html = await pub.content();
    expect(html).not.toContain(u.cedula);
    expect(html).not.toContain(u.correo);
    await pub.screenshot({ path: `test-results/qa/verificar-ok-${testInfo.project.name}.png`, fullPage: true });

    // Token inválido (formato) y uuid inexistente → misma pantalla.
    for (const malo of ["no-es-token", "00000000-0000-4000-8000-000000000000"]) {
      const r = await pub.goto(`/verificar/${malo}`);
      expect(r?.status()).toBeLessThan(500);
      await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Carné no válido");
      await expect(pub.getByText(/no pudimos verificar/i)).toBeVisible();
    }

    // anon no lee carne_tokens directo.
    const lectura = await fetch(`${SUPABASE_URL}/rest/v1/carne_tokens?select=token`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    const filas = lectura.ok ? ((await lectura.json()) as unknown[]) : [];
    expect(filas).toHaveLength(0);

    // Regenerar → el token viejo queda «no válido».
    if (testInfo.project.name === "escritorio") {
      await page.goto("/cuenta/carne");
      await page.getByRole("button", { name: "Regenerar código" }).click();
      await expect(page.getByText("Listo: el código anterior ya no sirve.")).toBeVisible();
      await pub.goto(`/verificar/${token}`);
      await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Carné no válido");
      const { cuerpo: nuevo } = await rpc("mi_carne_token", tok);
      expect(nuevo).not.toBe(token);
      await pub.goto(`/verificar/${nuevo}`);
      await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Afiliado verificado");
    }
    await anon.close();
    await ctx.close();
  });

  test("«Descargar PDF» entrega el carné en PDF; sin sesión no", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta/carne");
    const enlace = page.getByRole("link", { name: "Descargar PDF" });
    await expect(enlace).toBeVisible();
    const r = await ctx.request.get("/cuenta/carne/pdf");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("application/pdf");
    expect(r.headers()["content-disposition"]).toContain('attachment; filename="carne-green-alliance.pdf"');
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect((await r.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    await ctx.close();

    const anon = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    const sin = await anon.request.get("/cuenta/carne/pdf", { maxRedirects: 0 });
    expect(sin.headers()["content-type"] ?? "").not.toContain("application/pdf");
    expect(sin.status()).not.toBe(200);
    await anon.close();
  });

  test("/cuenta/carne sin sesión → /ingresar", async ({ page }) => {
    await page.goto("/cuenta/carne");
    await page.waitForURL("**/ingresar");
  });
});

// ---------------------------------------------------------------------------
// M3 · Inscritos al sorteo en el panel del admin (escritorio)
// ---------------------------------------------------------------------------
test.describe("M3 · Inscritos al sorteo", () => {
  test.skip(({ isMobile }) => isMobile, "escribe datos: solo escritorio");

  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  let creada = false;

  test.afterAll(async () => {
    if (creada) {
      await adminRest(`boletas_sorteo?asociado_id=eq.${ID_ASOCIADA}&anio=eq.${anio}&mes=eq.${mes}`, {
        method: "DELETE",
      });
    }
  });

  test("admin ve inscritos del mes (nombre, cédula enmascarada, sin número de boleta) y el KPI", async ({ page }) => {
    test.setTimeout(240_000);
    const u = USUARIOS.sinSolicitudes;
    const numero = String(100000 + Math.floor(Math.random() * 899999));
    const existente = await adminRest(
      `boletas_sorteo?select=id&asociado_id=eq.${ID_ASOCIADA}&anio=eq.${anio}&mes=eq.${mes}`,
    );
    if ((existente.cuerpo as unknown[]).length === 0) {
      const r = await adminRest("boletas_sorteo", {
        method: "POST",
        body: JSON.stringify({ asociado_id: ID_ASOCIADA, anio, mes, numero }),
      });
      expect(r.status, JSON.stringify(r.cuerpo)).toBeLessThan(300);
      creada = true;
    }
    const { cuerpo: boleta } = await adminRest(
      `boletas_sorteo?select=numero&asociado_id=eq.${ID_ASOCIADA}&anio=eq.${anio}&mes=eq.${mes}`,
    );
    const numeroReal = (boleta as { numero: string }[])[0].numero;

    // No admin → 0 filas.
    const tokAsociado = await tokenDeUsuario(u.correo);
    const r = await rpc("admin_inscritos_sorteo", tokAsociado, { p_anio: anio, p_mes: mes });
    expect(r.cuerpo).toEqual([]);
    const ra = await rpc("admin_inscritos_sorteo", null, { p_anio: anio, p_mes: mes });
    expect(ra.status).toBeGreaterThanOrEqual(400);

    await ingresar(page, ADMIN.cedula, ADMIN.correo, "/admin");
    // KPI en el resumen.
    await expect(page.getByText("Inscritos al sorteo del mes")).toBeVisible();

    await page.goto(`/admin/sorteo?anio=${anio}&mes=${mes}`);
    const seccion = page.locator("section", { has: page.locator("#inscritos-sorteo") });
    await expect(seccion.locator("#inscritos-sorteo")).toContainText(/Inscritos del mes · [1-9]\d*/);
    const fila = seccion.locator("li", { hasText: u.nombre });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(`•••••••${u.cedula.slice(-3)}`);
    await expect(fila).toContainText(/sin confirmar|confirmada/);
    const texto = await seccion.innerText();
    expect(texto).not.toContain(u.cedula);
    expect(texto).not.toContain(numeroReal);
    await page.screenshot({ path: "test-results/qa/admin-sorteo-inscritos.png", fullPage: true });
  });
});
