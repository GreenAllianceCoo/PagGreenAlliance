/**
 * Fase 2 · ingreso por rol y flujos principales de /admin y /asesor (local).
 * Admin de prueba 1234567899, asesor 1234567892 y asociado 1234567891 (seed.sql).
 */
import { expect, test, type Page } from "@playwright/test";
import { esperarCodigo, esperarVentanaReenvio, limpiarLimites, llenarOtp, pedirCodigo } from "./utils";

async function ingresar(page: Page, cedula: string, correo: string, destino: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "solo escritorio");

test("admin entra a /admin y aprueba la afiliación de ejemplo", async ({ page }) => {
  await ingresar(page, "1234567899", "admin.prueba@greenalliance.test", "/admin");
  await page.goto("/admin/afiliaciones");
  await expect(page.getByText("Camilo").first()).toBeVisible();
  await page.getByText("Camilo").first().click();
  await page.waitForURL("**/admin/afiliaciones/**");
  await page.getByRole("button", { name: /Aprobar/ }).click();
  await expect(page.getByText(/aprobad/i).first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/admin/creditos");
  await expect(page.getByText("Asociado de Prueba").first()).toBeVisible();
  for (const ruta of ["/admin/asesores", "/admin/sorteo"]) {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(200);
  }
  // Cuenta de demostración del admin: misma «cuenta fantasma» del asesor, con su encabezado.
  await page.getByRole("link", { name: "Demostración" }).click();
  await page.waitForURL("**/admin/demo");
  await expect(page.getByText(/Modo demostración/i).first()).toBeVisible();
  await page.getByLabel("Grado del cliente").selectOption("OF");
  await expect(page.getByText(/Tope disponible para el grado OF/)).toBeVisible();
  await page.getByRole("link", { name: "Volver al panel" }).first().click();
  await page.waitForURL(/\/admin(\/afiliaciones)?$/);
});

test("asesor no entra a /admin/demo", async ({ page }) => {
  await ingresar(page, "1234567892", "asesor.prueba@greenalliance.test", "/asesor");
  await page.goto("/admin/demo");
  expect(page.url()).not.toContain("/admin");
});

test("asesor entra a /asesor, ve a su cliente y la demo no guarda", async ({ page }) => {
  await ingresar(page, "1234567892", "asesor.prueba@greenalliance.test", "/asesor");
  await expect(page.getByText("1234567890").first()).toBeVisible();
  await expect(page.getByText("3001234567")).toHaveCount(0);
  await page.goto("/asesor/demo");
  await expect(page.getByText(/Modo demostración/i).first()).toBeVisible();
});

test("asociado entra a /cuenta y ve el botón del sorteo", async ({ page }) => {
  await ingresar(page, "1234567891", "sin.solicitudes@greenalliance.test", "/cuenta");
  await expect(page.getByRole("button", { name: /Sorteo del mes|Próximo sorteo/ }).first()).toBeVisible();
  const r = await page.goto("/admin");
  expect(page.url()).not.toContain("/admin");
  expect(r?.status()).toBe(200);
});

test("afiliación nueva: acepta cualquier correo y guarda con las 3 fotos", async ({ page }) => {
  await limpiarLimites();
  // PNG 1×1 válido.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  const foto = (nombre: string) => ({ name: nombre, mimeType: "image/png", buffer: png });
  const cedula = String(Date.now()).slice(-10);
  await page.goto("/afiliacion");
  await page.getByLabel("Nombres").fill("Laura");
  await page.getByLabel("Apellidos").fill("Gómez Peña");
  await page.getByLabel("Número de cédula").fill(cedula);
  await page.getByLabel("Grado").selectOption({ index: 1 });
  await page.getByLabel("Institución").selectOption("policia");
  await page.getByLabel("Celular").fill("3001112233");
  await page.getByLabel("Número Nequi").fill("3001112233");
  await page.getByLabel("Correo electrónico").fill("laura.gomez@gmail.com");
  await page.getByLabel("Asesor").selectOption({ index: 1 });
  await page.locator('input[name="foto_cedula_frente"]').setInputFiles(foto("frente.png"));
  await page.locator('input[name="foto_cedula_reverso"]').setInputFiles(foto("reverso.png"));
  await page.locator('input[name="foto_selfie"]').setInputFiles(foto("selfie.png"));
  await page.locator('input[name="acepto_datos"]').check();
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await page.waitForURL("**/afiliacion/enviada", { timeout: 30_000 });
});
