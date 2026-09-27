import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { esperarCodigo, esperarVentanaReenvio, ingresarPorUI, limpiarLimites, llenarOtp, pedirCodigo, USUARIOS } from "../e2e/utils";

/**
 * Verificación responsive del logo horizontal (isotipo + wordmark SVG) y de los
 * espacios de foto de la landing (EspacioFoto). Solo mide y captura; no toca la app.
 */

const RAIZ = path.resolve(__dirname, "..", "..");
const SALIDA = path.join(RAIZ, "test-results", "responsive");
const AUTH = path.join(RAIZ, "test-results", ".auth");
fs.mkdirSync(SALIDA, { recursive: true });

const ANCHOS = [320, 354, 360, 390, 414, 768, 834, 1024, 1050, 1075, 1280, 1440, 1920];
const ALTO = 900;
const PROPORCION_WORDMARK = 4118 / 669;

type Sesion = "ninguna" | "cuenta" | "codigo" | "asesor" | "admin";
const RUTAS: Array<{ ruta: string; sesion: Sesion }> = [
  { ruta: "/", sesion: "ninguna" },
  { ruta: "/ingresar", sesion: "ninguna" },
  { ruta: "/ingresar/codigo", sesion: "codigo" },
  { ruta: "/afiliacion", sesion: "ninguna" },
  { ruta: "/politica-de-datos", sesion: "ninguna" },
  { ruta: "/cuenta", sesion: "cuenta" },
  { ruta: "/cuenta/solicitar", sesion: "cuenta" },
  { ruta: "/asesor", sesion: "asesor" },
  { ruta: "/admin/afiliaciones", sesion: "admin" },
];

const nombreRuta = (r: string) => (r === "/" ? "landing" : r.slice(1).replace(/\//g, "_"));

const estados: Partial<Record<Sesion, string>> = {};

async function estadoCuenta(browser: Browser) {
  const archivo = path.join(AUTH, "responsive-conSolicitud.json");
  for (const candidato of [archivo, path.join(AUTH, "escritorio-conSolicitud.json")]) {
    if (!fs.existsSync(candidato)) continue;
    const ctx = await browser.newContext({ storageState: candidato });
    const p = await ctx.newPage();
    await p.goto("/cuenta");
    const ok = p.url().endsWith("/cuenta");
    await ctx.close();
    if (ok) return candidato;
  }
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await ingresarPorUI(p, "conSolicitud");
  fs.mkdirSync(AUTH, { recursive: true });
  await ctx.storageState({ path: archivo });
  await ctx.close();
  return archivo;
}

async function estadoCodigo(browser: Browser) {
  const archivo = path.join(AUTH, "responsive-codigo.json");
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await limpiarLimites();
  await pedirCodigo(p, USUARIOS.sinSolicitudes.cedula);
  await ctx.storageState({ path: archivo });
  await ctx.close();
  return archivo;
}

async function estadoRol(browser: Browser, clave: "asesor" | "admin") {
  const archivo = path.join(AUTH, `responsive-${clave}.json`);
  const datos =
    clave === "admin"
      ? { cedula: "1234567899", correo: "admin.prueba@greenalliance.test", destino: "**/admin" }
      : { cedula: "1234567892", correo: "asesor.prueba@greenalliance.test", destino: "**/asesor" };
  if (fs.existsSync(archivo)) {
    const ctx = await browser.newContext({ storageState: archivo });
    const p = await ctx.newPage();
    await p.goto(clave === "admin" ? "/admin" : "/asesor");
    const ok = !p.url().endsWith("/ingresar");
    await ctx.close();
    if (ok) return archivo;
  }
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await esperarVentanaReenvio(datos.correo);
  const inicio = await pedirCodigo(p, datos.cedula);
  const codigo = await esperarCodigo(datos.correo, inicio);
  await llenarOtp(p, codigo);
  await p.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await p.waitForURL(datos.destino);
  fs.mkdirSync(AUTH, { recursive: true });
  await ctx.storageState({ path: archivo });
  await ctx.close();
  return archivo;
}

async function contexto(browser: Browser, sesion: Sesion, ancho: number): Promise<BrowserContext> {
  if (sesion !== "ninguna" && !estados[sesion]) {
    estados[sesion] =
      sesion === "cuenta"
        ? await estadoCuenta(browser)
        : sesion === "codigo"
          ? await estadoCodigo(browser)
          : await estadoRol(browser, sesion);
  }
  return browser.newContext({
    viewport: { width: ancho, height: ALTO },
    deviceScaleFactor: 2,
    storageState: sesion === "ninguna" ? undefined : estados[sesion],
  });
}

async function medirLogo(page: Page) {
  return page.evaluate((proporcion) => {
    const r = (el: Element) => {
      const b = el.getBoundingClientRect();
      return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
    };
    const inter = (a: DOMRect, b: DOMRect) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
      Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="wordmark"], img[srcset*="wordmark"]'))
      .filter((img) => img.getBoundingClientRect().width > 0)
      .map((img) => {
        const iso = img.previousElementSibling as HTMLImageElement | null;
        const bw = img.getBoundingClientRect();
        const bi = iso?.getBoundingClientRect();
        const contenedor = img.closest("a") ?? img.parentElement!;
        const bc = contenedor.getBoundingClientRect();
        // Elementos hermanos del enlace del logo (nav, botón volver, etc.) que se crucen con él.
        const fila = contenedor.parentElement!;
        const solapes = Array.from(fila.children)
          .filter((h) => h !== contenedor && !h.contains(contenedor))
          .map((h) => ({ tag: h.tagName, texto: (h.textContent ?? "").trim().slice(0, 30), area: inter(bc, h.getBoundingClientRect()) }))
          .filter((s) => s.area > 1);
        // Color de fondo efectivo detrás del logo.
        let fondo = "transparent";
        for (let el: Element | null = img; el; el = el.parentElement) {
          const c = getComputedStyle(el).backgroundColor;
          if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
            fondo = c;
            break;
          }
          const bgImg = getComputedStyle(el).backgroundImage;
          if (bgImg && bgImg !== "none") {
            fondo = bgImg.slice(0, 60);
            break;
          }
        }
        return {
          src: img.currentSrc.replace(location.origin, ""),
          alt: img.alt,
          natural: [img.naturalWidth, img.naturalHeight],
          completo: img.complete && img.naturalWidth > 0,
          wordmark: r(img),
          isotipo: bi ? r(iso!) : null,
          isotipoSrc: iso?.currentSrc.replace(location.origin, ""),
          contenedor: r(contenedor),
          proporcion: +(bw.width / bw.height).toFixed(3),
          desvioProporcion: +Math.abs(bw.width / bw.height / proporcion - 1).toFixed(3),
          desalineoVertical: bi ? +Math.abs(bw.top + bw.height / 2 - (bi.top + bi.height / 2)).toFixed(1) : null,
          seSaleDelContenedor: bw.right > bc.right + 0.5 || bw.bottom > bc.bottom + 0.5 || bw.top < bc.top - 0.5,
          seSaleDelViewport: bw.right > window.innerWidth + 0.5 || bw.left < -0.5,
          solapes,
          fondo,
          ariaLabelEnlace: img.closest("a")?.getAttribute("aria-label") ?? null,
        };
      });
  }, PROPORCION_WORDMARK);
}

async function scrollHorizontal(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    let peor: string | null = null;
    if (sw > vw) {
      let max = vw;
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const b = el.getBoundingClientRect();
        if (b.right > max + 0.5) {
          max = b.right;
          peor = `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 80)} → ${Math.round(b.right)}px`;
        }
      }
    }
    return { vw, sw, peor };
  });
}

const resumen = { push: (x: unknown) => fs.appendFileSync(path.join(SALIDA, "logo-y-fotos.jsonl"), JSON.stringify(x) + "\n") };


for (const { ruta, sesion } of RUTAS) {
  test(`Logo · ${ruta}`, async ({ browser }) => {
    for (const ancho of ANCHOS) {
      const ctx = await contexto(browser, sesion, ancho);
      const page = await ctx.newPage();
      const resp = await page.goto(ruta, { waitUntil: "networkidle" });
      const estado = resp?.status() ?? 0;
      const urlFinal = new URL(page.url()).pathname;
      await page.evaluate(() => document.fonts.ready);
      const logos = await medirLogo(page);
      const scroll = await scrollHorizontal(page);
      const nombre = `${nombreRuta(ruta)}-${ancho}`;
      await page.screenshot({ path: path.join(SALIDA, `${nombre}.png`), fullPage: true });
      // Recorte del encabezado (DPR 2) para revisar nitidez y alineación.
      const primero = logos[0];
      if (primero) {
        const c = primero.contenedor;
        await page.screenshot({
          path: path.join(SALIDA, `logo-${nombre}.png`),
          clip: { x: Math.max(0, c.x - 12), y: Math.max(0, c.y - 12), width: Math.min(ancho - Math.max(0, c.x - 12), c.w + 160), height: c.h + 24 },
        });
      }
      resumen.push({ ruta, ancho, estado, urlFinal, scroll, logos });
      await ctx.close();
      expect.soft(urlFinal, `${ruta} @${ancho}: redirigió`).toBe(ruta);
      expect.soft(estado, `${ruta} @${ancho}: estado HTTP`).toBeLessThan(400);
      expect.soft(scroll.sw, `${ruta} @${ancho}: scroll horizontal (${scroll.peor})`).toBeLessThanOrEqual(scroll.vw);
      expect.soft(logos.length, `${ruta} @${ancho}: sin logo horizontal visible`).toBeGreaterThan(0);
      for (const l of logos) {
        expect.soft(l.completo, `${ruta} @${ancho}: wordmark no cargó`).toBe(true);
        expect.soft(l.desvioProporcion, `${ruta} @${ancho}: wordmark deformado`).toBeLessThan(0.03);
        expect.soft(l.desalineoVertical ?? 0, `${ruta} @${ancho}: desalineado con isotipo`).toBeLessThanOrEqual(1.5);
        expect.soft(l.seSaleDelContenedor, `${ruta} @${ancho}: wordmark se sale del contenedor`).toBe(false);
        expect.soft(l.seSaleDelViewport, `${ruta} @${ancho}: wordmark fuera del viewport`).toBe(false);
        expect.soft(l.solapes, `${ruta} @${ancho}: logo solapa con otro elemento`).toEqual([]);
        expect.soft(l.src, `${ruta} @${ancho}: debe servirse el SVG directo`).toMatch(/\.svg/);
      }
    }
  });
}

test("Landing · ilustración del hero (manchas + matriz de círculos + comprobante)", async ({ browser }) => {
  // La landing (rediseño C+, pieza 2a) ya no usa components/ui/EspacioFoto.tsx (sin uso,
  // confirmado por grep): el hero es <section> con 2 columnas (texto + ilustración). La
  // ilustración es el 2º hijo directo: manchas orgánicas + <MatrizCirculos> + <ComprobanteSolicitud>.
  // El desborde horizontal/vertical de sus piezas (manchas con posición absoluta, comprobante
  // absoluto en escritorio) ya lo cubre la prueba general de scroll horizontal de
  // responsive.spec.ts en los mismos anchos (incluidos 768 y 834, la zona sin maqueta); aquí solo
  // se deja una captura de referencia y se valida que las imágenes (isotipo en los círculos)
  // carguen sin deformarse.
  for (const ancho of ANCHOS) {
    const ctx = await contexto(browser, "ninguna", ancho);
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const datos = await page.evaluate(() => {
      const r = (b: DOMRect) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
      const hero = document.querySelector("main > section") as HTMLElement | null;
      const ilustracion = hero?.children[1] as HTMLElement | undefined;
      const imgs = ilustracion
        ? Array.from(ilustracion.querySelectorAll("img")).map((im) => ({
            alt: im.getAttribute("alt"),
            ok: im.complete && im.naturalWidth > 0,
            w: im.getBoundingClientRect().width,
            h: im.getBoundingClientRect().height,
          }))
        : [];
      return {
        hero: hero ? r(hero.getBoundingClientRect()) : null,
        ilustracion: ilustracion ? r(ilustracion.getBoundingClientRect()) : null,
        imgs,
      };
    });
    resumen.push({ ruta: "/ (hero)", ancho, datos });
    const heroLoc = page.locator("main > section").first();
    await heroLoc.screenshot({ path: path.join(SALIDA, `hero-${ancho}.png`) }).catch(() => {});
    await ctx.close();
    expect.soft(datos.ilustracion, `@${ancho}: no se encontró la ilustración del hero (manchas + matriz + comprobante)`).not.toBeNull();
    expect.soft(datos.imgs.every((im) => im.ok), `@${ancho}: alguna imagen del hero no cargó`).toBe(true);
    expect.soft(datos.imgs.every((im) => im.w > 0 && im.h > 0), `@${ancho}: alguna imagen del hero quedó en 0×0`).toBe(true);
  }
});

test("Wordmarks · sin restos del lema ni del escudo", async ({ page }) => {
  for (const archivo of ["vector/green-alliance-wordmark.svg", "blanco/green-alliance-wordmark-blanco.svg"]) {
    const svg = fs.readFileSync(path.join(RAIZ, "public", "logos", archivo), "utf8");
    // Se amplía el viewBox al lienzo completo del logo (4442×2900) para ver si
    // quedó algún trazo fuera del recorte (lema o escudo que el viewBox oculta).
    const completo = svg.replace(/viewBox="[^"]+"/, 'viewBox="0 0 4442 2900"').replace(/width="\d+" height="\d+"/, 'width="1480" height="966"');
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.setContent(`<body style="margin:0;background:${archivo.includes("blanco") ? "#1e6652" : "#fff"}">${completo}</body>`);
    const info = await page.evaluate(() => {
      const res: Array<{ x: number; y: number; w: number; h: number }> = [];
      const ns = "http://www.w3.org/2000/svg";
      const svgEl = document.querySelector("svg")!;
      for (const p of Array.from(svgEl.querySelectorAll("path"))) {
        const g = p.parentElement!;
        for (const sub of (p.getAttribute("d") ?? "").split(/(?=M)/)) {
          const tmp = document.createElementNS(ns, "path");
          tmp.setAttribute("d", sub);
          g.appendChild(tmp);
          const b = tmp.getBoundingClientRect();
          // coordenadas del lienzo del logo (escala 1480/4442)
          const k = 4442 / 1480;
          res.push({ x: Math.round(b.x * k), y: Math.round(b.y * k), w: Math.round(b.width * k), h: Math.round(b.height * k) });
          tmp.remove();
        }
      }
      return res;
    });
    const fuera = info.filter((b) => b.x < 163 - 2 || b.y < 1781 - 2 || b.x + b.w > 163 + 4118 + 2 || b.y + b.h > 1781 + 669 + 2);
    await page.screenshot({ path: path.join(SALIDA, `wordmark-lienzo-${archivo.includes("blanco") ? "blanco" : "color"}.png`) });
    resumen.push({ archivo, subtrazos: info.length, fueraDelRecorte: fuera, bboxGlobal: {
      minX: Math.min(...info.map((b) => b.x)), minY: Math.min(...info.map((b) => b.y)),
      maxX: Math.max(...info.map((b) => b.x + b.w)), maxY: Math.max(...info.map((b) => b.y + b.h)),
    } });
    expect.soft(fuera, `${archivo}: subtrazos fuera del recorte`).toEqual([]);
  }
});

test("Diseño · Logo.dc.html", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 300 });
  await page.goto("file://" + path.join(RAIZ, "design", "Logo.dc.html").replace(/\\/g, "/"));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SALIDA, "diseno-logo.png") });
});
