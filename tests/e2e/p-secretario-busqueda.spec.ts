/**
 * P. Rol «secretario» y búsqueda general de asesores (reunión del 1-oct).
 * Secretario de prueba 1234567896 (seed.sql), admin 1234567899, asesor
 * 1234567892 y asociados 1234567890 / 1234567891. Solo contra Supabase LOCAL.
 *
 * Corre en escritorio y en celular. Crea sus propios datos (una afiliación
 * pendiente y un secretario nuevo) y los borra al terminar.
 */
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import {
  adminRest,
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

const SECRETARIO = { cedula: "1234567896", correo: "secretario.prueba@greenalliance.test" };
const ADMIN = { cedula: "1234567899", correo: "admin.prueba@greenalliance.test" };
const ASESOR = { cedula: "1234567892", correo: "asesor.prueba@greenalliance.test" };
const ID_SECRETARIO = "5ec7e7a2-1b9d-4c0e-8a3f-6d2b7c9e4f10";

async function ingresar(page: Page, cedula: string, correo: string, destino: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

/**
 * Cada prueba trae una página nueva sin sesión; para no pedir un código por
 * prueba (45 s entre códigos de la misma cédula), la sesión de cada usuario se
 * reutiliza dentro del archivo, por proyecto (escritorio / celular).
 */
const sesiones = new Map<string, Page>();
async function sesion(
  browser: Browser,
  testInfo: TestInfo,
  usuario: { cedula: string; correo: string },
  destino: string,
) {
  const clave = `${testInfo.project.name}-${usuario.cedula}`;
  const existente = sesiones.get(clave);
  if (existente && !existente.isClosed()) return existente;
  const contexto = await browser.newContext(opcionesContexto(testInfo));
  const pagina = await contexto.newPage();
  await ingresar(pagina, usuario.cedula, usuario.correo, destino);
  sesiones.set(clave, pagina);
  return pagina;
}

test.describe.configure({ mode: "serial" });

const cedulaSolicitud = cedulaUnica();
let idSolicitud = "";
let cedulaNuevoSecretario = "";

test.beforeAll(async () => {
  const { cuerpo } = await adminRest("solicitudes_afiliacion", {
    method: "POST",
    body: JSON.stringify({
      nombres: "Persona",
      apellidos: "Para Secretaria",
      cedula: cedulaSolicitud,
      grado: "PT",
      institucion: "policia",
      celular: "3001230000",
      nequi: "3001230000",
      email: `p.secretaria.${cedulaSolicitud}@prueba.test`,
      foto_cedula_frente: "afiliacion-documentos/p/f.jpg",
      foto_cedula_reverso: "afiliacion-documentos/p/r.jpg",
      foto_selfie: "afiliacion-documentos/p/s.jpg",
      acepto_datos_at: new Date().toISOString(),
    }),
  });
  idSolicitud = (cuerpo as { id: string }[])[0].id;
});

test.afterAll(async () => {
  for (const p of sesiones.values()) await p.context().close().catch(() => {});
  sesiones.clear();
  await adminRest(`solicitudes_afiliacion?cedula=eq.${cedulaSolicitud}`, { method: "DELETE" });
  if (cedulaNuevoSecretario) {
    const { cuerpo } = await adminRest(`perfiles?select=id&cedula=eq.${cedulaNuevoSecretario}`);
    const id = (cuerpo as { id: string }[])[0]?.id;
    if (id) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV_LOCAL.SUPABASE_SERVICE_ROLE_KEY}` },
      });
    }
  }
});

test("el secretario entra a /admin y su menú solo tiene Resumen y Afiliaciones", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  await expect(page.getByRole("heading", { name: "Resumen de clientes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Afiliaciones" }).first()).toBeAttached();
  for (const oculto of ["Créditos", "Asociados", "Asesores", "Alertas", "Convenios", "Sorteo", "Demostración"]) {
    await expect(page.getByRole("link", { name: oculto, exact: true })).toHaveCount(0);
  }
  // Sin enlaces a Sorteo ni Alertas dentro del Resumen.
  await expect(page.getByRole("link", { name: /Ir a Alertas/ })).toHaveCount(0);
});

test("las rutas de admin que no son suyas lo devuelven a /admin (servidor)", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  for (const ruta of ["creditos", "asociados", "asesores", "alertas", "convenios", "sorteo", "demo"]) {
    await page.goto(`/admin/${ruta}`);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Resumen de clientes" })).toBeVisible();
  }
});

test("el secretario revisa una afiliación: la marca contactada y queda en el historial", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  await page.goto("/admin/afiliaciones");
  await expect(page.getByRole("heading", { name: "Afiliaciones" })).toBeVisible();
  await page.goto(`/admin/afiliaciones/${idSolicitud}`);
  await expect(page.getByText("Persona Para Secretaria").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Marcar como contactado" }).click();
  await expect(page.getByText(/Estado actualizado a «contactado»/)).toBeVisible({ timeout: 15_000 });

  const { cuerpo } = await adminRest(`historial_afiliaciones?select=actor_id,rol_actor,estado_anterior,estado_nuevo,created_at&solicitud_id=eq.${idSolicitud}`);
  const filas = cuerpo as { actor_id: string; rol_actor: string; estado_anterior: string; estado_nuevo: string; created_at: string }[];
  expect(filas).toHaveLength(1);
  expect(filas[0]).toMatchObject({
    actor_id: ID_SECRETARIO,
    rol_actor: "secretario",
    estado_anterior: "pendiente",
    estado_nuevo: "contactado",
  });
  expect(filas[0].created_at).toBeTruthy();
});

test("la base rechaza lo que el secretario no puede hacer (API directa con su sesión)", async () => {
  const token = await tokenDeUsuario(SECRETARIO.correo);

  // Lectura: afiliaciones sí; créditos, pagos y el historial de roles no.
  const afil = await usuarioRest(`solicitudes_afiliacion?select=id&id=eq.${idSolicitud}`, token);
  expect((afil.cuerpo as unknown[]).length).toBe(1);
  for (const tabla of ["solicitudes_credito", "pagos_comision", "historial_cambio_rol"]) {
    const r = await usuarioRest(`${tabla}?select=id&limit=1`, token);
    expect(r.cuerpo, tabla).toEqual([]);
  }

  // Escritura: nada de perfiles, convenios ni pagos.
  const rol = await usuarioRest(`perfiles?id=eq.${ID_SECRETARIO}`, token, {
    method: "PATCH",
    body: JSON.stringify({ rol: "admin" }),
  });
  expect(rol.status).toBeGreaterThanOrEqual(400);
  const convenio = await usuarioRest("convenios", token, {
    method: "POST",
    body: JSON.stringify({ nombre_empresa: "No debe crearse" }),
  });
  expect(convenio.status).toBeGreaterThanOrEqual(400);
  const baja = await usuarioRest("rpc/admin_cambiar_estado_asociado", token, {
    method: "POST",
    body: JSON.stringify({ p_asociado_id: ID_SECRETARIO, p_activo: false, p_motivo: "No debe poder" }),
  });
  expect(baja.status).toBeGreaterThanOrEqual(400);
  const sorteo = await usuarioRest("rpc/admin_realizar_sorteo", token, {
    method: "POST",
    body: JSON.stringify({ p_mes: "2026-10-01" }),
  });
  expect(sorteo.status).toBeGreaterThanOrEqual(400);

  // Asignar asesor: por la función del secretario; no pisa un asesor ya asignado (asociado 1 ya tiene).
  const asignar = await usuarioRest("rpc/secretario_asignar_asesor", token, {
    method: "POST",
    body: JSON.stringify({
      p_perfil_id: "4c7808d8-085f-42ed-9e5d-f53c117b4cd1",
      p_asesor_id: "9f2e6a1c-6b3d-4a2e-9c7a-1d2e3f4a5b6c",
    }),
  });
  expect(asignar.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(asignar.cuerpo)).toContain("ya tiene un asesor asignado");

  // La afiliación solo cambia de estado: los datos del solicitante no se tocan.
  const datos = await usuarioRest(`solicitudes_afiliacion?id=eq.${idSolicitud}`, token, {
    method: "PATCH",
    body: JSON.stringify({ nombres: "Otro" }),
  });
  expect(datos.status).toBeGreaterThanOrEqual(400);
});

test("un admin crea un secretario desde /admin/asesores y queda en el historial de roles", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, ADMIN, "/admin");
  await page.goto("/admin/asesores");
  cedulaNuevoSecretario = cedulaUnica();
  await page.getByLabel("Cédula del secretario").fill(cedulaNuevoSecretario);
  await page.getByLabel("Correo del secretario").fill(`nuevo.sec.${cedulaNuevoSecretario}@prueba.test`);
  await page.getByLabel("Nombres del secretario").fill("Nuria");
  await page.getByLabel("Apellidos del secretario").fill("Secretaria Nueva");
  await page.getByRole("button", { name: "Registrar secretario" }).click();
  await expect(page.getByText(/Secretario «Nuria Secretaria Nueva» creado/)).toBeVisible({ timeout: 20_000 });

  const { cuerpo } = await adminRest(`perfiles?select=id,rol&cedula=eq.${cedulaNuevoSecretario}`);
  const perfil = (cuerpo as { id: string; rol: string }[])[0];
  expect(perfil.rol).toBe("secretario");
  const { cuerpo: hist } = await adminRest(`historial_cambio_rol?select=actor_id,rol_anterior,rol_nuevo&perfil_id=eq.${perfil.id}`);
  expect(hist).toMatchObject([{ rol_anterior: "asociado", rol_nuevo: "secretario" }]);
  expect((hist as { actor_id: string }[])[0].actor_id).toBeTruthy();
});

test("el formulario de secretario muestra errores por campo y no envía vacío", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, ADMIN, "/admin");
  await page.goto("/admin/asesores");
  await page.getByRole("button", { name: "Registrar secretario" }).click();
  await expect(page.locator("#secretario-cedula-error")).toBeVisible();
  await expect(page.locator("#secretario-cedula")).toBeFocused();
});

// ---------------------------------------------------------------------------
// Búsqueda general de asesores
// ---------------------------------------------------------------------------

async function irAMisClientes(page: Page) {
  await page.goto("/asesor");
  await page
    .getByRole("button", { name: /^(Mis clientes|Clientes)$/ })
    .filter({ visible: true })
    .first()
    .click();
}

test("el asesor busca en toda la cooperativa: solo nombre, cédula enmascarada y asesor", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, ASESOR, "/asesor");
  await irAMisClientes(page);
  const buscador = page.getByLabel("Nombre o cédula");
  await expect(page.getByRole("heading", { name: "Buscar en toda la cooperativa" })).toBeVisible();

  // Menos de 4 caracteres: error por campo, sin consulta.
  await buscador.fill("Ase");
  await page.getByRole("button", { name: "Buscar", exact: true }).last().click();
  await expect(page.getByText("Escribe al menos 4 letras del nombre o 4 números de la cédula.")).toBeVisible();

  // Por cédula de un asociado que no es de este asesor.
  await buscador.fill("1234567891");
  await page.getByRole("button", { name: "Buscar", exact: true }).last().click();
  const resultados = page.getByRole("list", { name: "Resultados de la búsqueda" });
  await expect(resultados).toContainText("Asociada Sin Solicitudes");
  await expect(resultados).toContainText("1.2••.•••.891");
  await expect(resultados).toContainText("Sin asesor");
  await expect(resultados).not.toContainText("1234567891");
  await expect(resultados).not.toContainText("sin.solicitudes@");
  await expect(resultados).not.toContainText("3001234567");

  // Por nombre, de un asociado suyo: se ve el nombre del asesor.
  await buscador.fill("Asociado de Prueba");
  await page.getByRole("button", { name: "Buscar", exact: true }).last().click();
  await expect(resultados).toContainText("Asociado de Prueba");
  await expect(resultados).toContainText("Asesor de Prueba");

  // Sin coincidencias.
  await buscador.fill("Zzzzzz Nadie");
  await page.getByRole("button", { name: "Buscar", exact: true }).last().click();
  await expect(page.getByText("No encontramos asociados con ese dato.")).toBeVisible();
});

test("la búsqueda general solo la ejecuta quien puede atender (API directa)", async () => {
  const asociado = await tokenDeUsuario("asociado.prueba@greenalliance.test");
  const a = await usuarioRest("rpc/buscar_asociados_general", asociado, {
    method: "POST",
    body: JSON.stringify({ p_texto: "Asociado" }),
  });
  expect(a.status).toBeGreaterThanOrEqual(400);

  const secretario = await tokenDeUsuario(SECRETARIO.correo);
  const s = await usuarioRest("rpc/buscar_asociados_general", secretario, {
    method: "POST",
    body: JSON.stringify({ p_texto: "Asociado" }),
  });
  expect(s.status).toBeGreaterThanOrEqual(400);

  const asesor = await tokenDeUsuario(ASESOR.correo);
  const ok = await usuarioRest("rpc/buscar_asociados_general", asesor, {
    method: "POST",
    body: JSON.stringify({ p_texto: "Asociado" }),
  });
  expect(ok.status).toBe(200);
  const filas = ok.cuerpo as Record<string, unknown>[];
  expect(filas.length).toBeLessThanOrEqual(10);
  for (const f of filas) expect(Object.keys(f).sort()).toEqual(["asesor_texto", "cedula_enmascarada", "nombre"]);

  // Menos de 4 caracteres: vacío.
  const corta = await usuarioRest("rpc/buscar_asociados_general", asesor, {
    method: "POST",
    body: JSON.stringify({ p_texto: "Aso" }),
  });
  expect(corta.cuerpo).toEqual([]);
});
