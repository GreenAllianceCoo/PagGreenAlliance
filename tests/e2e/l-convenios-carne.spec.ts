/**
 * /admin/convenios (crear con logo PNG, ocultar, mover, landing, eliminar, SVG
 * rechazado) y carné virtual en /cuenta a 320/390/1280 px. Supabase local.
 */
import { expect, test, type Page } from "@playwright/test";
import zlib from "node:zlib";
import {
  adminRest,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  pedirCodigo,
  USUARIOS,
} from "./utils";

test.describe.configure({ mode: "serial" });

const NOMBRE = "Convenio QA E2E";

/** PNG real 8x8 verde generado en memoria. */
function pngReal(): Buffer {
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTabla[(c ^ x) & 0xff] ^ (c >>> 8);
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
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array(8).fill([30, 102, 82]).flat())]);
  const crudo = Buffer.concat(Array(8).fill(fila));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(crudo)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function ingresar(page: Page, cedula: string, correo: string, destino: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

test.describe("admin convenios", () => {
  test.skip(({ isMobile }) => isMobile, "solo escritorio");
  test.afterAll(async () => {
    await adminRest(`convenios?nombre_empresa=eq.${encodeURIComponent(NOMBRE)}`, { method: "DELETE" });
  });

  test("crear con PNG, ocultar, mover, landing y eliminar; SVG rechazado", async ({ page, context }) => {
    test.setTimeout(180_000);
    await ingresar(page, "1234567899", "admin.prueba@greenalliance.test", "/admin");
    await page.goto("/admin/convenios");
    await expect(page.getByRole("heading", { level: 1, name: "Convenios" })).toBeVisible();

    // SVG rechazado (se fuerza el envío saltando el accept del input).
    await page.getByRole("button", { name: "Nuevo convenio" }).click();
    await page.getByLabel("Nombre de la empresa").fill(NOMBRE);
    await page.getByLabel("Especialidad").fill("Pruebas");
    await page.getByLabel("Descripción").fill("Convenio creado por QA.");
    await page.getByLabel("Logo").setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    });
    await page.getByRole("button", { name: "Crear convenio" }).click();
    await expect(page.getByText(/El logo debe ser PNG, JPG/)).toBeVisible();
    const { cuerpo: tras } = await adminRest(`convenios?nombre_empresa=eq.${encodeURIComponent(NOMBRE)}&select=id`);
    expect(tras as unknown[]).toHaveLength(0);

    // Crear con PNG real.
    await page.getByLabel("Logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: pngReal() });
    await page.getByRole("button", { name: "Crear convenio" }).click();
    const item = page.locator("li", { hasText: NOMBRE });
    await expect(item).toBeVisible();
    await expect(item.locator("img")).toHaveAttribute("src", /convenios-logos/);
    const src = await item.locator("img").getAttribute("src");
    const r = await page.request.get(src!);
    expect(r.ok()).toBeTruthy();

    // Landing: aparece.
    const landing = await context.newPage();
    await landing.goto("/");
    await expect(landing.getByText(NOMBRE).first()).toBeAttached();

    // Mover (subir o bajar según posición).
    const ordenAntes = await item.locator("span", { hasText: "Orden" }).innerText();
    const subir = item.getByRole("button", { name: "Subir" });
    const boton = (await subir.isEnabled()) ? subir : item.getByRole("button", { name: "Bajar" });
    await boton.click();
    await expect(item.locator("span", { hasText: "Orden" })).not.toHaveText(ordenAntes);

    // Ocultar → desaparece de la landing.
    await item.getByRole("button", { name: "Ocultar" }).click();
    await expect(item.getByText("Oculto")).toBeVisible();
    await landing.reload();
    await expect(landing.getByText(NOMBRE)).toHaveCount(0);
    await item.getByRole("button", { name: "Mostrar" }).click();
    await expect(item.getByText("Visible")).toBeVisible();
    await landing.reload();
    await expect(landing.getByText(NOMBRE).first()).toBeAttached();

    // Eliminar.
    await item.getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page.locator("li", { hasText: NOMBRE })).toHaveCount(0);
    await landing.reload();
    await expect(landing.getByText(NOMBRE)).toHaveCount(0);
    await page.screenshot({ path: "test-results/qa/admin-convenios.png", fullPage: true });
  });
});

test.describe("carné virtual", () => {
  test.skip(({ isMobile }) => isMobile, "anchos fijados a mano");
  test("se ve completo a 320, 390 y 1280 px", async ({ page }) => {
    test.setTimeout(120_000);
    const u = USUARIOS.sinSolicitudes;
    await ingresar(page, u.cedula, u.correo, "/cuenta");
    for (const ancho of [320, 390, 1280]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.reload();
      const carne = page.getByLabel("Carné de asociado");
      await expect(carne).toBeVisible();
      await expect(carne).toContainText(u.nombre);
      const caja = (await carne.boundingBox())!;
      expect(caja.x).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde, `scroll horizontal a ${ancho}px`).toBeLessThanOrEqual(0);
      await carne.screenshot({ path: `test-results/qa/carne-${ancho}.png` });
    }
  });
});
