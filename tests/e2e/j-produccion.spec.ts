import { expect, test, type Page } from "@playwright/test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  adminRest,
  CARPETA_QA,
  CEDULA_NO_REGISTRADA,
  contextoConSesion,
  ENV_LOCAL,
  esEscritorio,
  limpiarLimites,
  pedirCodigo,
  tokenDeUsuario,
  USUARIOS,
  usuarioRest,
} from "./utils";

/**
 * J. Casos agregados en la verificación previa a producción (23-sep, commit bf09975)
 * que no cubrían A–I. Solo local.
 */

const ID_CON_SOLICITUD = "4c7808d8-085f-42ed-9e5d-f53c117b4cd1";
const ID_SIN_SOLICITUDES = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";
/** Dominios que usa lib/mascara.ts#correoDeRelleno para cédulas no registradas. */
const DOMINIOS_RELLENO = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"];

function cookieIngreso(datos: { c: string; m: string; u: number }) {
  const llave = createHash("sha256").update(ENV_LOCAL.INGRESO_COOKIE_SECRET ?? "").digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave, iv);
  const cuerpo = Buffer.concat([c.update(JSON.stringify(datos), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), cuerpo]).toString("base64url");
}

async function mascaraEnPaso2(page: Page) {
  // En escritorio el correo va en el panel verde, fuera de <main>.
  const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const m = /([a-z0-9]{1,2}•••@[a-z0-9.-]+)/i.exec(texto);
  // Sin el punto final de la frase («…@gmail.com.»).
  return (m?.[1] ?? "").replace(/[.]+$/, "");
}

// ---------------------------------------------------------------------------
// J1 · Privacidad: ¿el correo enmascarado delata que la cédula existe?
// ---------------------------------------------------------------------------

test.describe("J1 · Máscara del paso 2 y existencia de la cédula", () => {
  test("El dominio mostrado para una cédula registrada no se distingue del relleno", async ({ page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Una vez basta");
    test.setTimeout(120_000);
    await limpiarLimites();
    const noRegistradas = ["1000000001", "2233445566", "3141592653", "5550001112", "8080808080", "9876543210", "7000000007", "4455667788"];
    const vistas: Record<string, string> = {};
    for (const c of noRegistradas) {
      await pedirCodigo(page, c);
      vistas[c] = await mascaraEnPaso2(page);
    }
    await pedirCodigo(page, USUARIOS.sinSolicitudes.cedula);
    const real = await mascaraEnPaso2(page);
    await limpiarLimites();

    fs.mkdirSync(CARPETA_QA, { recursive: true });
    fs.writeFileSync(path.join(CARPETA_QA, "j1-mascaras.json"), JSON.stringify({ noRegistradas: vistas, registrada: real }, null, 2));

    // Todas las no registradas usan uno de los 4 dominios comunes.
    for (const [c, m] of Object.entries(vistas)) {
      expect(DOMINIOS_RELLENO, `${c} → ${m}`).toContain(m.split("@")[1]);
    }
    expect(real).toBe(USUARIOS.sinSolicitudes.mascara);
    // Si el dominio real no está entre los de relleno, quien pruebe cédulas sabe cuáles existen.
    expect(
      DOMINIOS_RELLENO,
      `La cédula registrada muestra «${real}»; ninguna cédula no registrada puede mostrar ese dominio → se deduce que existe`,
    ).toContain(real.split("@")[1]);
  });

  test("«Reenviar código» con cédula no registrada: mismo mensaje que con una registrada", async ({ context, page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Una vez basta");
    await limpiarLimites();
    await context.addCookies([
      {
        name: "ga_ingreso",
        value: cookieIngreso({ c: CEDULA_NO_REGISTRADA, m: "zz•••@gmail.com", u: Date.now() - 50_000 }),
        url: "http://localhost:3000",
        httpOnly: true,
      },
    ]);
    await page.goto("/ingresar/codigo");
    const reenviar = page.getByRole("button", { name: "Reenviar código" });
    await expect(reenviar).toBeEnabled();
    await reenviar.click();
    await expect(page.getByRole("status")).toHaveText("Si tu cédula está registrada, te enviamos un código nuevo.");
    await expect(reenviar).toBeDisabled();
    await limpiarLimites();
  });
});

// ---------------------------------------------------------------------------
// J2 · «Mis datos»: el teléfono solo se cambia en el propio perfil
// ---------------------------------------------------------------------------

test.describe("J2 · Teléfono y RLS", () => {
  test("Con el token de un asociado no se cambia el teléfono de otro", async ({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), "API: una vez basta");
    const antes = await adminRest(`perfiles?select=telefono&id=eq.${ID_CON_SOLICITUD}`);
    const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
    const r = await usuarioRest(`perfiles?id=eq.${ID_CON_SOLICITUD}`, token, {
      method: "PATCH",
      body: JSON.stringify({ telefono: "3000000000" }),
    });
    const despues = await adminRest(`perfiles?select=telefono&id=eq.${ID_CON_SOLICITUD}`);
    expect(despues.cuerpo, `PATCH → ${r.status} ${JSON.stringify(r.cuerpo)}`).toEqual(antes.cuerpo);
  });

  test("Celular con 9 dígitos y con letras → error y no se guarda", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await page.waitForLoadState("networkidle");
    const seccion = page.locator('section[aria-labelledby="mis-datos-titulo"]');
    const antes = await page.locator("#telefono").inputValue();
    for (const malo of ["310123456", "31012345ab", "31012345678"]) {
      await seccion.getByLabel("Celular").fill(malo);
      await seccion.getByRole("button", { name: "Guardar" }).click();
      await expect(seccion.locator("#telefono-error"), malo).toBeVisible();
      await expect(seccion.getByLabel("Celular")).toHaveAttribute("aria-invalid", "true");
    }
    const { cuerpo } = await adminRest(`perfiles?select=telefono&id=eq.${ID_SIN_SOLICITUDES}`);
    expect((cuerpo as { telefono: string }[])[0].telefono ?? "").toBe(antes);
    await ctx.close();
  });
});

// ---------------------------------------------------------------------------
// J3 · /cuenta/solicitar: perfil sin grado y «Salir»
// ---------------------------------------------------------------------------

test.describe("J3 · /cuenta/solicitar: otros estados", () => {
  test("Perfil sin grado → aviso y «Volver a mi cuenta», sin formulario", async ({ browser }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Una vez basta");
    const original = await adminRest(`perfiles?select=grado&id=eq.${ID_SIN_SOLICITUDES}`);
    const grado = (original.cuerpo as { grado: string }[])[0].grado;
    const quitar = await adminRest(`perfiles?id=eq.${ID_SIN_SOLICITUDES}`, {
      method: "PATCH",
      body: JSON.stringify({ grado: null }),
    });
    test.skip(quitar.status >= 300, `La base no deja quitar el grado (${quitar.status}); no se puede simular`);
    try {
      const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
      const page = await ctx.newPage();
      await page.goto("/cuenta/solicitar");
      await expect(page.getByText("Tu perfil aún no tiene un grado asignado.", { exact: false })).toBeVisible();
      await expect(page.locator("#monto")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Enviar solicitud" })).toHaveCount(0);
      await page.getByRole("link", { name: "Volver a mi cuenta" }).click();
      await expect(page).toHaveURL(/\/cuenta$/);
      await ctx.close();
    } finally {
      await adminRest(`perfiles?id=eq.${ID_SIN_SOLICITUDES}`, { method: "PATCH", body: JSON.stringify({ grado }) });
    }
  });

  test("«Salir» desde /cuenta/solicitar → /ingresar; luego /cuenta/solicitar pide ingresar", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta/solicitar");
    await expect(page.locator("h1")).toHaveText("Nueva solicitud");
    if (esEscritorio(testInfo)) await page.getByRole("button", { name: "Salir" }).click();
    else {
      // Mapa §4b: el encabezado de /cuenta/solicitar es «igual que en /cuenta», que en celular
      // tiene el ícono «Cerrar sesión».
      const cerrar = page.getByRole("button", { name: "Cerrar sesión" });
      await expect(cerrar, "En celular /cuenta/solicitar no tiene «Cerrar sesión»").toBeVisible({ timeout: 5_000 });
      await cerrar.click();
    }
    await expect(page).toHaveURL(/\/ingresar$/);
    await page.goto("/cuenta/solicitar");
    await expect(page).toHaveURL(/\/ingresar$/);
    await ctx.close();
    // La sesión guardada ya no sirve: se borra para que otras pruebas vuelvan a ingresar.
    fs.rmSync(path.join(path.dirname(CARPETA_QA), ".auth", `${testInfo.project.name}-sinSolicitudes.json`), { force: true });
  });
});

// ---------------------------------------------------------------------------
// J4 · Página 404 y cabeceras
// ---------------------------------------------------------------------------

test.describe("J4 · 404 y cabeceras", () => {
  test("La página 404 (/login) está en español y con salida al inicio", async ({ page }, testInfo) => {
    const r = await page.goto("/login");
    expect(r?.status()).toBe(404);
    const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await page.screenshot({ path: path.join(CARPETA_QA, `j4-404-${testInfo.project.name}.png`), fullPage: true });
    test.info().annotations.push({ type: "404", description: texto.slice(0, 200) });
    expect(texto, "La 404 muestra el texto por defecto de Next.js en inglés").not.toContain("This page could not be found");
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  });

  test("/cuenta no se puede incrustar en un iframe de otro sitio (X-Frame-Options o CSP frame-ancestors)", async ({ request }, testInfo) => {
    test.skip(!esEscritorio(testInfo), "Una vez basta");
    const cabeceras: Record<string, Record<string, string>> = {};
    for (const ruta of ["/", "/ingresar", "/cuenta"]) {
      const r = await request.get(ruta, { maxRedirects: 0 });
      cabeceras[ruta] = r.headers();
    }
    fs.writeFileSync(path.join(CARPETA_QA, "j4-cabeceras.json"), JSON.stringify(cabeceras, null, 2));
    const h = cabeceras["/ingresar"];
    const protegida = !!h["x-frame-options"] || /frame-ancestors/.test(h["content-security-policy"] ?? "");
    expect(protegida, "Sin X-Frame-Options ni CSP frame-ancestors (clickjacking)").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// J5 · Paso 2 después de «Reenviar código»
// ---------------------------------------------------------------------------

test.describe("J5 · Escribir el código después de «Reenviar código»", () => {
  for (const modo of ["pegar", "teclear"] as const) {
    test(`Tras reenviar, ${modo} 6 dígitos llena las casillas y habilita «Entrar a mi cuenta»`, async ({ context, page }, testInfo) => {
      await context.addCookies([
        {
          name: "ga_ingreso",
          value: cookieIngreso({ c: CEDULA_NO_REGISTRADA, m: "zz•••@gmail.com", u: Date.now() - 50_000 }),
          url: "http://localhost:3000",
          httpOnly: true,
        },
      ]);
      await page.goto("/ingresar/codigo");
      await page.waitForLoadState("networkidle");
      const entrar = page.getByRole("button", { name: "Entrar a mi cuenta" });
      await page.getByRole("button", { name: "Reenviar código" }).click();
      await expect(page.getByRole("status")).toHaveText("Si tu cédula está registrada, te enviamos un código nuevo.");
      await page.waitForTimeout(1500);

      const primera = page.locator('input[name="codigo-1"]');
      if (modo === "pegar") {
        await primera.click();
        await primera.evaluate((el) => {
          const dt = new DataTransfer();
          dt.setData("text", "123456");
          el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
        });
      } else {
        await primera.click();
        await page.keyboard.type("123456", { delay: 60 });
      }
      await page.waitForTimeout(1000);
      const valores = await page.locator('input[name^="codigo-"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).join(""));
      await page.screenshot({ path: path.join(CARPETA_QA, `j5-reenviar-${modo}-${testInfo.project.name}.png`), fullPage: true });
      expect(valores, "casillas después de reenviar").toBe("123456");
      await expect(entrar).toBeEnabled();
    });
  }

  test("Control: sin reenviar, pegar 6 dígitos habilita «Entrar a mi cuenta»", async ({ context, page }) => {
    await context.addCookies([
      {
        name: "ga_ingreso",
        value: cookieIngreso({ c: CEDULA_NO_REGISTRADA, m: "zz•••@gmail.com", u: Date.now() - 50_000 }),
        url: "http://localhost:3000",
        httpOnly: true,
      },
    ]);
    await page.goto("/ingresar/codigo");
    await page.waitForLoadState("networkidle");
    const primera = page.locator('input[name="codigo-1"]');
    await primera.click();
    await primera.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData("text", "123456");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole("button", { name: "Entrar a mi cuenta" })).toBeEnabled();
  });
});
