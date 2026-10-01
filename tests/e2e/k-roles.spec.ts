/**
 * Fase 2 · ingreso por rol y flujos principales de /admin y /asesor (local).
 * Admin de prueba 1234567899, asesor 1234567892 y asociado 1234567891 (seed.sql).
 *
 * Antes de repetir esta prueba corre `npx supabase db reset`: la afiliación
 * de ejemplo queda «aprobada» después del primer test y el crédito de
 * ejemplo queda «aprobado»/«rechazado» después del segundo.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  datosValidos,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarAfiliacion,
  llenarOtp,
  pedirCodigo,
} from "./utils";

async function ingresar(
  page: Page,
  cedula: string,
  correo: string,
  destino: string,
) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

/** Fila resaltada (seleccionada) de la lista de créditos (pieza 2d). */
const filaSeleccionada = (page: Page) =>
  page.locator("section button.motion-safe\\:animate-ga-fila-entra");

/** Id del asociado sin solicitudes (seed.sql, cédula 1234567891): para tener 2 filas en /admin/creditos. */
const ID_ASOCIADO_2 = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c";

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "solo escritorio");

// El crédito de prueba del asociado 2 se borra al terminar: si queda, las pruebas
// que corren después (c-cuenta, e-diseno, i-despliegue en celular) ya no lo ven «sin solicitudes».
test.afterAll(async () => {
  await adminRest(`solicitudes_credito?asociado_id=eq.${ID_ASOCIADO_2}`, {
    method: "DELETE",
  });
});

test("admin entra a /admin y aprueba la afiliación de ejemplo (2 pasos)", async ({
  page,
}) => {
  await ingresar(
    page,
    "1234567899",
    "admin.prueba@greenalliance.test",
    "/admin",
  );
  await page.goto("/admin/afiliaciones");
  await expect(page.getByText("Camilo").first()).toBeVisible();
  await page.getByText("Camilo").first().click();
  await page.waitForURL("**/admin/afiliaciones/**");

  // Rediseño C+: aprobar es un paso de confirmación («Aprobar (crea la
  // cuenta)» → «¿Aprobar…?» → «Sí, aprobar»), no un solo clic.
  await page.getByRole("button", { name: "Aprobar (crea la cuenta)" }).click();
  await expect(page.getByText(/¿Aprobar la solicitud de/)).toBeVisible();
  await page.getByRole("button", { name: "Sí, aprobar" }).click();
  await expect(page.getByText(/aprobad/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // --- «Escribir por WhatsApp» habilitado (pieza 3e/3i, D-08): enlaza a
  // wa.me con el prefijo 57 + el celular de la solicitud (seed.sql: 3009998877).
  const enlaceWhatsapp = page.getByRole("link", {
    name: "Escribir por WhatsApp",
  });
  await expect(enlaceWhatsapp).toBeVisible();
  expect(await enlaceWhatsapp.getAttribute("href")).toMatch(
    /^https:\/\/wa\.me\/57/,
  );

  // --- Bloque «Asesor» (pieza 3i, D-09): la solicitud de ejemplo (Camilo,
  // seed.sql) ya viene referida por el asesor de prueba, y `aprobarAfiliacion`
  // le copia ese mismo asesor al perfil recién creado — por eso el bloque de
  // asignar NO aparece: se ve de solo lectura con el asesor que ya tiene.
  await expect(
    page.getByRole("button", { name: "Asignar asesor" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Asesor asignado:\s*Asesor de Prueba/),
  ).toBeVisible();

  // Simulamos que el asociado quedó sin asesor asignado (p. ej. nadie lo
  // refirió) para probar el bloque de todos modos, con el único asesor que
  // deja el seed («Asesor de Prueba»).
  await adminRest("perfiles?cedula=eq.1234567898", {
    method: "PATCH",
    body: JSON.stringify({ asesor_id: null }),
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Asignar asesor" }),
  ).toBeVisible();
  await page
    .getByLabel("Elige un asesor")
    .selectOption({ label: "Asesor de Prueba" });
  await page.getByRole("button", { name: "Asignar asesor" }).click();
  await expect(page.getByText(/Asesor asignado/)).toBeVisible({
    timeout: 10_000,
  });
  // Tras recargar sigue de solo lectura, sin opción de cambiarlo.
  await page.reload();
  await expect(
    page.getByText(/Asesor asignado:\s*Asesor de Prueba/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Asignar asesor" }),
  ).toHaveCount(0);

  await page.goto("/admin/creditos");
  await expect(page.getByText("Asociado de Prueba").first()).toBeVisible();
  for (const ruta of ["/admin/asesores", "/admin/sorteo"]) {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(200);
  }

  // Cuenta de demostración del admin: marco ámbar «siempre visible» (pieza
  // 2c/3h) + «Salir de la demo», misma «cuenta fantasma» que la del asesor.
  await page.getByRole("link", { name: "Demostración" }).click();
  await page.waitForURL("**/admin/demo");
  await expect(page.getByText(/Modo demostración/i).first()).toBeVisible();
  await expect(page.locator(".ring-ga-ambar")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Salir de la demo" }),
  ).toBeVisible();
  await page.getByLabel("Grado del cliente").selectOption("SI");
  await expect(
    page.getByText(/Tope disponible para el grado/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Volver al panel" }).first().click();
  await page.waitForURL(/\/admin(\/afiliaciones)?$/);
});

test("admin: KPIs coherentes, atajos J/K/A/R/Esc, nota interna oculta y rechazo con motivo", async ({
  page,
}) => {
  // Un segundo crédito pendiente (asociado 2, grado SI, dentro de su tope):
  // con solo 1 fila no se puede probar que J/K mueven la selección.
  await adminRest("solicitudes_credito", {
    method: "POST",
    body: JSON.stringify({
      asociado_id: ID_ASOCIADO_2,
      porcentaje_devolucion: "50",
      monto_solicitado: 300000,
    }),
  });

  await ingresar(
    page,
    "1234567899",
    "admin.prueba@greenalliance.test",
    "/admin",
  );
  await page.goto("/admin/creditos?estado=pendiente");
  await page.waitForLoadState("networkidle");

  // --- KPIs (lib/admin/kpis.ts): comparados contra la base, no contra un
  // número fijo (para que la prueba no dependa de cuántas filas deje el seed).
  const leerKpi = (etiqueta: string) =>
    page
      .getByText(etiqueta, { exact: true })
      .locator("xpath=following-sibling::span[1]")
      .innerText();
  const [creditosPendientesDB, afiliacionesPendientesDB] = await Promise.all([
    adminRest("solicitudes_credito?select=id&estado=eq.pendiente"),
    adminRest("solicitudes_afiliacion?select=id&estado=eq.pendiente"),
  ]);
  const totalCreditos = Array.isArray(creditosPendientesDB.cuerpo)
    ? creditosPendientesDB.cuerpo.length
    : -1;
  const totalAfiliaciones = Array.isArray(afiliacionesPendientesDB.cuerpo)
    ? afiliacionesPendientesDB.cuerpo.length
    : -1;
  expect(await leerKpi("Créditos pendientes")).toBe(String(totalCreditos));
  expect(await leerKpi("Afiliaciones pendientes")).toBe(
    String(totalAfiliaciones),
  );

  // --- Atajos de teclado: J/K mueven la selección (fuera de un campo).
  const filas = filaSeleccionada(page);
  await expect(filas).toHaveCount(2);
  const primeraSeleccionada = async () =>
    (await filas.nth(0).getAttribute("class"))?.includes(
      "bg-admin-superficie-2",
    );
  expect(await primeraSeleccionada()).toBe(true);
  await page.keyboard.press("j");
  expect(
    (await filas.nth(1).getAttribute("class"))?.includes(
      "bg-admin-superficie-2",
    ),
  ).toBe(true);
  await page.keyboard.press("k");
  expect(await primeraSeleccionada()).toBe(true);

  // --- No se disparan escribiendo en el buscador (p. ej. una cédula con «j»/«k»/«a»/«r»).
  const buscador = page.getByLabel("Buscar por nombre o cédula");
  await buscador.fill("jkar");
  await expect(buscador).toHaveValue("jkar");
  // El foco sigue en el campo: nada debería haber cambiado de fila ni abierto un paso.
  await expect(page.getByText(/¿Aprobar|Motivo del rechazo/)).toHaveCount(0);
  await buscador.fill("");
  // Quita el foco del buscador: mientras esté enfocado, el atajo no se
  // dispara (el propio código lo ignora si el foco está en un campo).
  await page.getByRole("heading", { name: "Créditos" }).click();

  // --- A abre el paso de confirmación sin aprobar; Esc cancela.
  await page.keyboard.press("a");
  await expect(page.getByText(/¿Aprobar .* a/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/¿Aprobar .* a/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Aprobar", exact: true }),
  ).toBeVisible();

  // --- R abre el paso de rechazo (motivo obligatorio); Esc también cancela ahí.
  await page.keyboard.press("r");
  await expect(page.getByLabel(/Motivo del rechazo/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel(/Motivo del rechazo/)).toHaveCount(0);

  // --- Nota interna oculta hasta que se aplique la migración propuesta
  // (HISTORIAL_NOTAS_INTERNAS_HABILITADO = false, lib/admin/flags.ts).
  await expect(page.getByText("Nota interna")).toHaveCount(0);

  // --- Rechazar sin motivo → error; con motivo → la fila sale del filtro
  // «pendiente» (la lista de la pestaña activa se refresca sola) y queda en
  // «rechazado» con el motivo guardado.
  await page.keyboard.press("r");
  await page.getByRole("button", { name: "Rechazar crédito" }).click();
  await expect(page.locator(":invalid#motivo-rechazo")).toHaveCount(1);
  await page
    .getByLabel(/Motivo del rechazo/)
    .fill("Prueba automática de QA: ya tiene un crédito vigente.");
  await page.getByRole("button", { name: "Rechazar crédito" }).click();
  await expect(filas).toHaveCount(1, { timeout: 10_000 });
  await page.goto("/admin/creditos?estado=rechazado");
  await expect(
    page.getByText(/Rechazado\. Motivo: Prueba automática de QA/),
  ).toBeVisible();

  // --- El otro crédito (dentro del tope) sí se puede aprobar en 2 pasos.
  // Al aprobar, la fila también sale del filtro «pendiente» (igual que al
  // rechazar): se confirma el resultado en la pestaña «aprobado».
  await page.goto("/admin/creditos?estado=pendiente");
  await filaSeleccionada(page).first().click();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await page.getByRole("button", { name: "Sí, aprobar" }).click();
  await expect(filas).toHaveCount(0, { timeout: 10_000 });
  await page.goto("/admin/creditos?estado=aprobado");
  await filaSeleccionada(page).first().click();
  await expect(
    page.getByText(
      "Este crédito ya fue aprobado. No hay más acciones disponibles.",
    ),
  ).toBeVisible();
});

test("asesor no entra a /admin/demo", async ({ page }) => {
  await ingresar(
    page,
    "1234567892",
    "asesor.prueba@greenalliance.test",
    "/asesor",
  );
  await page.goto("/admin/demo");
  expect(page.url()).not.toContain("/admin");
});

test("asesor entra a /asesor, no ve celular/correo/Nequi/fotos, y la demo no guarda", async ({
  page,
}) => {
  await ingresar(
    page,
    "1234567892",
    "asesor.prueba@greenalliance.test",
    "/asesor",
  );
  // /asesor abre en «Resumen» (3s): la cartera está en «Mis clientes».
  await page.getByRole("button", { name: "Mis clientes" }).click();
  // Cédula enmascarada en /asesor (enmascarar_cedula, migración 20260930100400): nunca completa.
  await expect(page.getByText("1.2••.•••.890").first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("1234567890");
  // lib/asesor/resumen.ts (sanitizarFilaResumen) y resumen_clientes_asesor()
  // (SECURITY DEFINER) nunca exponen estos campos: ni el celular/Nequi del
  // asociado 1 (seed.sql) ni su correo, en ningún lado de la pantalla.
  await expect(page.getByText("3001234567")).toHaveCount(0);
  await expect(
    page.getByText("asociado.prueba@greenalliance.test"),
  ).toHaveCount(0);
  const cuerpo = await page.locator("body").innerText();
  expect(cuerpo).not.toContain("@greenalliance.test");

  // Cuenta de demostración: mismo marco ámbar «siempre visible» + «Salir de la demo».
  await page.goto("/asesor/demo");
  await expect(page.getByText(/Modo demostración/i).first()).toBeVisible();
  await expect(page.locator(".ring-ga-ambar")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Salir de la demo" }),
  ).toBeVisible();
});

test("asociado entra a /cuenta y ve el botón del sorteo", async ({ page }) => {
  await ingresar(
    page,
    "1234567891",
    "sin.solicitudes@greenalliance.test",
    "/cuenta",
  );
  await expect(
    page.getByRole("button", { name: /Sorteo del mes|Próximo sorteo/ }).first(),
  ).toBeVisible();
  const r = await page.goto("/admin");
  expect(page.url()).not.toContain("/admin");
  expect(r?.status()).toBe(200);
});

test("afiliación nueva v3: correo personal de cualquier dominio, institucional @policia.gov.co y 3 fotos", async ({
  page,
}) => {
  await limpiarLimites();
  const cedula = String(Date.now()).slice(-10);
  await page.goto("/afiliacion");
  await llenarAfiliacion(page, {
    ...datosValidos(cedula),
    correoInstitucional: `laura.${cedula}@policia.gov.co`,
    email: `laura.gomez.${cedula}@gmail.com`,
    acepto: true,
  });
  await page.locator("#af-asesor").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await page.waitForURL("**/afiliacion/enviada", { timeout: 30_000 });
  const { cuerpo } = await adminRest(
    `solicitudes_afiliacion?select=email,correo_institucional,nomina_entidad,nomina_tipo,nomina_numero&cedula=eq.${cedula}`,
  );
  expect(cuerpo).toEqual([
    {
      email: `laura.gomez.${cedula}@gmail.com`,
      correo_institucional: `laura.${cedula}@policia.gov.co`,
      nomina_entidad: "Bancolombia",
      nomina_tipo: "ahorros",
      nomina_numero: "12345678901",
    },
  ]);
});
