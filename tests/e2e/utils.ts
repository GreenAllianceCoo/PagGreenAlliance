import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Utilidades compartidas de las pruebas E2E (ga-verificador-qa).
 * SOLO para el entorno local: lee .env.development.local y se niega a seguir
 * si la URL de Supabase no es 127.0.0.1/localhost.
 */

export const RAIZ = path.resolve(__dirname, "..", "..");
export const CARPETA_QA = path.join(RAIZ, "test-results", "qa");
export const MAILPIT = "http://127.0.0.1:54324";

function leerEnvLocal() {
  const archivo = path.join(RAIZ, ".env.development.local");
  const texto = fs.readFileSync(archivo, "utf8");
  const valores: Record<string, string> = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (m) valores[m[1]] = m[2].trim();
  }
  return valores;
}

const ENV = leerEnvLocal();
export const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(SUPABASE_URL)) {
  throw new Error(
    `Las pruebas E2E solo corren contra Supabase LOCAL. NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
  );
}

export const USUARIOS = {
  conSolicitud: {
    cedula: "1234567890",
    correo: "asociado.prueba@greenalliance.test",
    mascara: "as•••@greenalliance.test",
    nombre: "Asociado de Prueba",
    grado: "PP",
  },
  sinSolicitudes: {
    cedula: "1234567891",
    correo: "sin.solicitudes@greenalliance.test",
    mascara: "si•••@greenalliance.test",
    nombre: "Asociada Sin Solicitudes",
    grado: "SI",
  },
} as const;
export type ClaveUsuario = keyof typeof USUARIOS;

export const CEDULA_NO_REGISTRADA = "9999999999";
export const MENSAJE_CODIGO_INVALIDO = "El código no es válido o ya venció";
export const TEXTO_PRIVACIDAD = "Si tu cédula está registrada, te enviamos un código";

// ---------------------------------------------------------------------------
// Supabase local (service role solo en la prueba, nunca en la app cliente)
// ---------------------------------------------------------------------------

async function rest(ruta: string, init: RequestInit = {}, llave = SERVICE_KEY, token?: string) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: llave,
      Authorization: `Bearer ${token ?? llave}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const texto = await respuesta.text();
  let cuerpo: unknown = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }
  return { status: respuesta.status, cuerpo };
}

export const adminRest = (ruta: string, init: RequestInit = {}) => rest(ruta, init);
export const anonRest = (ruta: string, init: RequestInit = {}) => rest(ruta, init, ANON_KEY);
export const usuarioRest = (ruta: string, token: string, init: RequestInit = {}) =>
  rest(ruta, init, ANON_KEY, token);

/** Borra los límites de frecuencia (solo en local) para que las pruebas sean repetibles. */
export async function limpiarLimites() {
  await adminRest("limites_intentos?id=gt.0", { method: "DELETE" });
}

export type FilaAfiliacion = {
  id: string;
  nombre: string;
  cedula: string;
  grado: string;
  unidad: string | null;
  celular: string;
  email: string;
  mensaje: string | null;
  acepto_datos_at: string | null;
  estado: string;
};

export async function afiliacionesPorCedula(cedula: string) {
  const { cuerpo } = await adminRest(
    `solicitudes_afiliacion?select=*&cedula=eq.${encodeURIComponent(cedula)}`,
  );
  return (Array.isArray(cuerpo) ? cuerpo : []) as FilaAfiliacion[];
}

export async function borrarAfiliaciones(cedula: string) {
  await adminRest(`solicitudes_afiliacion?cedula=eq.${encodeURIComponent(cedula)}`, {
    method: "DELETE",
  });
}

/** Token de usuario por contraseña (seed: Prueba123!). No envía correos. */
export async function tokenDeUsuario(correo: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: "Prueba123!" }),
  });
  const cuerpo = (await r.json()) as { access_token?: string };
  if (!cuerpo.access_token) throw new Error(`No se obtuvo token para ${correo}`);
  return cuerpo.access_token;
}

/** Cédula única de 10 dígitos para cada prueba de afiliación (empieza por 7). */
export function cedulaUnica() {
  const base = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `7${base.slice(-9)}`;
}

// ---------------------------------------------------------------------------
// Mailpit (códigos de ingreso)
// ---------------------------------------------------------------------------

type MensajeMailpit = {
  ID: string;
  Created: string;
  Subject: string;
  Snippet: string;
  To: { Address: string }[];
};

export async function mensajesPara(correo: string): Promise<MensajeMailpit[]> {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}&limit=20`);
  const cuerpo = (await r.json()) as { messages?: MensajeMailpit[] };
  return (cuerpo.messages ?? []).sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
}

/** Espera un correo con código nuevo (posterior a `desde`) y devuelve los 6 dígitos. */
export async function esperarCodigo(correo: string, desde: number, maxMs = 20_000) {
  const limite = Date.now() + maxMs;
  while (Date.now() < limite) {
    const [ultimo] = await mensajesPara(correo);
    if (ultimo && Date.parse(ultimo.Created) >= desde - 2000) {
      expect(ultimo.Subject).toBe("Tu código para entrar a Green Alliance");
      const m = /\b(\d{6})\b/.exec(ultimo.Snippet);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó el código a Mailpit para ${correo}`);
}

/** Respeta los 45 s entre códigos a la misma cédula (mira el último correo en Mailpit). */
export async function esperarVentanaReenvio(correo: string) {
  const [ultimo] = await mensajesPara(correo);
  if (!ultimo) return;
  const falta = 47_000 - (Date.now() - Date.parse(ultimo.Created));
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
}

// ---------------------------------------------------------------------------
// Ingreso
// ---------------------------------------------------------------------------

export async function llenarOtp(page: Page, codigo: string) {
  const primera = page.locator('input[name="codigo-1"]');
  await primera.click();
  // Pegar: ClipboardEvent real con DataTransfer (lo maneja onPaste del componente).
  await primera.evaluate((el, texto) => {
    const dt = new DataTransfer();
    dt.setData("text", texto);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, codigo);
}

/** Paso 1 del ingreso (cédula → «Enviarme el código»). Devuelve la hora del envío. */
export async function pedirCodigo(page: Page, cedula: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Número de cédula").fill(cedula);
  const inicio = Date.now();
  await page.getByRole("button", { name: "Enviarme el código" }).click();
  await page.waitForURL("**/ingresar/codigo");
  return inicio;
}

/** Ingreso completo por la interfaz con el código de Mailpit. */
export async function ingresarPorUI(page: Page, clave: ClaveUsuario) {
  const u = USUARIOS[clave];
  await limpiarLimites();
  await esperarVentanaReenvio(u.correo);
  const inicio = await pedirCodigo(page, u.cedula);
  const codigo = await esperarCodigo(u.correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL("**/cuenta");
}

/**
 * Sesión reutilizable por proyecto y usuario (test-results/.auth). Si la
 * sesión guardada ya no sirve (p. ej. después de «Salir»), ingresa de nuevo.
 */
export function opcionesContexto(testInfo: TestInfo) {
  const u = testInfo.project.use;
  return {
    baseURL: u.baseURL,
    viewport: u.viewport,
    userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
    locale: u.locale,
    timezoneId: u.timezoneId,
  };
}

export async function contextoConSesion(browser: Browser, clave: ClaveUsuario, testInfo: TestInfo) {
  const crearContexto = (o: { storageState?: string } = {}) =>
    browser.newContext({ ...opcionesContexto(testInfo), ...o });
  const archivo = path.join(RAIZ, "test-results", ".auth", `${testInfo.project.name}-${clave}.json`);
  if (fs.existsSync(archivo)) {
    const ctx = await crearContexto({ storageState: archivo });
    const p = await ctx.newPage();
    await p.goto("/cuenta");
    if (p.url().endsWith("/cuenta")) {
      await p.close();
      return ctx;
    }
    await ctx.close();
  }
  const ctx = await crearContexto();
  const p = await ctx.newPage();
  await ingresarPorUI(p, clave);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  await ctx.storageState({ path: archivo });
  await p.close();
  return ctx;
}

// ---------------------------------------------------------------------------
// Varios
// ---------------------------------------------------------------------------

export function esEscritorio(testInfo: TestInfo) {
  return testInfo.project.name === "escritorio";
}

export async function capturaCompleta(page: Page, nombre: string, testInfo: TestInfo) {
  fs.mkdirSync(CARPETA_QA, { recursive: true });
  const archivo = path.join(CARPETA_QA, `${nombre}-${testInfo.project.name}.png`);
  await page.screenshot({ path: archivo, fullPage: true });
  return archivo;
}

/** Texto visible de la página en orden del DOM, en una sola línea. */
export async function textoVisible(page: Page) {
  const t = await page.locator("body").innerText();
  return t.replace(/\s+/g, " ");
}

/** Verifica que los textos aparecen, y en ese orden. Devuelve los que faltan o están fuera de orden. */
export function revisarOrden(texto: string, esperados: string[]) {
  const problemas: string[] = [];
  let desde = 0;
  for (const e of esperados) {
    const i = texto.indexOf(e, desde);
    if (i === -1) {
      const enOtroLado = texto.indexOf(e);
      problemas.push(enOtroLado === -1 ? `FALTA: «${e}»` : `FUERA DE ORDEN: «${e}»`);
    } else {
      desde = i + e.length;
    }
  }
  return problemas;
}

// ---------------------------------------------------------------------------
// Formulario de afiliación
// ---------------------------------------------------------------------------

export type DatosFormulario = {
  nombre: string;
  cedula: string;
  grado: string;
  unidad: string;
  celular: string;
  email: string;
  mensaje: string;
  acepto: boolean;
};

export function datosValidos(cedula = cedulaUnica()): DatosFormulario {
  return {
    nombre: "Laura Gómez Prueba",
    cedula,
    grado: "PT",
    unidad: "Estación Centro",
    celular: "3104567890",
    email: "laura.qa@correo.com",
    mensaje: "Prueba automática de QA.",
    acepto: true,
  };
}

/** Llena el formulario (espera a que hidrate: el orden de campos cambia en escritorio). */
export async function llenarAfiliacion(page: Page, d: Partial<DatosFormulario>) {
  await page.waitForLoadState("networkidle");
  if (d.nombre !== undefined) await page.getByLabel("Nombres y apellidos").fill(d.nombre);
  if (d.cedula !== undefined) await page.getByLabel("Número de cédula").fill(d.cedula);
  if (d.grado !== undefined) await page.getByLabel("Grado").selectOption(d.grado);
  if (d.unidad !== undefined) await page.getByLabel("Unidad o dependencia").fill(d.unidad);
  if (d.celular !== undefined) await page.getByLabel("Celular (WhatsApp)").fill(d.celular);
  if (d.email !== undefined) await page.getByLabel("Correo electrónico").fill(d.email);
  if (d.mensaje !== undefined) await page.getByLabel("¿Algo que debamos saber?").fill(d.mensaje);
  if (d.acepto !== undefined) await page.locator("#af-datos").setChecked(d.acepto);
}
