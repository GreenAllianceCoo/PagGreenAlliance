import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { adminRest, ingresarPorUI, opcionesContexto, USUARIOS } from "./utils";

/**
 * H. Solicitud de crédito (app/cuenta/solicitar): la asociada 1234567891
 * (sin solicitudes) entra con código, va a «Nueva solicitud», elige 50 %,
 * envía el monto por defecto y vuelve a /cuenta con la solicitud pendiente y
 * la tasa. Cubre el insert(...).select("id").single() + after() de actions.ts.
 * Al terminar borra la solicitud creada (base local) para que se pueda repetir.
 */

const ID_SIN_SOLICITUDES = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";

async function borrarSolicitudesCredito() {
  await adminRest(`solicitudes_credito?asociado_id=eq.${ID_SIN_SOLICITUDES}`, { method: "DELETE" });
}

test.describe("H · Solicitud de crédito", () => {
  test.beforeEach(borrarSolicitudesCredito);
  test.afterEach(borrarSolicitudesCredito);

  test("Ingreso con código → «Nueva solicitud» → 50 % → /cuenta con la solicitud pendiente y la tasa guardada sin mostrarla", async ({
    browser,
  }, testInfo) => {
    const u = USUARIOS.sinSolicitudes;
    // Ingreso real por la interfaz (código de Mailpit), en un contexto nuevo.
    const ctx = await browser.newContext(opcionesContexto(testInfo));
    const page = await ctx.newPage();
    await ingresarPorUI(page, "sinSolicitudes");
    await expect(page.getByText("Todavía no tienes solicitudes de crédito")).toBeVisible();

    // «Nueva solicitud» del estado vacío.
    await page.locator("main section").first().getByRole("link", { name: "Nueva solicitud" }).click();
    await expect(page).toHaveURL(/\/cuenta\/solicitar$/);

    await page.getByRole("radio", { name: "50% de devolución" }).check();
    // Monto por defecto = tope del grado SI al 50 % ($1.500.000). La tasa (8,2 %) se guarda pero no se muestra (25-sep).
    await expect(page.getByText("$1.500.000").first()).toBeVisible();
    await expect(page.getByText("8,2 %")).toHaveCount(0);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();

    await page.waitForURL("**/cuenta", { timeout: 20_000 });
    await expect(page.locator("h1")).toContainText(u.nombre);
    const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(texto).not.toContain("Todavía no tienes solicitudes de crédito");
    expect(texto).toContain("En revisión");
    expect(texto).toContain("$ 1.500.000");
    expect(texto).toContain("50%");
    expect(texto).not.toContain("Interés");

    // Una sola fila pendiente en la base.
    const { cuerpo } = await adminRest(
      `solicitudes_credito?select=estado,monto_solicitado,porcentaje_devolucion&asociado_id=eq.${ID_SIN_SOLICITUDES}`,
    );
    expect(cuerpo).toEqual([{ estado: "pendiente", monto_solicitado: 1500000, porcentaje_devolucion: "50" }]);

    // Una segunda solicitud con otra pendiente se rechaza.
    // Con otra pendiente, /cuenta/solicitar ya no deja pedir otra.
    await page.goto("/cuenta/solicitar");
    await expect(page.getByText(/Ya tienes una solicitud pendiente de revisión/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar solicitud" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/cuenta\/solicitar$/);
    await ctx.close();

    // docs/resend-plantillas.md (23-sep): la solicitud de crédito NO envía correo (solo el
    // resultado, desde el flujo del administrador). Con QA_DEV_LOG se revisa que el log de
    // next dev no tenga el correo del asociado.
    const log = process.env.QA_DEV_LOG;
    if (log && fs.existsSync(log)) {
      expect(fs.readFileSync(log, "utf8")).not.toContain(u.correo);
    }
  });
});
