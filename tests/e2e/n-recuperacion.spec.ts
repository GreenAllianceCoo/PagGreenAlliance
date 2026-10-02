/**
 * N. Recuperación de acceso (contrato, fase 2), contra Supabase local + Mailpit.
 *  1. /ingresar/recuperar responde IGUAL para una cédula existente y una inexistente.
 *  2. La solicitud queda en /admin/alertas; el admin cambia el correo de ingreso.
 *  3. El asociado ingresa con el correo nuevo (código en Mailpit).
 * Crea su propio asociado (cédula única) y lo borra al final.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  ANON_KEY,
  cedulaUnica,
  CEDULA_NO_REGISTRADA,
  ENV_LOCAL,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  mensajesPara,
  pedirCodigo,
  SUPABASE_URL,
} from "./utils";

test.describe.configure({ mode: "serial" });

const MENSAJE = "Si los datos coinciden, la cooperativa te contactará para verificar tu identidad";
const CEDULA_ADMIN = "1234567899";
const CORREO_ADMIN = "admin.prueba@greenalliance.test";

const SERVICE_KEY = ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function authAdmin(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/${ruta}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY || ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

type Asociado = { id: string; cedula: string; nombre: string; correoViejo: string; correoNuevo: string };

async function ingresar(page: Page, cedula: string, correo: string, destino: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

let asociado: Asociado;

test.beforeAll(async ({}, testInfo) => {
  const cedula = cedulaUnica();
  const sufijo = `${testInfo.project.name}-${cedula}`;
  asociado = {
    id: "",
    cedula,
    nombre: `Asociado Recuperacion ${cedula}`,
    correoViejo: `rec.viejo.${sufijo}@greenalliance.test`,
    correoNuevo: `rec.nuevo.${sufijo}@greenalliance.test`,
  };
  const { status, cuerpo } = await authAdmin("users", {
    method: "POST",
    body: JSON.stringify({
      email: asociado.correoViejo,
      email_confirm: true,
      app_metadata: { cedula, grado: "PT" },
      user_metadata: { nombre_completo: asociado.nombre },
    }),
  });
  expect(status, JSON.stringify(cuerpo)).toBe(200);
  asociado.id = String(cuerpo.id);
  // Celular del perfil: el que la persona escribirá en el formulario.
  await adminRest(`perfiles?id=eq.${asociado.id}`, { method: "PATCH", body: JSON.stringify({ telefono: "3105550101" }) });
});

test.afterAll(async () => {
  if (asociado?.id) {
    await adminRest(`solicitudes_recuperacion_acceso?perfil_id=eq.${asociado.id}`, { method: "DELETE" });
    await authAdmin(`users/${asociado.id}`, { method: "DELETE" });
  }
});

async function enviarFormulario(page: Page, cedula: string) {
  await page.goto("/ingresar/recuperar");
  await page.getByLabel("Número de cédula").fill(cedula);
  await page.getByLabel("Correo nuevo").fill(asociado.correoNuevo);
  await page.getByLabel("Celular (WhatsApp)").fill("3105550101");
  await page.getByLabel("¿Qué pasó?").fill("Perdí el acceso a mi correo anterior");
  const t0 = Date.now();
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("status").filter({ hasText: MENSAJE })).toBeVisible();
  return { ms: Date.now() - t0, texto: ((await page.locator("main").innerText()) ?? "").replace(/\s+/g, " ") };
}

test.describe("N1 · formulario público", () => {
  test("enlace en /ingresar y validación por campo", async ({ page }) => {
    await limpiarLimites();
    await page.goto("/ingresar");
    await page.getByRole("link", { name: "¿Ya no tienes acceso a tu correo?" }).click();
    await page.waitForURL("**/ingresar/recuperar");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    for (const campo of ["cedula", "correo", "celular", "motivo"]) {
      await expect(page.locator(`#${campo}-error`)).toBeVisible();
      await expect(page.locator(`#${campo}`)).toHaveAttribute("aria-invalid", "true");
    }
    await expect(page.locator("#cedula")).toBeFocused();
  });

  test("misma respuesta (y tiempo parecido) exista o no la cédula; solo se registra la real", async ({ page }) => {
    await limpiarLimites();
    const noExiste = await enviarFormulario(page, CEDULA_NO_REGISTRADA);
    const existe = await enviarFormulario(page, asociado.cedula);
    expect(existe.texto).toBe(noExiste.texto);
    expect(Math.abs(existe.ms - noExiste.ms)).toBeLessThan(1500);

    const { cuerpo: real } = await adminRest(`solicitudes_recuperacion_acceso?select=*&cedula=eq.${asociado.cedula}`);
    expect(Array.isArray(real) && real.length).toBe(1);
    expect((real as { estado: string; celular_coincide: boolean }[])[0]).toMatchObject({
      estado: "pendiente",
      celular_coincide: true,
    });
    const { cuerpo: falsa } = await adminRest(`solicitudes_recuperacion_acceso?select=id&cedula=eq.${CEDULA_NO_REGISTRADA}`);
    expect(falsa).toEqual([]);

    // Repetir el formulario no crea otra pendiente y responde igual.
    const repetida = await enviarFormulario(page, asociado.cedula);
    expect(repetida.texto).toBe(noExiste.texto);
    const { cuerpo: otra } = await adminRest(`solicitudes_recuperacion_acceso?select=id&cedula=eq.${asociado.cedula}`);
    expect(Array.isArray(otra) && otra.length).toBe(1);
  });
});

test.describe("N2 · admin cambia el correo y el asociado ingresa con el nuevo", () => {
  test("el admin ve la solicitud, cambia el correo y la solicitud queda atendida", async ({ page }) => {
    test.setTimeout(180_000);
    await ingresar(page, CEDULA_ADMIN, CORREO_ADMIN, "/admin");
    await page.goto("/admin/alertas");
    const fila = page.getByTestId("fila-recuperacion").filter({ hasText: asociado.nombre });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(asociado.correoNuevo);
    await expect(fila).toContainText("coincide con el de su perfil");

    await fila.getByRole("button", { name: "Cambiar correo de ingreso" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Correo nuevo")).toHaveValue(asociado.correoNuevo);

    // Motivo obligatorio: sin motivo, error en el campo y foco.
    await dialogo.getByRole("button", { name: "Cambiar correo" }).click();
    await expect(dialogo.locator('[id$="-motivo-error"]')).toBeVisible();
    await expect(dialogo.getByLabel("Motivo")).toBeFocused();

    await dialogo.getByLabel("Motivo").fill("Verificado por llamada al número registrado");
    await dialogo.getByRole("button", { name: "Cambiar correo" }).click();
    // Al quedar atendida, la solicitud sale de la bandeja de pendientes.
    await expect(fila).toHaveCount(0, { timeout: 15_000 });

    const { cuerpo: sol } = await adminRest(`solicitudes_recuperacion_acceso?select=estado,resuelta_por&cedula=eq.${asociado.cedula}`);
    expect((sol as { estado: string; resuelta_por: string | null }[])[0].estado).toBe("atendida");
    expect((sol as { resuelta_por: string | null }[])[0].resuelta_por).not.toBeNull();
    const { cuerpo: hist } = await adminRest(`historial_cambio_correo_ingreso?select=origen,motivo&perfil_id=eq.${asociado.id}`);
    expect(hist).toEqual([{ origen: "admin", motivo: "Verificado por llamada al número registrado" }]);

    // La ficha del asociado muestra el historial.
    await page.goto(`/admin/asociados/${asociado.id}`);
    await expect(page.getByText("Cambió el correo de ingreso")).toBeVisible();
  });

  test("el asociado ingresa con el correo nuevo y el viejo ya no recibe código", async ({ page }) => {
    test.setTimeout(180_000);
    await ingresar(page, asociado.cedula, asociado.correoNuevo, "/cuenta");
    await expect(page).toHaveURL(/\/cuenta$/);
    expect((await mensajesPara(asociado.correoViejo)).length).toBe(0);
  });
});
