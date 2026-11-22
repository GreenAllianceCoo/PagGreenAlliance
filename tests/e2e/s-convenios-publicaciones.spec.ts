/**
 * Convenios (docs/spec-convenios.md §B6), de punta a punta en LOCAL:
 * el admin crea el convenio con su correo de acceso → la empresa entra con el
 * NIT y publica una promoción → el asociado la ve en Beneficios → el admin la
 * oculta → la empresa la ve «Oculta por Green Alliance» y el asociado ya no.
 *
 * Usa el admin (1234567899) y el asociado 2 (1234567891) de seed.sql y Mailpit
 * para los códigos. Limpia lo que crea al terminar.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  ENV_LOCAL,
  esperarCodigo,
  esperarVentanaReenvio,
  fotoDePrueba,
  ingresarPorUI,
  limpiarLimites,
  llenarOtp,
  pedirCodigo,
  SUPABASE_URL,
} from "./utils";

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "solo escritorio (la vista de 390 px se revisa aparte)");

const sello = Date.now().toString().slice(-8);
const NIT = `9${sello}`; // 9 dígitos, sin DV
const CORREO = `convenio.e2e.${sello}@greenalliance.test`;
const EMPRESA = `Convenio E2E ${sello}`;
const TITULO = `2x1 en pruebas ${sello}`;
const MOTIVO = "La imagen no corresponde";

async function ingresarAdmin(page: Page) {
  await limpiarLimites();
  await esperarVentanaReenvio("admin.prueba@greenalliance.test");
  const inicio = await pedirCodigo(page, "1234567899");
  await llenarOtp(page, await esperarCodigo("admin.prueba@greenalliance.test", inicio));
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL("**/admin");
}

async function ingresarConvenio(page: Page) {
  await limpiarLimites();
  await esperarVentanaReenvio(CORREO);
  await page.goto("/ingresar/convenio");
  await page.getByLabel("NIT de la empresa").fill(`${NIT.slice(0, 3)}.${NIT.slice(3, 6)}.${NIT.slice(6)}-1`);
  const inicio = Date.now();
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await page.waitForURL("**/ingresar/codigo");
  await llenarOtp(page, await esperarCodigo(CORREO, inicio));
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL("**/convenio");
}

test.afterAll(async () => {
  const { cuerpo } = await adminRest(`convenios?select=id&nit_base=eq.${NIT}`);
  const id = (Array.isArray(cuerpo) ? cuerpo : [])[0] as { id: string } | undefined;
  if (!id) return;
  const { cuerpo: cuentas } = await adminRest(`convenio_cuentas?select=usuario_id&convenio_id=eq.${id.id}`);
  // Los eventos se borran en cascada con la publicación.
  await adminRest(`convenio_publicaciones?convenio_id=eq.${id.id}`, { method: "DELETE" });
  await adminRest(`convenio_cuentas?convenio_id=eq.${id.id}`, { method: "DELETE" });
  await adminRest(`convenios?id=eq.${id.id}`, { method: "DELETE" });
  const llave = ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY ?? "";
  for (const c of (Array.isArray(cuentas) ? cuentas : []) as { usuario_id: string }[]) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${c.usuario_id}`, {
      method: "DELETE",
      headers: { apikey: llave, Authorization: `Bearer ${llave}` },
    });
  }
});

test("admin crea el convenio con correo de acceso", async ({ page }) => {
  await ingresarAdmin(page);
  await page.goto("/admin/convenios");
  await page.getByRole("button", { name: "Nuevo convenio" }).click();
  await page.getByLabel("Nombre de la empresa").fill(EMPRESA);
  await page.getByLabel("Especialidad").fill("Pruebas");
  await page.getByLabel("NIT").fill(NIT);
  await page.getByLabel("Correo de acceso").fill(CORREO);
  await page.getByLabel("WhatsApp del convenio").fill("3001234567");
  await page.getByLabel("Sedes").fill("Calle 1 # 2-3, Tunja, Boyacá");
  await page.getByRole("button", { name: "Crear convenio" }).click();
  await expect(page.getByText(EMPRESA).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`Acceso: Activo · ${CORREO}`)).toBeVisible();
});

test("la empresa entra con su NIT y publica una promoción", async ({ page }) => {
  await ingresarConvenio(page);
  await expect(page.getByRole("heading", { name: "Tus publicaciones" })).toBeVisible();
  await page.getByRole("link", { name: /Nueva promoción/ }).click();
  await page.waitForURL("**/convenio/nueva?tipo=promocion");
  await page.getByLabel("Título").fill(TITULO);
  await page.getByLabel("Beneficio (opcional)").fill("2x1");
  await page.getByLabel("Descripción").fill("Promoción de prueba de punta a punta.");
  const hasta = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Hasta").fill(hasta);
  await page.locator('input[type="file"][accept^="image/"]').setInputFiles(fotoDePrueba("promo.png"));
  const publicar = page.getByRole("button", { name: "Publicar" });
  await expect(publicar).toBeEnabled({ timeout: 20_000 });
  await publicar.click();
  await page.waitForURL("**/convenio?listo=publicada");
  await expect(page.getByText(TITULO)).toBeVisible();
  await expect(page.getByText("1 de 10")).toBeVisible();
});

test("el asociado la ve en Beneficios y abre el detalle", async ({ page }) => {
  await ingresarPorUI(page, "sinSolicitudes");
  await page.goto("/cuenta/beneficios");
  const tarjeta = page.getByTestId("beneficios").getByRole("link", { name: new RegExp(TITULO) });
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.getByText("Nuevo")).toBeVisible();
  // Filtro por ciudad sacada de la sede («Tunja»).
  await page.getByLabel("Ciudad").selectOption("Tunja");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(tarjeta).toBeVisible();
  await tarjeta.click();
  await page.waitForURL("**/cuenta/beneficios/**");
  await expect(page.getByRole("heading", { name: TITULO })).toBeVisible();
  const whatsapp = page.getByRole("link", { name: "Escribir por WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/573001234567\?text=/);
});

test("el admin la oculta con motivo y queda en el historial", async ({ page }) => {
  await ingresarAdmin(page);
  await page.goto("/admin/convenios/publicaciones?estado=publicada");
  const fila = page.getByTestId("publicaciones-admin").getByRole("listitem").filter({ hasText: TITULO });
  await fila.getByRole("button", { name: "Ocultar" }).click();
  await fila.getByLabel(/Motivo/).fill(MOTIVO);
  await fila.getByRole("button", { name: "Sí, ocultar" }).click();
  await expect(page.getByText(`«${TITULO}» quedó oculta.`)).toBeVisible({ timeout: 15_000 });
  await page.goto("/admin/convenios/publicaciones?estado=oculta");
  await expect(page.getByText(`Motivo: ${MOTIVO}`)).toBeVisible();
  await page.goto("/admin/historial");
  await expect(page.getByText(`Ocultó «${TITULO}» de ${EMPRESA}`)).toBeVisible();
});

test("la empresa la ve oculta y el asociado ya no", async ({ page, browser }) => {
  await ingresarConvenio(page);
  await expect(page.getByText("Oculta por Green Alliance")).toBeVisible();
  await expect(page.getByText(`Motivo: ${MOTIVO}`)).toBeVisible();

  const contexto = await browser.newContext();
  const asociado = await contexto.newPage();
  await ingresarPorUI(asociado, "sinSolicitudes");
  await asociado.goto("/cuenta/beneficios");
  await expect(asociado.getByText(TITULO)).toHaveCount(0);
  await contexto.close();
});
