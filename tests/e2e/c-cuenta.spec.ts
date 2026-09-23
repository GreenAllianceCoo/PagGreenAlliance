import { expect, test } from "@playwright/test";
import { contextoConSesion, esEscritorio, tokenDeUsuario, USUARIOS, usuarioRest } from "./utils";

/** C. /cuenta: protección, datos propios, «Mis datos» y «Salir». */

test.describe("C1 · Sin sesión", () => {
  for (const ruta of ["/cuenta", "/dashboard/solicitar"]) {
    test(`${ruta} sin sesión → /ingresar`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/ingresar$/);
      await expect(page.locator("h1")).toHaveText("Hola de nuevo");
    });
  }
});

test.describe("C2 · Con sesión: datos del propio usuario", () => {
  test("Asociado con solicitud: nombre, estado, monto, modalidad, tasa y tope de su grado", async ({ browser }, testInfo) => {
    const u = USUARIOS.conSolicitud;
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await expect(page.locator("h1")).toContainText(`Hola, ${u.nombre}`.replace("Hola, ", ""));
    const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(texto).toContain("Tu solicitud");
    expect(texto).toContain("En revisión");
    expect(texto).toContain("$ 500.000");
    expect(texto).toContain("50%");
    // Decisión 23-sep: se muestra la tasa de interés mensual; la cuota NO se calcula.
    expect(texto).toMatch(/Interés mensual: 7,9\s?%/);
    expect(texto.toLowerCase()).not.toContain("cuota");
    // Tope PP = 2.100.000 (máximo entre 50 % y 100 %).
    expect(texto).toContain("Tope disponible para tu grado");
    expect(texto).toContain("$ 2.100.000");
    // Mis datos (solo lectura + celular editable).
    expect(texto).toContain("Mis datos");
    expect(texto).toContain(u.cedula);
    expect(texto).toContain(u.grado);
    // No hay datos de la otra asociada.
    expect(texto).not.toContain(USUARIOS.sinSolicitudes.nombre);
    expect(texto).not.toContain(USUARIOS.sinSolicitudes.cedula);
    await ctx.close();
  });

  test("Asociada sin solicitudes: estado vacío, no ve la solicitud de otro", async ({ browser }, testInfo) => {
    const u = USUARIOS.sinSolicitudes;
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await expect(page.locator("h1")).toContainText(u.nombre);
    const texto = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(texto).toContain("Todavía no tienes solicitudes de crédito");
    expect(texto).not.toContain("$ 500.000");
    expect(texto).not.toContain(USUARIOS.conSolicitud.nombre);
    // Tope SI = 3.000.000.
    expect(texto).toContain("$ 3.000.000");
    // «Nueva solicitud» del estado vacío → /dashboard/solicitar.
    await page.locator("main section").first().getByRole("link", { name: "Nueva solicitud" }).click();
    await expect(page).toHaveURL(/\/dashboard\/solicitar$/);
    await ctx.close();
  });

  test("RLS: con el token de un asociado no se leen solicitudes ni perfiles de otro", async () => {
    const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
    const solicitudes = await usuarioRest("solicitudes_credito?select=id,asociado_id", token);
    expect(solicitudes.status).toBe(200);
    expect(solicitudes.cuerpo).toEqual([]);
    const perfiles = await usuarioRest("perfiles?select=cedula", token);
    expect(perfiles.cuerpo).toEqual([{ cedula: USUARIOS.sinSolicitudes.cedula }]);
  });
});

test.describe("C · «Mis datos»", () => {
  test("Nombre, cédula y grado de solo lectura; el celular se valida y se guarda", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    const seccion = page.locator('section[aria-labelledby="mis-datos-titulo"]');
    // Solo hay un campo editable: el celular.
    await expect(seccion.locator("input, select, textarea")).toHaveCount(1);
    await expect(seccion.getByLabel("Celular")).toBeEditable();

    // Inválido: no empieza por 3.
    await seccion.getByLabel("Celular").fill("2001234567");
    await seccion.getByRole("button", { name: "Guardar" }).click();
    await expect(seccion.locator("#telefono-error")).toBeVisible();
    await expect(seccion.getByLabel("Celular")).toBeFocused();

    // Válido: se guarda y persiste al recargar.
    const nuevo = testInfo.project.name === "escritorio" ? "3157654321" : "3169876543";
    await seccion.getByLabel("Celular").fill(nuevo);
    await seccion.getByRole("button", { name: "Guardar" }).click();
    await expect(seccion.getByRole("status")).toHaveText("Guardamos tu celular.");
    await page.reload();
    await expect(page.locator("#telefono")).toHaveValue(nuevo);
    await ctx.close();
  });

  test("La base no deja cambiar el nombre (API con token del asociado)", async () => {
    const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
    const r = await usuarioRest(
      `perfiles?id=eq.7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c`,
      token,
      { method: "PATCH", body: JSON.stringify({ nombre_completo: "Hackeado" }) },
    );
    const perfil = await usuarioRest("perfiles?select=nombre_completo", token);
    expect(perfil.cuerpo).toEqual([{ nombre_completo: USUARIOS.sinSolicitudes.nombre }]);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("C3 · «Salir»", () => {
  test("Cierra sesión → /ingresar; volver atrás no muestra datos de la cuenta", async ({ browser }, testInfo) => {
    const u = USUARIOS.sinSolicitudes;
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await expect(page.locator("h1")).toContainText(u.nombre);

    if (esEscritorio(testInfo)) {
      await page.getByRole("button", { name: "Salir" }).click();
    } else {
      await page.getByRole("button", { name: "Cerrar sesión" }).click();
    }
    await expect(page).toHaveURL(/\/ingresar$/);
    await expect(page.locator("h1")).toHaveText("Hola de nuevo");

    await page.goBack();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    const texto = await page.locator("body").innerText();
    expect(texto, `URL tras volver: ${page.url()}`).not.toContain(u.nombre);
    expect(texto).not.toContain(u.cedula);

    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/ingresar$/);
    // Las cookies de sesión de Supabase ya no están.
    const cookies = await ctx.cookies();
    expect(cookies.filter((c) => c.name.startsWith("sb-") && c.value)).toEqual([]);
    await ctx.close();
  });
});
