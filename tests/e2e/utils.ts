import {
  expect,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
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
/** Variables de .env.development.local (solo local; para calcular claves de límites y cookies en pruebas). */
export const ENV_LOCAL: Readonly<Record<string, string>> = ENV;
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
    mascara: "as•••@•••",
    nombre: "Asociado de Prueba",
    grado: "PP",
  },
  sinSolicitudes: {
    cedula: "1234567891",
    correo: "sin.solicitudes@greenalliance.test",
    mascara: "si•••@•••",
    nombre: "Asociada Sin Solicitudes",
    grado: "SI",
  },
} as const;
export type ClaveUsuario = keyof typeof USUARIOS;

export const CEDULA_NO_REGISTRADA = "9999999999";
export const MENSAJE_CODIGO_INVALIDO = "El código no es válido o ya venció";
export const TEXTO_PRIVACIDAD =
  "Si tu cédula está registrada, te enviamos un código";

// ---------------------------------------------------------------------------
// Supabase local (service role solo en la prueba, nunca en la app cliente)
// ---------------------------------------------------------------------------

async function rest(
  ruta: string,
  init: RequestInit = {},
  llave = SERVICE_KEY,
  token?: string,
) {
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

export const adminRest = (ruta: string, init: RequestInit = {}) =>
  rest(ruta, init);
export const anonRest = (ruta: string, init: RequestInit = {}) =>
  rest(ruta, init, ANON_KEY);
export const usuarioRest = (
  ruta: string,
  token: string,
  init: RequestInit = {},
) => rest(ruta, init, ANON_KEY, token);

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
  await adminRest(
    `solicitudes_afiliacion?cedula=eq.${encodeURIComponent(cedula)}`,
    {
      method: "DELETE",
    },
  );
}

/**
 * Repone el crédito de ejemplo del seed (cédula `USUARIOS.conSolicitud`,
 * $500.000 al 50 %) si otra prueba ya lo resolvió en esta misma sesión de
 * base de datos (p. ej. k-roles.spec.ts, que aprueba/rechaza los créditos
 * pendientes para probar los atajos de /admin/creditos). Una solicitud
 * resuelta es inmutable en la base (trigger `sellar_revision_solicitud`:
 * «Una solicitud ya resuelta no puede cambiar de estado»), así que en vez de
 * actualizarla se borra y se vuelve a crear igual que el seed. Sin esto, las
 * pruebas de C/E/I que dependen de que ese crédito siga «pendiente» quedan
 * frágiles según el orden en que corran los archivos de prueba.
 */
export async function restaurarCreditoDeEjemplo() {
  const { cuerpo: perfiles } = await adminRest(
    `perfiles?select=id&cedula=eq.${encodeURIComponent(USUARIOS.conSolicitud.cedula)}`,
  );
  const id = (Array.isArray(perfiles) ? perfiles : [])[0] as
    { id: string } | undefined;
  if (!id) return;
  const { cuerpo: filas } = await adminRest(
    `solicitudes_credito?select=id,estado&asociado_id=eq.${id.id}`,
  );
  const fila = (Array.isArray(filas) ? filas : [])[0] as
    { id: string; estado: string } | undefined;
  if (!fila || fila.estado === "pendiente") return;
  await adminRest(`solicitudes_credito?id=eq.${fila.id}`, { method: "DELETE" });
  await adminRest("solicitudes_credito", {
    method: "POST",
    body: JSON.stringify({
      asociado_id: id.id,
      porcentaje_devolucion: "50",
      monto_solicitado: 500000,
    }),
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
  if (!cuerpo.access_token)
    throw new Error(`No se obtuvo token para ${correo}`);
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
  const r = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${correo}"`)}&limit=20`,
  );
  const cuerpo = (await r.json()) as { messages?: MensajeMailpit[] };
  return (cuerpo.messages ?? []).sort(
    (a, b) => Date.parse(b.Created) - Date.parse(a.Created),
  );
}

/** Espera un correo con código nuevo (posterior a `desde`) y devuelve los 6 dígitos. */
export async function esperarCodigo(
  correo: string,
  desde: number,
  maxMs = 20_000,
) {
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
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
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

export async function contextoConSesion(
  browser: Browser,
  clave: ClaveUsuario,
  testInfo: TestInfo,
) {
  const crearContexto = (o: { storageState?: string } = {}) =>
    browser.newContext({ ...opcionesContexto(testInfo), ...o });
  const archivo = path.join(
    RAIZ,
    "test-results",
    ".auth",
    `${testInfo.project.name}-${clave}.json`,
  );
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

export async function capturaCompleta(
  page: Page,
  nombre: string,
  testInfo: TestInfo,
) {
  fs.mkdirSync(CARPETA_QA, { recursive: true });
  const archivo = path.join(
    CARPETA_QA,
    `${nombre}-${testInfo.project.name}.png`,
  );
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
      problemas.push(
        enOtroLado === -1 ? `FALTA: «${e}»` : `FUERA DE ORDEN: «${e}»`,
      );
    } else {
      desde = i + e.length;
    }
  }
  return problemas;
}

// ---------------------------------------------------------------------------
// Formulario de afiliación (v2: spec-fase-2.md §2 — nombres/apellidos
// separados, institución, Nequi, asesor y 3 fotos. Antes solo había un campo
// «Nombres y apellidos» sin los demás: alineado con
// components/pantallas/Afiliacion.tsx y tests/e2e/d-afiliacion.spec.ts).
// ---------------------------------------------------------------------------

export type DatosFormulario = {
  nombres: string;
  apellidos: string;
  cedula: string;
  institucion: "policia" | "ejercito" | "";
  grado: string;
  /** Cuenta de nómina v3 (spec §2.6): entidad (texto visible), tipo y número. */
  nominaEntidad: string;
  nominaTipo: "Ahorros" | "Corriente" | "";
  nominaNumero: string;
  nequi: string;
  celular: string;
  /** Correo institucional: dominio obligatorio según la institución (spec §12.3). */
  correoInstitucional: string;
  /** Correo personal: ancla el ingreso con código (spec §2.8). */
  email: string;
  /** Texto visible del `<option>`, o "" para «No tengo asesor». */
  asesor: string;
  mensaje: string;
  acepto: boolean;
};

export function datosValidos(cedula = cedulaUnica()): DatosFormulario {
  return {
    nombres: "Laura",
    apellidos: "Gómez Prueba",
    cedula,
    institucion: "policia",
    grado: "PT",
    nominaEntidad: "Bancolombia",
    nominaTipo: "Ahorros",
    nominaNumero: "12345678901",
    nequi: "3009998877",
    celular: "3104567890",
    correoInstitucional: `laura.qa.${cedula}@policia.gov.co`,
    email: `laura.qa.${cedula}@gmail.com`,
    asesor: "",
    mensaje: "Prueba automática de QA.",
    acepto: true,
  };
}

/** PNG 1×1 válido y liviano: alcanza para pasar la validación de tipo/tamaño de CampoFoto. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export function fotoDePrueba(nombre: string) {
  return { name: nombre, mimeType: "image/png" as const, buffer: PNG_1PX };
}

/**
 * Llena el formulario v3 (institución→grado, cuenta de nómina en cascada, dos
 * correos y selfie con input sr-only). Espera a que hidrate. `fotos=false` no sube fotos.
 */
export async function llenarAfiliacion(
  page: Page,
  d: Partial<DatosFormulario>,
  fotos = true,
) {
  await page.waitForLoadState("networkidle");
  if (d.nombres !== undefined) await page.getByLabel("Nombres").fill(d.nombres);
  if (d.apellidos !== undefined)
    await page.getByLabel("Apellidos").fill(d.apellidos);
  if (d.cedula !== undefined)
    await page.getByLabel("Número de cédula").fill(d.cedula);
  if (d.institucion !== undefined) {
    await page
      .locator("#af-institucion")
      .selectOption(d.institucion || { index: 0 });
  }
  if (d.grado) {
    await expect(page.locator("#af-grado")).toBeEnabled();
    await page.locator("#af-grado").selectOption(d.grado);
  }
  if (d.nominaEntidad) {
    const combo = page.locator("#af-nomina-entidad");
    await combo.click();
    await combo.fill(d.nominaEntidad);
    await page
      .getByRole("option", { name: d.nominaEntidad, exact: true })
      .first()
      .dispatchEvent("mousedown");
  }
  if (d.nominaTipo) {
    await page
      .locator('label:has(input[name="nomina_tipo"])', {
        hasText: d.nominaTipo,
      })
      .click();
  }
  if (d.nominaNumero !== undefined && d.nominaEntidad)
    await page.locator("#af-nomina-numero").fill(d.nominaNumero);
  if (d.nequi !== undefined) await page.locator("#af-nequi").fill(d.nequi);
  if (d.celular !== undefined) await page.locator("#af-cel").fill(d.celular);
  if (d.correoInstitucional !== undefined)
    await page.locator("#af-correo-inst").fill(d.correoInstitucional);
  if (d.email !== undefined) await page.locator("#af-email").fill(d.email);
  if (d.asesor !== undefined) {
    await page
      .locator("#af-asesor")
      .selectOption(d.asesor ? { label: d.asesor } : { index: 0 });
  }
  if (fotos) {
    await page
      .locator('input[name="foto_cedula_frente"]')
      .setInputFiles(fotoDePrueba("frente.png"));
    await page
      .locator('input[name="foto_cedula_reverso"]')
      .setInputFiles(fotoDePrueba("reverso.png"));
    await page
      .locator('input[name="foto_selfie"]')
      .setInputFiles(fotoDePrueba("selfie.png"));
  }
  if (d.mensaje !== undefined)
    await page.getByLabel("¿Algo que debamos saber?").fill(d.mensaje);
  if (d.acepto !== undefined)
    await page.locator("#af-datos").setChecked(d.acepto);
}
