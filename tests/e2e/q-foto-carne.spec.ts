/**
 * Foto del asociado en el carné (migración 20261003200000): por defecto la selfie de la
 * afiliación; el asociado la cambia desde /cuenta/carne; se ve en /cuenta, /cuenta/carne, el PDF,
 * /verificar/<token> (solo carné válido y asociado activo) y la ficha del admin.
 * Solo Supabase local.
 */
import { expect, test, type Page } from "@playwright/test";
import zlib from "node:zlib";
import {
  adminRest,
  ANON_KEY,
  contextoConSesion,
  ENV_LOCAL,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  pedirCodigo,
  SUPABASE_URL,
  tokenDeUsuario,
  USUARIOS,
} from "./utils";

test.describe.configure({ mode: "serial" });

const U = USUARIOS.sinSolicitudes;
/** seed.sql: asociada sin solicitudes (1234567891). */
const ID_ASOCIADA = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";
const ADMIN = { cedula: "1234567899", correo: "admin.prueba@greenalliance.test" };
const RUTA_SELFIE = "solicitudes/q-foto-carne/selfie.png";
const SERVICE_KEY = ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** PNG real de ancho x alto (rojo) generado en memoria. */
function pngReal(ancho: number, alto: number): Buffer {
  const tabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = tabla[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, datos: Buffer) => {
    const t = Buffer.concat([Buffer.from(tipo), datos]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array(ancho).fill([200, 40, 40]).flat())]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(alto).fill(fila)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function storage(ruta: string, init: RequestInit & { json?: boolean } = {}) {
  return fetch(`${SUPABASE_URL}/storage/v1/${ruta}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...(init.headers ?? {}) },
  });
}

async function archivosDeFotoCarne(): Promise<string[]> {
  const r = await storage("object/list/fotos-carne", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: ID_ASOCIADA, limit: 100 }),
  });
  const filas = (await r.json()) as { name: string }[];
  return filas.map((f) => f.name);
}

async function limpiarTodo() {
  await adminRest(`fotos_carne?asociado_id=eq.${ID_ASOCIADA}`, { method: "DELETE" });
  await adminRest(`historial_foto_carne?asociado_id=eq.${ID_ASOCIADA}`, { method: "DELETE" });
  const nombres = await archivosDeFotoCarne();
  if (nombres.length) {
    await storage("object/fotos-carne", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: nombres.map((n) => `${ID_ASOCIADA}/${n}`) }),
    });
  }
  await adminRest(`solicitudes_afiliacion?cedula=eq.${U.cedula}`, { method: "DELETE" });
  await storage(`object/afiliacion-documentos/${RUTA_SELFIE}`, { method: "DELETE" });
  await adminRest(`perfiles?id=eq.${ID_ASOCIADA}`, { method: "PATCH", body: JSON.stringify({ activo: true }) });
}

async function sembrarSelfie() {
  const subida = await storage(`object/afiliacion-documentos/${RUTA_SELFIE}`, {
    method: "POST",
    headers: { "Content-Type": "image/png", "x-upsert": "true" },
    body: new Uint8Array(pngReal(40, 40)),
  });
  expect(subida.ok, "subir la selfie de prueba").toBe(true);
  const r = await adminRest("solicitudes_afiliacion", {
    method: "POST",
    body: JSON.stringify({
      nombres: "Asociada",
      apellidos: "Sin Solicitudes",
      cedula: U.cedula,
      grado: "SI",
      institucion: "policia",
      celular: "3002000091",
      nequi: "3002000091",
      email: "sin.solicitudes.afiliacion@gmail.com",
      foto_cedula_frente: "solicitudes/q-foto-carne/f.jpg",
      foto_cedula_reverso: "solicitudes/q-foto-carne/r.jpg",
      foto_selfie: `afiliacion-documentos/${RUTA_SELFIE}`,
      acepto_datos_at: new Date().toISOString(),
      estado: "aprobada",
    }),
  });
  expect(r.status, JSON.stringify(r.cuerpo)).toBeLessThan(300);
}

async function tokenCarne(): Promise<string> {
  const tok = await tokenDeUsuario(U.correo);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mi_carne_token`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return (await r.json()) as string;
}

async function ingresarAdmin(page: Page) {
  await limpiarLimites();
  await esperarVentanaReenvio(ADMIN.correo);
  const inicio = await pedirCodigo(page, ADMIN.cedula);
  const codigo = await esperarCodigo(ADMIN.correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL("**/admin");
}

test.describe("Foto del carné", () => {
  test.beforeAll(limpiarTodo);
  test.afterAll(limpiarTodo);

  test("sin selfie ni foto: el carné no dibuja foto y el PDF sale igual", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await expect(page.getByLabel("Carné de asociado")).toContainText(U.nombre);
    await expect(page.getByTestId("foto-carne")).toHaveCount(0);
    await page.goto("/cuenta/carne");
    await expect(page.getByText("Todavía no hay una foto en tu carné.")).toBeVisible();
    await expect(page.getByText("Usa una foto reciente donde se vea bien tu cara, sin gafas oscuras ni gorra.")).toBeVisible();
    const pdf = await ctx.request.get("/cuenta/carne/pdf");
    expect(pdf.status()).toBe(200);
    process.env.Q_FOTO_PDF_SIN = String((await pdf.body()).length);
    await ctx.close();
  });

  test("por defecto usa la selfie de la afiliación (URL firmada) en /cuenta, /cuenta/carne y el PDF", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    await sembrarSelfie();
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    const foto = page.getByTestId("foto-carne");
    await expect(foto).toBeVisible();
    const src = (await foto.getAttribute("src")) ?? "";
    expect(src).toContain("/storage/v1/object/sign/afiliacion-documentos/");
    expect(src).toContain("token=");
    expect(src).not.toContain("/object/public/");
    // La imagen carga de verdad.
    await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    // Sin el token, el bucket privado no entrega nada.
    const sinToken = await fetch(src.split("?")[0]);
    expect(sinToken.status).toBeGreaterThanOrEqual(400);

    await page.goto("/cuenta/carne");
    await expect(page.getByTestId("foto-carne")).toBeVisible();
    await expect(page.getByText("Estás usando la selfie de tu afiliación.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Usar mi selfie de afiliación" })).toHaveCount(0);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde, "scroll horizontal").toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/qa/foto-carne-selfie-${testInfo.project.name}.png`, fullPage: true });

    const pdf = await ctx.request.get("/cuenta/carne/pdf");
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).length).toBeGreaterThan(Number(process.env.Q_FOTO_PDF_SIN ?? 0));
    await ctx.close();
  });

  test("cambiar la foto: valida el tipo, sube, reemplaza (borra la anterior) y deja log", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta/carne");
    const entrada = page.locator("#foto-carne-archivo");

    // Tipo no permitido.
    await entrada.setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
    await expect(page.getByRole("alert").filter({ hasText: "La foto debe ser JPG, PNG o WEBP." })).toBeVisible();
    expect(await archivosDeFotoCarne()).toHaveLength(0);

    // Foto horizontal: se recorta cuadrada y se guarda.
    await entrada.setInputFiles({ name: "yo.png", mimeType: "image/png", buffer: pngReal(120, 60) });
    await expect(page.getByText("Listo: tu foto nueva ya está en el carné.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Estás usando la foto que subiste tú.")).toBeVisible();
    const foto = page.getByTestId("foto-carne");
    await expect.poll(async () => (await foto.getAttribute("src")) ?? "").toContain("/object/sign/fotos-carne/");
    await expect.poll(() => foto.evaluate((i: HTMLImageElement) => `${i.naturalWidth}x${i.naturalHeight}`)).toBe("60x60");
    const primera = await archivosDeFotoCarne();
    expect(primera).toHaveLength(1);

    // Reemplazar: queda UN solo archivo y es otro.
    await entrada.setInputFiles({ name: "yo2.png", mimeType: "image/png", buffer: pngReal(50, 90) });
    await expect(page.getByText("Listo: tu foto nueva ya está en el carné.")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => {
        const ahora = await archivosDeFotoCarne();
        return ahora.length === 1 && ahora[0] !== primera[0];
      }, { timeout: 30_000 })
      .toBe(true);
    const filas = await adminRest(`fotos_carne?asociado_id=eq.${ID_ASOCIADA}`);
    expect(filas.cuerpo).toHaveLength(1);
    const log = await adminRest(`historial_foto_carne?asociado_id=eq.${ID_ASOCIADA}&order=id`);
    expect((log.cuerpo as { accion: string }[]).map((l) => l.accion)).toEqual(["subida", "reemplazo"]);
    await expect(page.getByRole("button", { name: "Usar mi selfie de afiliación" })).toBeVisible();
    await page.screenshot({ path: `test-results/qa/foto-carne-propia-${testInfo.project.name}.png`, fullPage: true });

    // /cuenta también la muestra.
    await page.goto("/cuenta");
    await expect.poll(async () => (await page.getByTestId("foto-carne").getAttribute("src")) ?? "").toContain("/object/sign/fotos-carne/");

    // PDF con la foto.
    const pdf = await ctx.request.get("/cuenta/carne/pdf");
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // El bucket no es público.
    const ruta = `${ID_ASOCIADA}/${(await archivosDeFotoCarne())[0]}`;
    const publico = await fetch(`${SUPABASE_URL}/storage/v1/object/public/fotos-carne/${ruta}`);
    expect(publico.status).toBeGreaterThanOrEqual(400);
    const conAnon = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos-carne/${ruta}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    expect(conAnon.status).toBeGreaterThanOrEqual(400);
    await ctx.close();
  });

  test("/verificar muestra la foto solo con carné válido y asociado activo", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const token = await tokenCarne();
    const anon = await browser.newContext({ viewport: testInfo.project.use.viewport });
    const pub = await anon.newPage();

    await pub.goto(`/verificar/${token}`);
    await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Afiliado verificado");
    const foto = pub.getByTestId("foto-verificacion");
    await expect(foto).toBeVisible();
    expect((await foto.getAttribute("src")) ?? "").toContain("/object/sign/fotos-carne/");
    await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    const html = await pub.content();
    expect(html).not.toContain(U.cedula);
    await pub.screenshot({ path: `test-results/qa/foto-verificar-${testInfo.project.name}.png`, fullPage: true });

    // Token inexistente: «Carné no válido», sin foto.
    await pub.goto("/verificar/00000000-0000-4000-8000-000000000000");
    await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Carné no válido");
    await expect(pub.getByTestId("foto-verificacion")).toHaveCount(0);

    // Asociado inactivo: el carné ya no se verifica (la RPC no devuelve nada) y no sale foto.
    await adminRest(`perfiles?id=eq.${ID_ASOCIADA}`, { method: "PATCH", body: JSON.stringify({ activo: false }) });
    try {
      await pub.goto(`/verificar/${token}`);
      await expect(pub.getByRole("heading", { level: 1 })).toHaveText("Carné no válido");
      await expect(pub.getByTestId("foto-verificacion")).toHaveCount(0);
    } finally {
      await adminRest(`perfiles?id=eq.${ID_ASOCIADA}`, { method: "PATCH", body: JSON.stringify({ activo: true }) });
    }
    await anon.close();
  });

  test("el admin ve la foto en la ficha del asociado", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "escritorio", "solo escritorio");
    test.setTimeout(180_000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ingresarAdmin(page);
    await page.goto(`/admin/asociados/${ID_ASOCIADA}`);
    const foto = page.getByTestId("foto-carne-admin");
    await expect(foto).toBeVisible();
    expect((await foto.getAttribute("src")) ?? "").toContain("/object/sign/fotos-carne/");
    await expect(page.getByText("Foto que subió el asociado.")).toBeVisible();
    await ctx.close();
  });

  test("«Usar mi selfie de afiliación» quita la foto propia y borra su archivo", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta/carne");
    await page.getByRole("button", { name: "Usar mi selfie de afiliación" }).click();
    await expect(page.getByText("Listo: el carné vuelve a usar tu selfie de la afiliación.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Estás usando la selfie de tu afiliación.")).toBeVisible();
    expect(await archivosDeFotoCarne()).toHaveLength(0);
    expect((await adminRest(`fotos_carne?asociado_id=eq.${ID_ASOCIADA}`)).cuerpo).toHaveLength(0);
    const log = await adminRest(`historial_foto_carne?asociado_id=eq.${ID_ASOCIADA}&order=id.desc&limit=1`);
    expect((log.cuerpo as { accion: string }[])[0].accion).toBe("quitada");
    await expect.poll(async () => (await page.getByTestId("foto-carne").getAttribute("src")) ?? "").toContain("/object/sign/afiliacion-documentos/");
    await ctx.close();
  });

  test("las tablas y funciones no se tocan con la API de usuario", async () => {
    const tok = await tokenDeUsuario(U.correo);
    for (const tabla of ["fotos_carne", "historial_foto_carne"]) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${tok}` },
      });
      expect(r.status, tabla).toBeGreaterThanOrEqual(400);
    }
    for (const fn of ["foto_carne_de_asociado", "foto_carne_por_token", "registrar_foto_carne", "quitar_foto_carne"]) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_asociado_id: ID_ASOCIADA, p_token: "00000000-0000-4000-8000-000000000000", p_ruta: "x" }),
      });
      expect(r.status, fn).toBeGreaterThanOrEqual(400);
    }
  });
});
