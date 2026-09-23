import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ingresarPorUI, limpiarLimites, pedirCodigo, USUARIOS } from "../e2e/utils";

/**
 * Verificación responsive del logo horizontal (isotipo + wordmark SVG) y de los
 * espacios de foto de la landing (EspacioFoto). Solo mide y captura; no toca la app.
 */

const RAIZ = path.resolve(__dirname, "..", "..");
const SALIDA = path.join(RAIZ, "test-results", "responsive");
const AUTH = path.join(RAIZ, "test-results", ".auth");
fs.mkdirSync(SALIDA, { recursive: true });

const ANCHOS = [320, 360, 390, 414, 768, 834, 1024, 1280, 1440, 1920];
const ALTO = 900;
const PROPORCION_WORDMARK = 4118 / 669;

type Sesion = "ninguna" | "cuenta" | "codigo";
const RUTAS: Array<{ ruta: string; sesion: Sesion }> = [
  { ruta: "/", sesion: "ninguna" },
  { ruta: "/ingresar", sesion: "ninguna" },
  { ruta: "/ingresar/codigo", sesion: "codigo" },
  { ruta: "/afiliacion", sesion: "ninguna" },
  { ruta: "/politica-de-datos", sesion: "ninguna" },
  { ruta: "/cuenta", sesion: "cuenta" },
  { ruta: "/dashboard", sesion: "cuenta" },
  { ruta: "/dashboard/solicitar", sesion: "cuenta" },
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

async function contexto(browser: Browser, sesion: Sesion, ancho: number): Promise<BrowserContext> {
  if (sesion !== "ninguna" && !estados[sesion]) {
    estados[sesion] = sesion === "cuenta" ? await estadoCuenta(browser) : await estadoCodigo(browser);
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

const resumen: unknown[] = [];

test.afterAll(() => {
  fs.writeFileSync(path.join(SALIDA, "logo-y-fotos.json"), JSON.stringify(resumen, null, 2));
});

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

test("Landing · espacios de foto", async ({ browser }) => {
  for (const ancho of ANCHOS) {
    const ctx = await contexto(browser, "ninguna", ancho);
    const page = await ctx.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const datos = await page.evaluate(() => {
      const r = (b: DOMRect) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
      const espacios = Array.from(document.querySelectorAll<HTMLElement>("main .bg-gradient-to-br"));
      const tarjeta = Array.from(document.querySelectorAll("main strong")).find((s) => /Tu solicitud|Así ves tu solicitud/.test(s.textContent ?? ""))?.closest("div.rounded-16") as HTMLElement | undefined;
      const bt = tarjeta?.getBoundingClientRect();
      return espacios.map((e, i) => {
        const b = e.getBoundingClientRect();
        const circulo = e.querySelector<HTMLElement>(".rounded-full");
        const svg = circulo?.querySelector("svg");
        const bc = circulo?.getBoundingClientRect();
        const bs = svg?.getBoundingClientRect();
        const imgs = Array.from(e.querySelectorAll("img")).map((im) => ({ alt: im.getAttribute("alt"), ok: im.complete && im.naturalWidth > 0 }));
        const interTarjeta =
          i === 0 && bc && bt && getComputedStyle(tarjeta!).position === "absolute"
            ? Math.max(0, Math.min(bc.right, bt.right) - Math.max(bc.left, bt.left)) *
              Math.max(0, Math.min(bc.bottom, bt.bottom) - Math.max(bc.top, bt.top))
            : 0;
        const interTarjetaEspacio =
          i === 0 && bt && getComputedStyle(tarjeta!).position === "absolute"
            ? Math.max(0, Math.min(b.right, bt.right) - Math.max(b.left, bt.left)) *
              Math.max(0, Math.min(b.bottom, bt.bottom) - Math.max(b.top, bt.top))
            : 0;
        return {
          i,
          ariaHidden: e.getAttribute("aria-hidden"),
          espacio: r(b),
          circulo: bc ? r(bc) : null,
          circuloDentro: bc ? bc.left >= b.left && bc.right <= b.right && bc.top >= b.top && bc.bottom <= b.bottom : false,
          svgDentroCirculo: bs && bc ? bs.left >= bc.left - 0.5 && bs.right <= bc.right + 0.5 && bs.top >= bc.top - 0.5 && bs.bottom <= bc.bottom + 0.5 : null,
          svg: bs ? r(bs) : null,
          fondo: getComputedStyle(e).backgroundImage.slice(0, 90),
          patron: !!e.querySelector(".patron-puntos") && getComputedStyle(e.querySelector(".patron-puntos")!).backgroundImage !== "none",
          imgs,
          tarjeta: i === 0 && bt ? r(bt) : null,
          areaCirculoTapadaPorTarjeta: Math.round(interTarjeta),
          areaEspacioTapadaPorTarjeta: Math.round(interTarjetaEspacio),
        };
      });
    });
    resumen.push({ ruta: "/ (fotos)", ancho, datos });
    const hero = page.locator("main .bg-gradient-to-br").first();
    await hero.screenshot({ path: path.join(SALIDA, `foto-hero-${ancho}.png`) });
    if (ancho >= 1024) {
      const seccion = page.locator("main section").first();
      await seccion.screenshot({ path: path.join(SALIDA, `hero-completo-${ancho}.png`) });
    }
    await page.locator("#c-apoyos").screenshot({ path: path.join(SALIDA, `apoyos-${ancho}.png`) });
    await ctx.close();
    expect.soft(datos.length, `@${ancho}: deben ser 4 espacios de foto`).toBe(4);
    for (const d of datos) {
      expect.soft(d.ariaHidden, `@${ancho} espacio ${d.i}: aria-hidden`).toBe("true");
      expect.soft(d.imgs.every((im) => im.alt === "" && im.ok), `@${ancho} espacio ${d.i}: imgs decorativas cargadas`).toBe(true);
      expect.soft(d.circuloDentro, `@${ancho} espacio ${d.i}: ilustración recortada`).toBe(true);
      expect.soft(d.svgDentroCirculo, `@${ancho} espacio ${d.i}: dibujo se sale del círculo`).toBe(true);
      expect.soft(d.patron, `@${ancho} espacio ${d.i}: patrón de puntos`).toBe(true);
      expect.soft(d.areaCirculoTapadaPorTarjeta, `@${ancho}: tarjeta tapa ilustración del hero`).toBe(0);
    }
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
