import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  CARPETA_QA,
  esEscritorio,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  MENSAJE_CODIGO_INVALIDO,
  pedirCodigo,
  USUARIOS,
} from "./utils";

/**
 * Z. Intentos de código equivocados (fuerza bruta del paso 2).
 *
 * La app no limita los intentos de «Entrar a mi cuenta»; solo queda el límite
 * de Supabase Auth (token_verifications = 30 cada 5 min POR IP). Como la
 * llamada a verifyOtp la hace el servidor de Next, Supabase ve la IP del
 * servidor, no la del usuario: 30 intentos fallidos de UNA persona bloquean
 * el ingreso de TODOS durante 5 minutos.
 *
 * Deja el ingreso local bloqueado ~5 min, por eso solo corre con
 * QA_LIMITE_VERIFICACION=1 (y va al final: z-…).
 */

test("30 códigos equivocados desde un navegador no deben impedir que OTRO asociado entre", async ({ browser }, testInfo) => {
  test.skip(!esEscritorio(testInfo), "Una vez basta");
  test.skip(process.env.QA_LIMITE_VERIFICACION !== "1", "Bloquea el ingreso local 5 min: correr con QA_LIMITE_VERIFICACION=1");
  test.setTimeout(300_000);
  await limpiarLimites();

  // «Atacante»: una cédula cualquiera (registrada) y 30 códigos al azar.
  const atacante = await browser.newContext();
  const pa = await atacante.newPage();
  await esperarVentanaReenvio(USUARIOS.conSolicitud.correo);
  await pedirCodigo(pa, USUARIOS.conSolicitud.cedula);
  const intentos = Number(process.env.QA_INTENTOS ?? 30);
  for (let i = 0; i < intentos; i++) {
    await llenarOtp(pa, String(100000 + i));
    // Esperar la respuesta de ESTE intento (el mensaje de error del anterior sigue visible).
    await Promise.all([
      pa.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/ingresar/codigo")),
      pa.getByRole("button", { name: "Entrar a mi cuenta" }).click(),
    ]);
    await expect(pa.getByText(MENSAJE_CODIGO_INVALIDO)).toBeVisible();
    await expect(pa.locator('input[name="codigo-1"]')).toHaveValue("");
  }
  await atacante.close();

  // Asociada legítima, otro navegador, código correcto de Mailpit.
  const u = USUARIOS.sinSolicitudes;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await limpiarLimites();
  await esperarVentanaReenvio(u.correo);
  const inicio = await pedirCodigo(page, u.cedula);
  const codigo = await esperarCodigo(u.correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  const entro = await page
    .waitForURL("**/cuenta", { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  fs.mkdirSync(CARPETA_QA, { recursive: true });
  await page.screenshot({ path: path.join(CARPETA_QA, "z-limite-verificacion.png"), fullPage: true });
  fs.writeFileSync(
    path.join(CARPETA_QA, "z-limite-verificacion.json"),
    JSON.stringify({ intentosFallidos: intentos, legitimaEntro: entro, url: page.url() }, null, 2),
  );
  expect(entro, "La asociada con el código correcto quedó bloqueada por los intentos de otra persona").toBe(true);
  await ctx.close();
});
