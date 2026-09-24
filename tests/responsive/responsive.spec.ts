import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { esperarCodigo, esperarVentanaReenvio, llenarOtp, pedirCodigo, USUARIOS } from "../e2e/utils";

/**
 * Revisión responsive completa (ga-verificador-responsive). Solo mide y captura; no toca la app.
 *   npx playwright test -c tests/responsive responsive.spec.ts
 * Sesión: cédula 1234567891 (sinSolicitudes) con el código de Mailpit. No limpia límites
 * (otro agente puede estar probándolos): si el ingreso falla, las rutas con sesión se marcan.
 * Capturas: docs/verificaciones/responsive-AAAA-MM-DD/<ruta>-<ancho>.png
 */

const RAIZ = path.resolve(__dirname, "..", "..");
const FECHA = process.env.FECHA_REVISION ?? "2026-09-23";
const CAPTURAS = path.join(RAIZ, "docs", "verificaciones", `responsive-${FECHA}`);
const DATOS = path.join(RAIZ, "test-results", "responsive");
const AUTH = path.join(RAIZ, "test-results", ".auth");
fs.mkdirSync(CAPTURAS, { recursive: true });
fs.mkdirSync(DATOS, { recursive: true });
const JSONL = path.join(DATOS, `responsive-${FECHA}.jsonl`);

const ANCHOS = (process.env.ANCHOS ?? "360,390,640,767,768,1023,1024,1280,1440").split(",").map(Number);
const ALTO = 900;

type Sesion = "ninguna" | "codigo" | "cuenta" | "enviada";
const RUTAS: Array<{ ruta: string; sesion: Sesion }> = [
  { ruta: "/", sesion: "ninguna" },
  { ruta: "/ingresar", sesion: "ninguna" },
  { ruta: "/ingresar/codigo", sesion: "codigo" },
  { ruta: "/afiliacion", sesion: "ninguna" },
  { ruta: "/afiliacion/enviada", sesion: "enviada" },
  { ruta: "/cuenta", sesion: "cuenta" },
  { ruta: "/cuenta/solicitar", sesion: "cuenta" },
  { ruta: "/politica-de-datos", sesion: "ninguna" },
];

const nombreRuta = (r: string) => (r === "/" ? "landing" : r.slice(1).replace(/\//g, "_"));
const estados: Partial<Record<Sesion, string>> = {};

/** Ingreso por la interfaz sin borrar límites: guarda el estado del paso 2 y el de la cuenta. */
async function prepararSesiones(browser: Browser) {
  if (estados.cuenta) return;
  const u = USUARIOS.sinSolicitudes;
  const archivoCuenta = path.join(AUTH, "responsive-sinSolicitudes.json");
  const archivoCodigo = path.join(AUTH, "responsive-codigo.json");
  fs.mkdirSync(AUTH, { recursive: true });
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await esperarVentanaReenvio(u.correo);
  const inicio = await pedirCodigo(p, u.cedula);
  await ctx.storageState({ path: archivoCodigo });
  estados.codigo = archivoCodigo;
  const codigo = await esperarCodigo(u.correo, inicio);
  await llenarOtp(p, codigo);
  await p.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await p.waitForURL("**/cuenta");
  await ctx.storageState({ path: archivoCuenta });
  estados.cuenta = archivoCuenta;
  await ctx.close();
}

/** Cookie «flash» de /afiliacion/enviada con el campo trampa (no guarda ni envía correos). */
async function prepararEnviada(browser: Browser) {
  if (estados.enviada) return;
  const archivo = path.join(AUTH, "responsive-enviada.json");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("/afiliacion", { waitUntil: "networkidle" });
  await p.getByLabel("Nombres y apellidos").fill("Prueba Responsive");
  await p.getByLabel("Número de cédula").fill("7000000001");
  await p.getByLabel("Grado").selectOption({ index: 1 });
  await p.getByLabel("Celular (WhatsApp)").fill("3104567890");
  await p.getByLabel("Correo electrónico").fill("responsive.qa@correo.com");
  await p.locator("#af-datos").setChecked(true);
  await p.locator("#af-sitio").evaluate((el: HTMLInputElement) => (el.value = "bot"));
  await p.getByRole("button", { name: /Enviar/ }).click();
  await p.waitForURL("**/afiliacion/enviada");
  await ctx.storageState({ path: archivo });
  estados.enviada = archivo;
  await ctx.close();
}

/** Todas las mediciones dentro de la página. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const r = (b: DOMRect) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
    const desc = (el: Element) => {
      const t = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const aria = el.getAttribute("aria-label");
      const cls = String((el as HTMLElement).className ?? "").slice(0, 70);
      return `${el.tagName.toLowerCase()}${aria ? `[aria-label="${aria}"]` : ""}${t ? ` «${t}»` : ""} .${cls}`;
    };
    const oculto = (el: Element): boolean => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden") return true;
        if (e.getAttribute("aria-hidden") === "true" && e.classList.contains("absolute")) return true;
        if (e.classList.contains("sr-only")) return true;
      }
      const b = el.getBoundingClientRect();
      return b.width < 1 || b.height < 1 || b.right < -500;
    };
    const decorativo = (el: Element) => !!el.closest('[aria-hidden="true"]');

    // 1. Scroll horizontal
    const sw = document.documentElement.scrollWidth;
    const anchos: string[] = [];
    if (sw > vw) {
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const b = el.getBoundingClientRect();
        if (b.right > vw + 0.5 && b.width > 0) anchos.push(`${desc(el)} → right ${Math.round(b.right)}`);
      }
    }

    // Hojas de texto (elementos con texto propio)
    const todos = Array.from(document.querySelectorAll("body *")).filter((el) => !oculto(el));
    const conTexto = todos.filter((el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== ""),
    );

    // 2a. Texto fuera del viewport o recortado por overflow
    const fueraViewport = conTexto
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > vw + 1 || b.left < -1;
      })
      .map((el) => `${desc(el)} ${JSON.stringify(r(el.getBoundingClientRect()))}`);
    const recortados = todos
      .filter((el) => {
        const cs = getComputedStyle(el);
        const ocultaX = /hidden|clip/.test(cs.overflowX);
        const ocultaY = /hidden|clip/.test(cs.overflowY);
        if (!ocultaX && !ocultaY) return false;
        if (!(el.textContent ?? "").trim()) return false;
        const h = el as HTMLElement;
        return (ocultaX && h.scrollWidth > h.clientWidth + 1) || (ocultaY && h.scrollHeight > h.clientHeight + 1);
      })
      .map((el) => { const h = el as HTMLElement; return `${desc(el)} scroll ${h.scrollWidth}x${h.scrollHeight} vs ${h.clientWidth}x${h.clientHeight}`; });
    // Texto que se sale de su contenedor inmediato (sin overflow oculto)
    const desbordados = conTexto
      .filter((el) => {
        const padre = el.parentElement;
        if (!padre || decorativo(el)) return false;
        const b = el.getBoundingClientRect();
        const bp = padre.getBoundingClientRect();
        const h = el as HTMLElement;
        return h.scrollWidth > h.clientWidth + 2 && getComputedStyle(el).display !== "inline" ? true : b.right > bp.right + 2 && getComputedStyle(padre).display !== "inline";
      })
      .map((el) => desc(el));

    // 2b. Solapes entre elementos interactivos y textos
    const interactivos = todos.filter((el) => el.matches("a[href], button, input:not([type=hidden]), select, textarea, [role=button]"));
    const cajas = Array.from(new Set([...interactivos, ...conTexto])).filter((el) => !decorativo(el));
    const solapes: string[] = [];
    for (let i = 0; i < cajas.length; i++) {
      const a = cajas[i];
      const ba = a.getBoundingClientRect();
      for (let j = i + 1; j < cajas.length; j++) {
        const b = cajas[j];
        if (a.contains(b) || b.contains(a)) continue;
        const lab = (x: Element, y: Element) => x.tagName === "LABEL" && ((x as HTMLLabelElement).control === y || x.contains(y));
        if (lab(a, b) || lab(b, a)) continue;
        const bb = b.getBoundingClientRect();
        const ix = Math.min(ba.right, bb.right) - Math.max(ba.left, bb.left);
        const iy = Math.min(ba.bottom, bb.bottom) - Math.max(ba.top, bb.top);
        if (ix > 2 && iy > 2) solapes.push(`${desc(a)}  ⟷  ${desc(b)}  (${Math.round(ix)}x${Math.round(iy)})`);
      }
    }

    // 5. Tamaño de toque
    const pequenos: Array<{ el: string; w: number; h: number; enLinea: boolean }> = [];
    for (const el of interactivos) {
      if (el.matches('input[type=checkbox], input[type=radio]')) continue;
      const b = el.getBoundingClientRect();
      if (b.width >= 44 && b.height >= 44) continue;
      const cs = getComputedStyle(el);
      const padre = el.parentElement!;
      const enLinea =
        cs.display === "inline" &&
        Array.from(padre.childNodes).some((n) => n !== el && (n.textContent ?? "").trim() !== "");
      pequenos.push({ el: desc(el), w: Math.round(b.width), h: Math.round(b.height), enLinea });
    }
    // Casillas: el área útil es la etiqueta
    const casillas = Array.from(document.querySelectorAll<HTMLInputElement>("input[type=checkbox], input[type=radio]")).map((c) => {
      const lab = c.closest("label") ?? (c.id ? document.querySelector(`label[for="${c.id}"]`) : null);
      const b = (lab && !oculto(lab) ? lab : c).getBoundingClientRect();
      const bc = c.getBoundingClientRect();
      return { name: c.name || c.id, control: r(bc), etiqueta: r(b) };
    });

    // 6. Tipografía
    const fuentesPequenas = conTexto
      .map((el) => ({ el: desc(el), px: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((x) => x.px < 13);
    const inputsPequenos = todos
      .filter((el) => el.matches("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select, textarea"))
      .map((el) => ({ el: desc(el) + ` name=${el.getAttribute("name")}`, px: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((x) => x.px < 16);

    // 7. OTP
    const otp = Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="codigo-"]')).map((i) => r(i.getBoundingClientRect()));
    const otpInfo = otp.length
      ? {
          n: otp.length,
          dentro: otp.every((b) => b.x >= 0 && b.x + b.w <= vw),
          ancho: otp[0].w,
          alto: otp[0].h,
          separacion: otp.length > 1 ? otp[1].x - (otp[0].x + otp[0].w) : 0,
        }
      : null;

    // 8. Imágenes
    const imagenes = Array.from(document.querySelectorAll<HTMLImageElement>("img"))
      .filter((i) => !oculto(i))
      .map((i) => {
        const b = i.getBoundingClientRect();
        const fit = getComputedStyle(i).objectFit;
        const nat = i.naturalWidth / (i.naturalHeight || 1);
        const vis = b.width / (b.height || 1);
        const svg = /\.svg/.test(i.currentSrc);
        return {
          src: i.currentSrc.replace(location.origin, "").slice(0, 80),
          w: Math.round(b.width), h: Math.round(b.height), natural: [i.naturalWidth, i.naturalHeight], fit,
          deformada: fit !== "cover" && fit !== "contain" && Math.abs(vis / nat - 1) > 0.03,
          pixelada: !svg && i.naturalWidth > 0 && i.naturalWidth < b.width * Math.min(window.devicePixelRatio, 2) * 0.9,
        };
      });

    // 3. Patrones
    const visible = (el: Element | null | undefined) => !!el && !oculto(el);
    const porTexto = (sel: string, re: RegExp) => Array.from(document.querySelectorAll(sel)).find((e) => re.test((e.textContent ?? "").trim()));
    const aside = document.querySelector("aside");
    const main = document.querySelector("main");
    const form = document.querySelector("main form");
    const columnasDe = (el: Element | null | undefined) => {
      if (!el) return null;
      const hijos = Array.from(el.children).filter((h) => !oculto(h));
      const xs = new Set(hijos.map((h) => Math.round(h.getBoundingClientRect().x)));
      return { columnas: xs.size, hijos: hijos.length, anchoHijo: hijos[0] ? Math.round(hijos[0].getBoundingClientRect().width) : 0 };
    };
    const tituloConvenios = porTexto("h2", /convenios/i);
    const contConvenios = tituloConvenios?.closest("section")?.lastElementChild ?? null;
    const patrones = {
      aside: aside && visible(aside) ? r(aside.getBoundingClientRect()) : null,
      main: main ? r(main.getBoundingClientRect()) : null,
      form: form ? r(form.getBoundingClientRect()) : null,
      formColumnas: form ? getComputedStyle(form).gridTemplateColumns : null,
      convenios: columnasDe(contConvenios),
      navApoyos: visible(porTexto("header a", /^Apoyos$/)),
      navHistorias: visible(porTexto("header a", /^Historias$/)),
      navConvenios: visible(porTexto("header a", /^Convenios$/)),
      conocerCooperativa: visible(porTexto("a", /Conocer la cooperativa/)),
      cambiarCedula: visible(porTexto("a", /^Cambiar cédula$/)),
      volver: visible(document.querySelector('[aria-label="Volver"]')),
      pasoXdeY: visible(porTexto("span", /^Paso \d de \d$/)),
      listaPasos: Array.from(document.querySelectorAll("ol")).some((o) => visible(o)),
      alturaPagina: document.documentElement.scrollHeight,
    };

    return { vw, sw, anchos: anchos.slice(-6), fueraViewport, recortados, desbordados, solapes, pequenos, casillas, fuentesPequenas, inputsPequenos, otpInfo, imagenes, patrones };
  });
}

const escribir = (x: unknown) => fs.appendFileSync(JSONL, JSON.stringify(x) + "\n");

for (const { ruta, sesion } of RUTAS) {
  test(`Responsive · ${ruta}`, async ({ browser }) => {
    if (sesion === "codigo" || sesion === "cuenta") await prepararSesiones(browser);
    if (sesion === "enviada") await prepararEnviada(browser);
    for (const ancho of ANCHOS) {
      const ctx = await browser.newContext({
        viewport: { width: ancho, height: ALTO },
        deviceScaleFactor: 1,
        storageState: sesion === "ninguna" ? undefined : estados[sesion],
      });
      const page = await ctx.newPage();
      const resp = await page.goto(ruta, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const urlFinal = new URL(page.url()).pathname;
      const m = await medir(page);
      const archivo = path.join(CAPTURAS, `${nombreRuta(ruta)}-${ancho}.png`);
      await page.screenshot({ path: archivo, fullPage: true });
      escribir({ ruta, ancho, estado: resp?.status(), urlFinal, ...m });
      // Propaga tokens renovados (refresh token rotativo) a los contextos siguientes.
      if (sesion === "cuenta" && urlFinal === ruta) await ctx.storageState({ path: estados.cuenta! });
      await ctx.close();

      expect.soft(urlFinal, `${ruta} @${ancho}: redirigió`).toBe(ruta);
      expect.soft(m.sw, `${ruta} @${ancho}: scroll horizontal ${m.anchos.join(" | ")}`).toBeLessThanOrEqual(m.vw);
      expect.soft(m.fueraViewport, `${ruta} @${ancho}: texto fuera del viewport`).toEqual([]);
      expect.soft(m.solapes, `${ruta} @${ancho}: solapes`).toEqual([]);
      expect.soft(m.fuentesPequenas, `${ruta} @${ancho}: texto < 13 px`).toEqual([]);
      if (ancho < 1024) {
        expect.soft(m.inputsPequenos, `${ruta} @${ancho}: inputs < 16 px`).toEqual([]);
        expect.soft(m.pequenos.filter((p) => !p.enLinea), `${ruta} @${ancho}: toque < 44 px`).toEqual([]);
      }
      if (m.otpInfo) {
        expect.soft(m.otpInfo.n, `${ruta} @${ancho}: 6 casillas`).toBe(6);
        expect.soft(m.otpInfo.dentro, `${ruta} @${ancho}: casillas dentro`).toBe(true);
      }
      expect.soft(m.imagenes.filter((i) => i.deformada), `${ruta} @${ancho}: imágenes deformadas`).toEqual([]);

      const p = m.patrones;
      if (ruta.startsWith("/ingresar")) {
        if (ancho < 1024) {
          expect.soft(p.aside && p.main && p.aside.y < p.main.y && p.aside.w === ancho, `${ruta} @${ancho}: panel verde arriba`).toBe(true);
        } else {
          expect.soft(p.aside && p.main && p.aside.x === 0 && Math.abs(p.aside.w - 540) <= 4 && p.main.x >= p.aside.w, `${ruta} @${ancho}: panel 540 a la izquierda`).toBe(true);
        }
        expect.soft(p.volver, `${ruta} @${ancho}: flecha volver`).toBe(ancho < 1024 ? ruta === "/ingresar/codigo" : false);
        if (ruta === "/ingresar/codigo") expect.soft(p.cambiarCedula, `${ruta} @${ancho}: Cambiar cédula`).toBe(ancho >= 1024);
      }
      if (ruta === "/afiliacion" && p.formColumnas) {
        const cols = p.formColumnas.split(" ").length;
        expect.soft(cols, `${ruta} @${ancho}: columnas del formulario`).toBe(ancho >= 1024 ? 2 : 1);
        if (ancho >= 1024) expect.soft(p.aside && p.form && p.aside.x < p.form.x, `${ruta} @${ancho}: aside a la izquierda`).toBe(true);
        expect.soft(p.listaPasos, `${ruta} @${ancho}: pasos 1-2-3 solo escritorio`).toBe(ancho >= 1024);
      }
      if ((ruta === "/" || ruta === "/cuenta") && p.convenios) {
        expect.soft(p.convenios.columnas, `${ruta} @${ancho}: convenios`).toBe(ancho >= 1024 ? Math.min(5, p.convenios.hijos) : 1);
      }
      if (ruta === "/") {
        for (const k of ["navApoyos", "navHistorias", "navConvenios", "conocerCooperativa"] as const) {
          expect.soft(p[k], `/ @${ancho}: ${k}`).toBe(ancho >= 1024);
        }
      }
    }
  });
}

/** Maquetas de design/ a su ancho nativo, para comparar con las capturas de 390 y 1280. */
test("Maquetas de design/", async ({ browser }) => {
  const dir = path.join(RAIZ, "design");
  for (const archivo of fs.readdirSync(dir).filter((f) => /-(PC|Movil)\.dc\.html$/.test(f) || f === "Main.dc.html")) {
    const ancho = /Movil/.test(archivo) ? 390 : 1280;
    const ctx = await browser.newContext({ viewport: { width: ancho, height: ALTO } });
    const page = await ctx.newPage();
    await page.goto("file:///" + path.join(dir, archivo).replace(/\\/g, "/"));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(CAPTURAS, `diseno-${archivo.replace(".dc.html", "")}.png`), fullPage: true });
    await ctx.close();
  }
});
