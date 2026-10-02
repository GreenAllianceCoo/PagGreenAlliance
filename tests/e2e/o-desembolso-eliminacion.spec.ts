/**
 * O. Comprobante de desembolso y eliminación (anonimización) de un asociado
 * (pedidos de Sebas, reunión 1-oct), contra Supabase local + Mailpit.
 *
 *  O1. Marcar desembolsado con comprobante (PDF) → queda guardado y el admin lo ve.
 *  O2. Reemplazar el comprobante después (PNG): historial, archivo viejo borrado, «Ver comprobante».
 *  O3. Privacidad: el asociado lee SI hay comprobante pero no la ruta; el bucket es privado; las RPC no se llaman desde el navegador.
 *  O4. Eliminar definitivamente: activo = bloqueado; baja; motivo y casilla obligatorios;
 *      código equivocado (intentos); código correcto → anonimiza, borra fotos y usuario de Auth.
 *
 * Crea su propio asociado (cédula única). En local no sale correo con el código (no hay
 * RESEND_API_KEY): la prueba fija en la base el HMAC de un código conocido, igual que lo
 * calcularía la app (lib/eliminacion.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  ANON_KEY,
  cedulaUnica,
  ENV_LOCAL,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarOtp,
  opcionesContexto,
  pedirCodigo,
  SUPABASE_URL,
  tokenDeUsuario,
  usuarioRest,
} from "./utils";
import { hashCodigoEliminacion } from "../../lib/eliminacion";

test.describe.configure({ mode: "serial" });

const CEDULA_ADMIN = "1234567899";
const CORREO_ADMIN = "admin.prueba@greenalliance.test";
const SERVICE_KEY = ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SECRETO = ENV_LOCAL.LIMITE_HMAC_SECRET ?? "";
const CODIGO = "123456";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

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

async function rpc(nombre: string, token: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  return { status: r.status, cuerpo: texto ? (JSON.parse(texto) as unknown) : null };
}

/** Sube un archivo al Storage local con la llave de servicio (preparar datos de la prueba). */
async function subirAStorage(bucket: string, ruta: string, cuerpo: Buffer, tipo: string) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${ruta}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": tipo },
    body: new Uint8Array(cuerpo),
  });
  expect(r.status, await r.text()).toBeLessThan(300);
}

/** true si el objeto existe (se lee con la llave de servicio). */
async function existeEnStorage(bucket: string, ruta: string) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${ruta}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return r.status === 200;
}

async function ingresarAdmin(page: Page) {
  await limpiarLimites();
  await esperarVentanaReenvio(CORREO_ADMIN);
  const inicio = await pedirCodigo(page, CEDULA_ADMIN);
  const codigo = await esperarCodigo(CORREO_ADMIN, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL("**/admin");
}

type Asociado = { id: string; cedula: string; correo: string; nombre: string; credito: string; fotos: string[] };
let a: Asociado;
let adminId = "";
let pagina: Page;

test.beforeAll(async ({ browser }, testInfo) => {
  const cedula = cedulaUnica();
  const sufijo = `${testInfo.project.name}-${cedula}`;
  a = {
    id: "",
    cedula,
    correo: `desembolso.${sufijo}@greenalliance.test`,
    nombre: `Asociado Desembolso ${cedula}`,
    credito: "",
    fotos: [],
  };
  const creado = await authAdmin("users", {
    method: "POST",
    body: JSON.stringify({
      email: a.correo,
      email_confirm: true,
      app_metadata: { cedula, grado: "PT" },
      user_metadata: { nombre_completo: a.nombre },
    }),
  });
  expect(creado.status, JSON.stringify(creado.cuerpo)).toBe(200);
  a.id = String(creado.cuerpo.id);
  await adminRest(`perfiles?id=eq.${a.id}`, { method: "PATCH", body: JSON.stringify({ telefono: "3105550202" }) });

  // Proceso «operando» (sin eso no se puede crear una solicitud) y un crédito aprobado.
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const proceso = await adminRest("procesos_ejecutivos", {
    method: "POST",
    body: JSON.stringify({ asociado_id: a.id, estado: "operando", fecha_inicio_embargo: hoy }),
  });
  if (proceso.status >= 300) {
    const upd = await adminRest(`procesos_ejecutivos?asociado_id=eq.${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: "operando", fecha_inicio_embargo: hoy }),
    });
    expect(upd.status, JSON.stringify(upd.cuerpo)).toBeLessThan(300);
  }
  const credito = await adminRest("solicitudes_credito", {
    method: "POST",
    body: JSON.stringify({ asociado_id: a.id, porcentaje_devolucion: "50", monto_solicitado: 500000 }),
  });
  expect(credito.status, JSON.stringify(credito.cuerpo)).toBeLessThan(300);
  a.credito = (credito.cuerpo as { id: string }[])[0].id;
  const { cuerpo: admins } = await adminRest(`perfiles?select=id&cedula=eq.${CEDULA_ADMIN}`);
  adminId = (admins as { id: string }[])[0].id;
  const token = await tokenDeUsuario(CORREO_ADMIN);
  const ap = await usuarioRest(`solicitudes_credito?id=eq.${a.credito}`, token, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ estado: "aprobado" }),
  });
  expect(ap.status, JSON.stringify(ap.cuerpo)).toBeLessThan(300);

  // Afiliación con fotos en Storage (para comprobar que se borran al eliminar).
  const solicitudAfiliacion = crypto.randomUUID();
  a.fotos = ["frente.png", "reverso.png", "selfie.png"].map((f) => `solicitudes/${solicitudAfiliacion}/${f}`);
  for (const ruta of a.fotos) await subirAStorage("afiliacion-documentos", ruta, PNG, "image/png");
  const af = await adminRest("solicitudes_afiliacion", {
    method: "POST",
    body: JSON.stringify({
      id: solicitudAfiliacion,
      nombres: "Asociado",
      apellidos: "Desembolso",
      cedula,
      grado: "PT",
      institucion: "policia",
      celular: "3105550202",
      nequi: "3105550202",
      email: a.correo,
      foto_cedula_frente: `afiliacion-documentos/${a.fotos[0]}`,
      foto_cedula_reverso: `afiliacion-documentos/${a.fotos[1]}`,
      foto_selfie: `afiliacion-documentos/${a.fotos[2]}`,
      acepto_datos_at: new Date().toISOString(),
      estado: "aprobada",
    }),
  });
  expect(af.status, JSON.stringify(af.cuerpo)).toBeLessThan(300);

  const ctx = await browser.newContext(opcionesContexto(testInfo));
  pagina = await ctx.newPage();
  await ingresarAdmin(pagina);
});

test.afterAll(async () => {
  // El crédito se borra para no alterar las cifras de otras pruebas (el perfil anonimizado queda inactivo y sin cifras).
  if (a?.id) {
    await adminRest(`historial_solicitudes?entidad_id=eq.${a.credito}`, { method: "DELETE" });
    await adminRest(`solicitudes_credito?asociado_id=eq.${a.id}`, { method: "DELETE" });
    const { cuerpo } = await adminRest(`perfiles?select=eliminado_at&id=eq.${a.id}`);
    if (!(cuerpo as { eliminado_at: string | null }[])[0]?.eliminado_at) await authAdmin(`users/${a.id}`, { method: "DELETE" });
  }
  await pagina?.context().close();
});

async function abrirCredito(page: Page) {
  await page.goto("/admin/creditos?estado=aprobado");
  await page.getByRole("button", { name: new RegExp(a.nombre) }).click();
}

test.describe("O1 · desembolso con comprobante", () => {
  test("el admin marca desembolsado y sube el comprobante (PDF) en el mismo paso", async () => {
    test.setTimeout(120_000);
    await abrirCredito(pagina);
    await pagina.getByRole("button", { name: "Marcar desembolsado" }).click();

    // El archivo es opcional pero se valida: un tipo no permitido muestra el error en el campo.
    const campo = pagina.getByLabel(/Comprobante de la transferencia/);
    await campo.setInputFiles({ name: "malo.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(pagina.locator('[id^="desembolso-comprobante-"][id$="-error"]')).toContainText("JPG, PNG o WEBP, o un PDF");
    await pagina.getByRole("button", { name: "Confirmar desembolso" }).click();
    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute("aria-invalid", "true");

    await campo.setInputFiles({ name: "transferencia.pdf", mimeType: "application/pdf", buffer: PDF });
    await pagina.getByRole("button", { name: "Confirmar desembolso" }).click();
    await expect(pagina.getByRole("status").filter({ hasText: "Desembolso registrado con su comprobante." })).toBeVisible({
      timeout: 30_000,
    });
    await expect(pagina.getByText("Desembolsado", { exact: true }).first()).toBeVisible();
    await expect(pagina.getByTestId("comprobante-admin").getByRole("button", { name: "Ver comprobante" })).toBeVisible();

    const { cuerpo } = await adminRest(
      `solicitudes_credito?select=comprobante_path,comprobante_subido_at,fecha_desembolso&id=eq.${a.credito}`,
    );
    const fila = (cuerpo as { comprobante_path: string; comprobante_subido_at: string; fecha_desembolso: string }[])[0];
    expect(fila.fecha_desembolso).toBeTruthy();
    expect(fila.comprobante_path).toMatch(new RegExp(`^${a.credito}/[0-9a-f-]{36}\\.pdf$`));
    expect(await existeEnStorage("comprobantes-desembolso", fila.comprobante_path)).toBe(true);
  });
});

test.describe("O2 · reemplazar el comprobante", () => {
  test("sube otro (PNG), el viejo se borra, queda en el historial y «Ver comprobante» abre una URL firmada", async () => {
    test.setTimeout(120_000);
    const { cuerpo: antes } = await adminRest(`solicitudes_credito?select=comprobante_path&id=eq.${a.credito}`);
    const rutaVieja = (antes as { comprobante_path: string }[])[0].comprobante_path;

    await abrirCredito(pagina);
    const caja = pagina.getByTestId("comprobante-admin");
    // Sin archivo: error por campo y foco.
    await caja.getByRole("button", { name: "Reemplazar", exact: true }).click();
    await expect(caja.getByLabel("Reemplazar comprobante")).toBeFocused();
    await expect(caja.getByText("Elige el archivo del comprobante.")).toBeVisible();

    await caja.getByLabel("Reemplazar comprobante").setInputFiles({ name: "nuevo.png", mimeType: "image/png", buffer: PNG });
    await caja.getByRole("button", { name: "Reemplazar", exact: true }).click();
    await expect(pagina.getByRole("status").filter({ hasText: "Comprobante guardado." })).toBeVisible({ timeout: 30_000 });

    const { cuerpo } = await adminRest(`solicitudes_credito?select=comprobante_path&id=eq.${a.credito}`);
    const rutaNueva = (cuerpo as { comprobante_path: string }[])[0].comprobante_path;
    expect(rutaNueva).toMatch(/\.png$/);
    expect(rutaNueva).not.toBe(rutaVieja);
    expect(await existeEnStorage("comprobantes-desembolso", rutaNueva)).toBe(true);
    expect(await existeEnStorage("comprobantes-desembolso", rutaVieja)).toBe(false);

    const { cuerpo: hist } = await adminRest(
      `historial_solicitudes?select=detalle&entidad_id=eq.${a.credito}&accion=eq.comprobante_desembolso`,
    );
    expect((hist as { detalle: string }[]).map((h) => h.detalle).sort()).toEqual(["Comprobante reemplazado", "Comprobante subido"]);

    await pagina.reload();
    await pagina.getByRole("button", { name: new RegExp(a.nombre) }).click();
    const [pestana] = await Promise.all([
      pagina.context().waitForEvent("page"),
      pagina.getByTestId("comprobante-admin").getByRole("button", { name: "Ver comprobante" }).click(),
    ]);
    await pestana.waitForURL(/\/storage\/v1\/object\/sign\/comprobantes-desembolso\//, { timeout: 20_000 });
    await pestana.close();
  });
});

test.describe("O3 · privacidad del comprobante", () => {
  test("el asociado lee SI hay comprobante pero no la ruta; el bucket es privado; las RPC no se llaman desde el navegador", async () => {
    const tokenAsociado = await tokenDeUsuario(a.correo).catch(() => null);
    // Los usuarios creados por la API no tienen contraseña: se fija para poder leer con su sesión.
    if (!tokenAsociado) {
      const set = await authAdmin(`users/${a.id}`, { method: "PUT", body: JSON.stringify({ password: "Prueba123!" }) });
      expect(set.status).toBe(200);
    }
    const token = await tokenDeUsuario(a.correo);

    const ok = await usuarioRest(`solicitudes_credito?select=id,comprobante_subido_at&id=eq.${a.credito}`, token);
    expect(ok.status).toBe(200);
    expect((ok.cuerpo as { comprobante_subido_at: string | null }[])[0].comprobante_subido_at).toBeTruthy();
    const ruta = await usuarioRest(`solicitudes_credito?select=comprobante_path&id=eq.${a.credito}`, token);
    expect(ruta.status).toBeGreaterThanOrEqual(400); // permiso denegado por columna

    const { cuerpo } = await adminRest(`solicitudes_credito?select=comprobante_path&id=eq.${a.credito}`);
    const path = (cuerpo as { comprobante_path: string }[])[0].comprobante_path;
    for (const url of [
      `${SUPABASE_URL}/storage/v1/object/public/comprobantes-desembolso/${path}`,
      `${SUPABASE_URL}/storage/v1/object/authenticated/comprobantes-desembolso/${path}`,
    ]) {
      const anon = await fetch(url, { headers: { apikey: ANON_KEY } });
      expect(anon.status, url).toBeGreaterThanOrEqual(400);
      const conSesion = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
      expect(conSesion.status, url).toBeGreaterThanOrEqual(400);
    }

    // Las funciones de eliminación son solo del servidor: ni un admin las llama con su sesión.
    const admin = await tokenDeUsuario(CORREO_ADMIN);
    for (const t of [token, admin]) {
      const r = await rpc("admin_confirmar_eliminacion", t, {
        p_admin_id: adminId,
        p_solicitud_id: crypto.randomUUID(),
        p_codigo_hash: "a".repeat(64),
      });
      expect(r.status).toBeGreaterThanOrEqual(400);
      const s = await rpc("admin_solicitar_eliminacion", t, {
        p_admin_id: adminId,
        p_asociado_id: a.id,
        p_motivo: "Intento directo",
        p_codigo_hash: "a".repeat(64),
      });
      expect(s.status).toBeGreaterThanOrEqual(400);
    }
    // Y quien no es admin no sube comprobantes.
    const sube = await rpc("admin_registrar_comprobante", token, { p_solicitud_id: a.credito, p_ruta: `${a.credito}/${crypto.randomUUID()}.pdf` });
    expect(sube.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("O4 · eliminar definitivamente (anonimizar)", () => {
  test("con el asociado activo el botón está bloqueado y explica por qué", async () => {
    await pagina.goto(`/admin/asociados/${a.id}`);
    await expect(pagina.getByRole("button", { name: "Eliminar definitivamente" })).toBeDisabled();
    await expect(pagina.getByText("primero dala de baja")).toBeVisible();
  });

  test("tras la baja: motivo y casilla obligatorios, código equivocado (con intentos) y código correcto", async () => {
    test.setTimeout(180_000);
    const admin = await tokenDeUsuario(CORREO_ADMIN);
    const baja = await rpc("admin_cambiar_estado_asociado", admin, {
      p_asociado_id: a.id,
      p_activo: false,
      p_motivo: "Cumplió su ciclo (prueba automática)",
    });
    expect(baja.status, JSON.stringify(baja.cuerpo)).toBeLessThan(300);

    await pagina.goto(`/admin/asociados/${a.id}`);
    await pagina.getByRole("button", { name: "Eliminar definitivamente" }).click();
    const dialogo = pagina.getByRole("dialog");
    await expect(dialogo.getByText("Esto no se puede deshacer.")).toBeVisible();

    // Sin motivo ni casilla: errores por campo y foco al primero.
    await dialogo.getByRole("button", { name: "Enviarme el código" }).click();
    await expect(dialogo.locator('[id$="-motivo-error"]')).toBeVisible();
    await expect(dialogo.locator('[id$="-entiendo-error"]')).toBeVisible();
    await expect(dialogo.getByLabel(/Motivo/)).toBeFocused();
    await expect(dialogo.getByLabel(/Motivo/)).toHaveAttribute("aria-invalid", "true");

    await dialogo.getByLabel(/Motivo/).fill("Cumplió su ciclo y pidió borrar sus datos");
    await dialogo.getByLabel(/Entiendo que se borrarán/).check();
    await dialogo.getByRole("button", { name: "Enviarme el código" }).click();

    // Paso 2: el código «llegó» al correo del admin (en local no sale: se fija su HMAC conocido).
    await expect(dialogo.getByLabel("Código de 6 números")).toBeVisible({ timeout: 20_000 });
    await expect(dialogo.getByText(/Te enviamos un código de 6 números a/)).toContainText("ad•••@•••");
    const { cuerpo: sol } = await adminRest(
      `solicitudes_eliminacion_asociado?select=id,estado,codigo_hash,motivo&asociado_id=eq.${a.id}&estado=eq.pendiente`,
    );
    expect((sol as unknown[]).length).toBe(1);
    const pedido = (sol as { id: string; codigo_hash: string; motivo: string }[])[0];
    expect(pedido.codigo_hash).toMatch(/^[0-9a-f]{64}$/);
    await adminRest(`solicitudes_eliminacion_asociado?id=eq.${pedido.id}`, {
      method: "PATCH",
      body: JSON.stringify({ codigo_hash: hashCodigoEliminacion(CODIGO, adminId, a.id, SECRETO) }),
    });

    // Código equivocado: error con intentos restantes y nada se borra.
    await dialogo.getByLabel("Código de 6 números").fill("000000");
    await dialogo.getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(dialogo.locator('[id$="-codigo-error"]')).toContainText("Te quedan 2 intentos");
    await expect(dialogo.getByLabel("Código de 6 números")).toBeFocused();
    const { cuerpo: intacto } = await adminRest(`perfiles?select=nombre_completo&id=eq.${a.id}`);
    expect((intacto as { nombre_completo: string }[])[0].nombre_completo).toBe(a.nombre);

    // Código correcto.
    await dialogo.getByLabel("Código de 6 números").fill(CODIGO);
    await dialogo.getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(dialogo.getByRole("heading", { name: "Asociado eliminado" })).toBeVisible({ timeout: 30_000 });

    // Anonimizado en la base…
    const { cuerpo: perfil } = await adminRest(
      `perfiles?select=nombre_completo,cedula,telefono,correo_institucional,nomina_numero,activo,eliminado_at&id=eq.${a.id}`,
    );
    const p = (perfil as Record<string, unknown>[])[0];
    expect(p.nombre_completo).toBe("Asociado eliminado");
    expect(p.cedula).toMatch(/^ELIMINADO-[0-9a-f]{12}$/);
    expect(p.telefono).toBeNull();
    expect(p.correo_institucional).toBeNull();
    expect(p.nomina_numero).toBeNull();
    expect(p.activo).toBe(false);
    expect(p.eliminado_at).toBeTruthy();
    const { cuerpo: afil } = await adminRest(`solicitudes_afiliacion?select=id&email=eq.${encodeURIComponent(a.correo)}`);
    expect(afil).toEqual([]);
    // …las cifras se conservan ligadas al registro anónimo…
    const { cuerpo: cred } = await adminRest(`solicitudes_credito?select=monto_solicitado,fecha_desembolso&asociado_id=eq.${a.id}`);
    expect((cred as { monto_solicitado: number }[])[0].monto_solicitado).toBe(500000);
    // …el log guarda quién, cuándo y por qué (sin datos personales)…
    const { cuerpo: log } = await adminRest(`eliminaciones_asociados?select=admin_id,motivo,created_at&asociado_id=eq.${a.id}`);
    expect(log).toEqual([
      expect.objectContaining({ admin_id: adminId, motivo: "Cumplió su ciclo y pidió borrar sus datos" }),
    ]);
    expect(JSON.stringify(log)).not.toContain(a.cedula);
    // …se borraron las fotos de la afiliación y el usuario de Auth…
    for (const ruta of a.fotos) expect(await existeEnStorage("afiliacion-documentos", ruta)).toBe(false);
    const auth = await authAdmin(`users/${a.id}`);
    expect(auth.status).toBe(404);
    // …y el comprobante de desembolso NO se borró: queda 30 días con borrado programado.
    const { cuerpo: conComprobante } = await adminRest(
      `solicitudes_credito?select=comprobante_path,comprobante_borrar_at&asociado_id=eq.${a.id}`,
    );
    const guardado = (conComprobante as { comprobante_path: string | null; comprobante_borrar_at: string | null }[])[0];
    expect(guardado.comprobante_path).toBeTruthy();
    const dias = (new Date(guardado.comprobante_borrar_at as string).getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(29.9);
    expect(dias).toBeLessThan(30.1);
    expect(await existeEnStorage("comprobantes-desembolso", guardado.comprobante_path as string)).toBe(true);
    const intentoLogin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: a.correo, password: "Prueba123!" }),
    });
    expect(intentoLogin.status).toBeGreaterThanOrEqual(400);

    // La ficha ahora dice «Asociado eliminado» y ya no sale en la lista.
    await dialogo.getByRole("link", { name: "Volver a asociados" }).click();
    await pagina.waitForURL("**/admin/asociados");
    await expect(pagina.getByText(a.nombre)).toHaveCount(0);
    await pagina.goto(`/admin/asociados/${a.id}`);
    await expect(pagina.getByText("Asociado eliminado.")).toBeVisible();
    // El admin ve «Comprobantes que se borrarán el DD/MM/AAAA» con «Ver» (URL firmada).
    const vence = new Date(guardado.comprobante_borrar_at as string)
      .toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" });
    const caja = pagina.getByTestId("comprobantes-por-borrar");
    await expect(caja.getByText(`Comprobantes que se borrarán el ${vence}`)).toBeVisible();
    const [pestana] = await Promise.all([pagina.context().waitForEvent("page"), caja.getByRole("button", { name: "Ver" }).click()]);
    await pestana.waitForURL(/\/storage\/v1\/object\/sign\/comprobantes-desembolso\//, { timeout: 20_000 });
    await pestana.close();
    await expect(pagina.getByRole("button", { name: "Eliminar definitivamente" })).toHaveCount(0);
  });
});
