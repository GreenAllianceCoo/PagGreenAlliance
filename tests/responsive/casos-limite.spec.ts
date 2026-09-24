import { test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { esperarCodigo, esperarVentanaReenvio, llenarOtp, pedirCodigo, USUARIOS } from "../e2e/utils";

/**
 * Casos límite (ga-verificador-responsive): nombre largo en /cuenta y /cuenta/solicitar,
 * y celular en horizontal (844×390). Solo mide y captura.
 *   npx playwright test -c tests/responsive casos-limite.spec.ts
 */
const RAIZ = path.resolve(__dirname, "..", "..");
const FECHA = process.env.FECHA_REVISION ?? "2026-09-23";
const CAPTURAS = path.join(RAIZ, "docs", "verificaciones", `responsive-${FECHA}`);
const JSONL = path.join(RAIZ, "test-results", "responsive", `casos-limite-${FECHA}.jsonl`);
fs.mkdirSync(CAPTURAS, { recursive: true });
fs.mkdirSync(path.dirname(JSONL), { recursive: true });
const NOMBRE_LARGO = "María Fernanda Rodríguez Villamizar de Castañeda";

async function medir(page: Page) {
  return page.evaluate(() => {
    const vw = innerWidth;
    const caja = (el: Element) => {
      const b = el.getBoundingClientRect();
      return `${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)} [${Math.round(b.x)}-${Math.round(b.right)} y${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}]`;
    };
    const header = Array.from(document.querySelectorAll("header img, header nav a, header span, header button")).map(caja);
    const h1 = Array.from(document.querySelectorAll("main h1")).map(caja);
    const fuera = Array.from(document.querySelectorAll("body *"))
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > vw + 1; })
      .map(caja)
      .slice(0, 8);
    return { vw, sw: document.documentElement.scrollWidth, header, h1, fuera };
  });
}

test("Nombre largo en /cuenta y /cuenta/solicitar", async ({ browser }) => {
  const u = USUARIOS.sinSolicitudes;
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await esperarVentanaReenvio(u.correo);
  const inicio = await pedirCodigo(p, u.cedula);
  await llenarOtp(p, await esperarCodigo(u.correo, inicio));
  await p.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await p.waitForURL("**/cuenta");
  for (const ruta of ["/cuenta", "/cuenta/solicitar"]) {
    for (const ancho of [360, 1024, 1280]) {
      await p.setViewportSize({ width: ancho, height: 900 });
      await p.goto(ruta, { waitUntil: "networkidle" });
      await p.evaluate((largo) => {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (n.textContent?.includes("Asociada Sin Solicitudes")) n.textContent = n.textContent.replace("Asociada Sin Solicitudes", largo);
        }
      }, NOMBRE_LARGO);
      const m = await medir(p);
      fs.appendFileSync(JSONL, JSON.stringify({ caso: "nombre-largo", ruta, ancho, ...m }) + "\n");
      await p.screenshot({ path: path.join(CAPTURAS, `nombre-largo${ruta.replace(/\//g, "_")}-${ancho}.png`) });
    }
  }
  await ctx.close();
});

test("Celular horizontal 844×390", async ({ browser }) => {
  for (const ruta of ["/", "/ingresar", "/afiliacion", "/politica-de-datos"]) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const p = await ctx.newPage();
    await p.goto(ruta, { waitUntil: "networkidle" });
    const m = await medir(p);
    fs.appendFileSync(JSONL, JSON.stringify({ caso: "horizontal", ruta, ancho: 844, ...m }) + "\n");
    await p.screenshot({ path: path.join(CAPTURAS, `horizontal${ruta === "/" ? "_landing" : ruta.replace(/\//g, "_")}-844x390.png`) });
    await ctx.close();
  }
});
