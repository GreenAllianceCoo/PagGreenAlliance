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
/** Asociada «Sin Solicitudes» (seed.sql, cédula 1234567891). */
const ID_ASOCIADO_2 = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";

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
let nombreNuevoSecretario = "";

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

test("el secretario entra a /admin y su menú tiene Resumen, Afiliaciones, Créditos y Asociados", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  await expect(page.getByRole("heading", { name: "Resumen de clientes" })).toBeVisible();
  for (const visible of ["Afiliaciones", "Créditos", "Asociados"]) {
    await expect(page.getByRole("link", { name: visible, exact: true }).first()).toBeAttached();
  }
  for (const oculto of ["Asesores", "Alertas", "Convenios", "Sorteo", "Historial", "Demostración"]) {
    await expect(page.getByRole("link", { name: oculto, exact: true })).toHaveCount(0);
  }
  // Sin enlaces a Sorteo ni Alertas dentro del Resumen.
  await expect(page.getByRole("link", { name: /Ir a Alertas/ })).toHaveCount(0);
});

test("las rutas de admin que no son suyas lo devuelven a /admin (servidor)", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  for (const ruta of ["asesores", "alertas", "convenios", "sorteo", "demo", "historial"]) {
    await page.goto(`/admin/${ruta}`);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Resumen de clientes" })).toBeVisible();
  }
});

test("Créditos en solo lectura: sin aprobar, rechazar, desembolsar ni tasa de interés", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  for (const estado of ["pendiente", "aprobado", "rechazado"]) {
    await page.goto(`/admin/creditos?estado=${estado}`);
    await expect(page.getByRole("heading", { name: "Créditos" })).toBeVisible();
    for (const accion of [/^Aprobar/, /^Rechazar/, /Marcar desembolsado/, /comprobante/i]) {
      await expect(page.getByRole("button", { name: accion })).toHaveCount(0);
    }
    await expect(page.getByText(/% mensual|mensual$/)).toHaveCount(0);
  }
});

test("Asociados: el secretario ve la ficha y cambia el proceso ejecutivo, sin baja, eliminar, habilitar ni correo", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, SECRETARIO, "/admin");
  const { cuerpo: antes } = await adminRest(
    `procesos_ejecutivos?select=estado,fecha_inicio_embargo&asociado_id=eq.${ID_ASOCIADO_2}`,
  );
  const original = (antes as { estado: string; fecha_inicio_embargo: string | null }[])[0];
  try {
    await page.goto("/admin/asociados");
    await expect(page.getByRole("heading", { name: "Asociados" })).toBeVisible();
    await page.getByLabel("Buscar por nombre o cédula").fill("Sin Solicitudes");
    await page.keyboard.press("Enter");
    await page.getByRole("link", { name: /Asociada Sin Solicitudes/ }).click();
    await page.waitForURL(`**/admin/asociados/${ID_ASOCIADO_2}`);

    // Lo que NO le toca.
    await expect(page.getByRole("button", { name: /Dar de baja|Reactivar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Habilitar crédito/ })).toHaveCount(0);
    await expect(page.getByText("Eliminar definitivamente")).toHaveCount(0);
    await expect(page.getByText(/correo de ingreso/i)).toHaveCount(0);
    await expect(page.getByText("Estado de la cuenta")).toHaveCount(0);

    // Lo que SÍ: el proceso ejecutivo.
    await page.getByLabel("Estado del proceso ejecutivo").selectOption("terminado");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Proceso actualizado.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Cambió el proceso a «Terminado»/).first()).toBeVisible({ timeout: 15_000 });

    const { cuerpo } = await adminRest(
      `historial_proceso_ejecutivo?select=admin_id,estado_nuevo&asociado_id=eq.${ID_ASOCIADO_2}&estado_nuevo=eq.terminado`,
    );
    expect((cuerpo as unknown[]).length).toBeGreaterThanOrEqual(1);
    for (const fila of cuerpo as { admin_id: string }[]) expect(fila.admin_id).toBe(ID_SECRETARIO);
  } finally {
    await adminRest(`procesos_ejecutivos?asociado_id=eq.${ID_ASOCIADO_2}`, {
      method: "PATCH",
      body: JSON.stringify({ estado: original.estado, fecha_inicio_embargo: original.fecha_inicio_embargo }),
    });
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

  // Lectura: afiliaciones y créditos sí (sin tasa); pagos y el historial de roles no.
  const afil = await usuarioRest(`solicitudes_afiliacion?select=id&id=eq.${idSolicitud}`, token);
  expect((afil.cuerpo as unknown[]).length).toBe(1);
  const creditos = await usuarioRest("solicitudes_credito?select=id,monto_solicitado&limit=1", token);
  expect(creditos.status).toBe(200);
  expect((creditos.cuerpo as unknown[]).length).toBe(1);
  const tasa = await usuarioRest("solicitudes_credito?select=tasa_interes_mensual&limit=1", token);
  expect(tasa.status).toBeGreaterThanOrEqual(400);
  for (const tabla of ["pagos_comision", "historial_cambio_rol", "historial_solicitudes", "historial_estado_asociado"]) {
    const r = await usuarioRest(`${tabla}?select=id&limit=1`, token);
    expect(r.cuerpo, tabla).toEqual([]);
  }
  // Créditos: ni aprobar, ni desembolsar, ni ver las tasas con la función del admin.
  const aprobar = await usuarioRest("solicitudes_credito?estado=eq.pendiente", token, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ estado: "aprobado" }),
  });
  if (aprobar.status < 300) expect(aprobar.cuerpo).toEqual([]);
  const desembolso = await usuarioRest("rpc/admin_marcar_desembolsado", token, {
    method: "POST",
    body: JSON.stringify({ p_solicitud_id: "00000000-0000-4000-a000-000000000000" }),
  });
  expect(desembolso.status).toBeGreaterThanOrEqual(400);
  const habilitar = await usuarioRest("rpc/admin_habilitar_credito", token, {
    method: "POST",
    body: JSON.stringify({ p_asociado_id: ID_ASOCIADO_2, p_motivo: "No debe poder" }),
  });
  expect(habilitar.status).toBeGreaterThanOrEqual(400);
  // Cambiar el rol de alguien o ver el historial del equipo: solo admin.
  const cambiarRol = await usuarioRest("rpc/admin_cambiar_rol_equipo", token, {
    method: "POST",
    body: JSON.stringify({ p_perfil_id: ID_SECRETARIO, p_rol: "asesor", p_motivo: "No debe poder" }),
  });
  expect(cambiarRol.status).toBeGreaterThanOrEqual(400);
  const historial = await usuarioRest("rpc/admin_historial_equipo", token, { method: "POST", body: "{}" });
  expect(historial.status).toBeGreaterThanOrEqual(400);

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
  const sufijo = [...cedulaNuevoSecretario.slice(-5)].map((d) => "ABCDEFGHIJ"[Number(d)]).join("");
  nombreNuevoSecretario = `Nuria Secretaria ${sufijo}`;
  await page.getByLabel("Apellidos del secretario").fill(`Secretaria ${sufijo}`);
  await page.getByRole("button", { name: "Registrar secretario" }).click();
  await expect(page.getByText(new RegExp(`Secretario «${nombreNuevoSecretario}» creado`))).toBeVisible({ timeout: 20_000 });

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
// Equipo: cambiar rol, desactivar, e «Historial del equipo» (solo admin)
// ---------------------------------------------------------------------------

test("el admin cambia el rol de un secretario (con motivo) y de vuelta; el motivo es obligatorio", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, ADMIN, "/admin");
  await page.goto("/admin/asesores");
  const nombre = nombreNuevoSecretario;

  // Sin motivo: error por campo con aria-describedby y foco.
  await page.getByRole("button", { name: `Cambiar rol de ${nombre}` }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Nuevo rol").selectOption("asesor");
  await dialogo.getByRole("button", { name: "Cambiar rol", exact: true }).click();
  const motivo = dialogo.getByLabel(/^Motivo/);
  await expect(motivo).toBeFocused();
  await expect(motivo).toHaveAttribute("aria-invalid", "true");
  await expect(dialogo.getByRole("alert")).toContainText("El motivo debe tener entre 5 y 300 caracteres");

  // Con motivo: pasa a asesor.
  await motivo.fill("Pasa a atender asociados");
  await dialogo.getByRole("button", { name: "Cambiar rol", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  const fila = page.getByRole("listitem").filter({ hasText: nombre });
  await expect(fila).toContainText("Asesor");
  const { cuerpo: perfiles } = await adminRest(`perfiles?select=id,rol&cedula=eq.${cedulaNuevoSecretario}`);
  expect((perfiles as { rol: string }[])[0].rol).toBe("asesor");
  const { cuerpo: hist } = await adminRest(
    `historial_cambio_rol?select=rol_anterior,rol_nuevo,motivo&perfil_id=eq.${(perfiles as { id: string }[])[0].id}&order=created_at`,
  );
  expect(hist).toMatchObject([
    { rol_anterior: "asociado", rol_nuevo: "secretario" },
    { rol_anterior: "secretario", rol_nuevo: "asesor", motivo: "Pasa a atender asociados" },
  ]);

  // Y de vuelta a secretario (un asesor sin clientes).
  await page.getByRole("button", { name: `Cambiar rol de ${nombre}` }).click();
  await page.getByRole("dialog").getByLabel("Nuevo rol").selectOption("secretario");
  await page.getByRole("dialog").getByLabel(/^Motivo/).fill("Vuelve a la secretaría");
  await page.getByRole("dialog").getByRole("button", { name: "Cambiar rol", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  await expect(fila).toContainText("Secretario");
});

test("el admin desactiva y reactiva a un secretario; un admin no se ve los botones a sí mismo", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, ADMIN, "/admin");
  await page.goto("/admin/asesores");
  const nombre = nombreNuevoSecretario;
  const fila = page.getByRole("listitem").filter({ hasText: nombre });

  await page.getByRole("button", { name: `Desactivar a ${nombre}` }).click();
  await page.getByRole("dialog").getByLabel(/^Motivo/).fill("Deja de colaborar");
  await page.getByRole("dialog").getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  await expect(fila).toContainText("Inactivo");
  const { cuerpo } = await adminRest(`perfiles?select=activo&cedula=eq.${cedulaNuevoSecretario}`);
  expect(cuerpo).toEqual([{ activo: false }]);

  await page.getByRole("button", { name: `Reactivar a ${nombre}` }).click();
  await page.getByRole("dialog").getByLabel(/^Motivo/).fill("Vuelve a colaborar");
  await page.getByRole("dialog").getByRole("button", { name: "Reactivar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  await expect(fila).not.toContainText("Inactivo");

  // El admin en sesión no tiene botones sobre sí mismo.
  const propia = page.getByRole("listitem").filter({ hasText: "Administrador" }).filter({ hasText: "1234567899" });
  await expect(propia.getByRole("button", { name: /Cambiar rol|Desactivar/ })).toHaveCount(0);
});

test("Historial del equipo: lo que hicieron secretario y admin, con filtros y en español", async ({ browser }, testInfo) => {
  const page = await sesion(browser, testInfo, ADMIN, "/admin");
  const { cuerpo: adm } = await adminRest("perfiles?select=id&cedula=eq.1234567899");
  const idAdmin = (adm as { id: string }[])[0].id;

  await page.goto("/admin/historial");
  await expect(page.getByRole("heading", { name: "Historial del equipo" })).toBeVisible();
  const lista = page.getByTestId("historial-equipo");
  await expect(lista).toContainText("Marcó como contactada la afiliación de Persona Para Secretaria");
  await expect(lista).toContainText("Secretaria de Prueba");
  await expect(lista).toContainText(`Cambió el rol de ${nombreNuevoSecretario} de secretario a asesor`);
  await expect(lista).toContainText("Motivo: Pasa a atender asociados");
  await expect(lista).toContainText(`Desactivó a ${nombreNuevoSecretario} (secretario)`);
  await expect(lista).toContainText(/\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4} \d{2}:\d{2}/);

  // Por persona: solo la secretaria.
  await page.goto(`/admin/historial?persona=${ID_SECRETARIO}`);
  await expect(lista).toContainText("Secretaria de Prueba");
  await expect(lista).not.toContainText("Cambió el rol de Nuria");
  // Por persona: el admin.
  await page.goto(`/admin/historial?persona=${idAdmin}`);
  await expect(lista).toContainText(`Cambió el rol de ${nombreNuevoSecretario}`);
  await expect(lista).not.toContainText("Marcó como contactada");

  // Por fechas: un día lejano no trae nada.
  await page.goto("/admin/historial");
  await page.getByLabel("Desde").fill("2030-01-01");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("No hay movimientos con esos filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Quitar filtros" }).click();
  await expect(page.getByTestId("historial-equipo")).toBeVisible();
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

  // Si lo atiende un administrador, se ve el nombre del administrador (no «Cooperativa»).
  const { cuerpo: adm } = await adminRest("perfiles?select=id,nombre_completo&cedula=eq.1234567899");
  const admin = (adm as { id: string; nombre_completo: string }[])[0];
  try {
    await adminRest(`perfiles?id=eq.${admin.id}`, { method: "PATCH", body: JSON.stringify({ atiende_asociados: true }) });
    await adminRest(`perfiles?id=eq.${ID_ASOCIADO_2}`, { method: "PATCH", body: JSON.stringify({ asesor_id: admin.id }) });
    await buscador.fill("1234567891");
    await page.getByRole("button", { name: "Buscar", exact: true }).last().click();
    await expect(resultados).toContainText(admin.nombre_completo);
    await expect(resultados).not.toContainText("Cooperativa");
  } finally {
    await adminRest(`perfiles?id=eq.${ID_ASOCIADO_2}`, { method: "PATCH", body: JSON.stringify({ asesor_id: null }) });
    await adminRest(`perfiles?id=eq.${admin.id}`, { method: "PATCH", body: JSON.stringify({ atiende_asociados: false }) });
  }

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
