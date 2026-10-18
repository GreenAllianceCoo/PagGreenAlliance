/**
 * Cambios sin commit de la rama avance-pendientes (18-oct), contra Supabase LOCAL:
 *  1. Editar datos del asociado (/admin/asociados/[id])
 *  2. Afiliación con cédula/correo ya registrados (migración 20261014000000)
 *  3. Pausa del ingreso y avisos (/admin/plataforma, /cuenta-pausada)
 *  4. Botón flotante de WhatsApp
 *  5. Aviso de selfie borrosa/oscura
 *
 * Deja la base como estaba (restaura el perfil editado, reanuda la pausa y borra los avisos QA).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  cedulaUnica,
  contextoConSesion,
  datosValidos,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarAfiliacion,
  llenarOtp,
  pedirCodigo,
  capturaCompleta,
  USUARIOS,
} from "./utils";


const ADMIN = { cedula: "1234567899", correo: "admin.prueba@greenalliance.test", id: "bd8bb056-286f-4b75-89e1-cc07b6c7c0f8" };
const ASESOR = { cedula: "1234567892", correo: "asesor.prueba@greenalliance.test" };
const OBJETIVO = "3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01"; // «Asociado Operando de Prueba», ejército, asesor = asesor de prueba

async function entrar(page: Page, rol: { cedula: string; correo: string }, destino: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(rol.correo);
  const inicio = await pedirCodigo(page, rol.cedula);
  const codigo = await esperarCodigo(rol.correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
  await page.waitForURL(`**${destino}`);
}

async function perfilDe(id: string) {
  const { cuerpo } = await adminRest(
    `perfiles?select=nombre_completo,telefono,correo_institucional,nomina_entidad,nomina_tipo,nomina_numero,asesor_id&id=eq.${id}`,
  );
  return (cuerpo as Record<string, string | null>[])[0];
}

// ---------------------------------------------------------------------------
// 1. Editar datos
// ---------------------------------------------------------------------------
test.describe("1 · Editar datos del asociado", () => {
  let original: Record<string, string | null>;

  test.beforeAll(async () => {
    original = await perfilDe(OBJETIVO);
  });
  test.afterAll(async () => {
    const r = await adminRest(`perfiles?id=eq.${OBJETIVO}`, { method: "PATCH", body: JSON.stringify(original) });
    expect(r.status, `restaurar perfil: ${JSON.stringify(r.cuerpo)}`).toBeLessThan(300);
  });

  test("errores por campo, sin cambios, guardado (banco, billetera, otra, sin cuenta)", async ({ page }, testInfo) => {
    await entrar(page, ADMIN, "/admin");
    await page.goto(`/admin/asociados/${OBJETIVO}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Datos del asociado" })).toBeVisible();
    const seccion = page.locator("section[aria-labelledby='datos-asociado-titulo']");
    await expect(seccion).toContainText("Asociado Operando de Prueba");
    await capturaCompleta(page, "r1-ficha-datos", testInfo);

    const abrir = async () => {
      await page.getByRole("button", { name: "Editar datos" }).click();
      await expect(page.getByRole("heading", { name: "Editar datos" })).toBeVisible();
    };
    const dialogo = page.getByRole("dialog");
    const guardar = () => dialogo.getByRole("button", { name: "Guardar cambios" }).click();

    // a) sin cambios
    await abrir();
    await capturaCompleta(page, "r1-modal-editar", testInfo);
    await guardar();
    await expect(dialogo.getByRole("alert")).toContainText("No hay cambios para guardar");

    // b) errores por campo
    await dialogo.getByLabel("Nombre completo").fill("A1");
    await dialogo.getByLabel("Celular").fill("2001234567");
    await dialogo.getByLabel("Correo institucional").fill("persona@gmail.com");
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("Bancolombia");
    await dialogo.getByLabel("Tipo de cuenta").selectOption("");
    await dialogo.getByLabel("Número de cuenta").fill("abc");
    await guardar();
    await expect(dialogo.getByLabel("Nombre completo")).toHaveAttribute("aria-invalid", "true");
    // Hallazgo: tras un envío con errores, el desplegable debe seguir mostrando lo elegido.
    expect.soft(await dialogo.getByLabel("Entidad", { exact: true }).inputValue(), "la entidad elegida debe seguir visible tras un error").toBe("Bancolombia");
    await expect(dialogo).toContainText(/solo puede tener letras/i);
    await expect(dialogo.getByLabel("Celular")).toHaveAttribute("aria-invalid", "true");
    await expect(dialogo.getByLabel("Correo institucional")).toHaveAttribute("aria-invalid", "true");
    await expect(dialogo.getByLabel("Tipo de cuenta")).toHaveAttribute("aria-invalid", "true");
    await expect(dialogo.getByLabel("Número de cuenta")).toHaveAttribute("aria-invalid", "true");
    // foco en el primer campo con error
    await expect(dialogo.getByLabel("Nombre completo")).toBeFocused();
    await capturaCompleta(page, "r1-modal-errores", testInfo);

    // nombre de 1 letra y 121 caracteres, correo mal formado
    await dialogo.getByLabel("Nombre completo").fill("A");
    await dialogo.getByLabel("Correo institucional").fill("mal");
    await guardar();
    await expect(dialogo).toContainText(/al menos 2 caracteres/i);
    await expect(dialogo).toContainText(/Revisa el correo/i);
    // El tope de 120 lo impone maxLength en el navegador (fill respeta maxLength): se verifica el atributo.
    await expect(dialogo.getByLabel("Nombre completo")).toHaveAttribute("maxlength", "120");
    // «Otra» sin nombre
    await dialogo.getByLabel("Nombre completo").fill("Asociado Operando de Prueba");
    await dialogo.getByLabel("Correo institucional").fill("");
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("otra");
    await guardar();
    await expect(dialogo.getByLabel("Nombre de la entidad")).toHaveAttribute("aria-invalid", "true");
    // Cancelar no guarda nada
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toHaveCount(0);
    expect((await perfilDe(OBJETIVO)).nombre_completo).toBe("Asociado Operando de Prueba");

    // c) billetera Nequi + nombre/celular/correo
    await abrir();
    await dialogo.getByLabel("Nombre completo").fill("  Asociado   Operando Editado ");
    await dialogo.getByLabel("Celular").fill("310 555 0003");
    await dialogo.getByLabel("Correo institucional").fill("Operando.Editado@BuzonEjercito.mil.co");
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("Nequi");
    await expect(dialogo.getByLabel("Tipo de cuenta")).toHaveCount(0);
    await dialogo.getByLabel(/Número/).fill("3105550003");
    await guardar();
    await expect(page.getByText("Datos actualizados.")).toBeVisible();
    await expect(seccion).toContainText("Asociado Operando Editado");
    let p = await perfilDe(OBJETIVO);
    expect(p).toMatchObject({
      nombre_completo: "Asociado Operando Editado",
      telefono: "3105550003",
      correo_institucional: "operando.editado@buzonejercito.mil.co",
      nomina_entidad: "Nequi",
      nomina_tipo: "deposito_electronico",
      nomina_numero: "3105550003",
    });

    // d) banco con tipo y número
    await abrir();
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("Bancolombia");
    await dialogo.getByLabel("Tipo de cuenta").selectOption("ahorros");
    await dialogo.getByLabel("Número de cuenta").fill("12345678901");
    await guardar();
    await expect(page.getByText("Datos actualizados.")).toBeVisible();
    p = await perfilDe(OBJETIVO);
    expect(p).toMatchObject({ nomina_entidad: "Bancolombia", nomina_tipo: "ahorros", nomina_numero: "12345678901" });
    await expect(seccion).toContainText("Bancolombia");

    // e) «Otra, ¿cuál?»
    await abrir();
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("otra");
    await dialogo.getByLabel("Nombre de la entidad").fill("Banco Prueba QA");
    await dialogo.getByLabel("Tipo de cuenta").selectOption("corriente");
    await dialogo.getByLabel("Número de cuenta").fill("9988776655");
    await guardar();
    await expect(page.getByText("Datos actualizados.")).toBeVisible();
    p = await perfilDe(OBJETIVO);
    expect(p).toMatchObject({ nomina_entidad: "Banco Prueba QA", nomina_tipo: "corriente", nomina_numero: "9988776655" });
    // reabrir: «Otra» preseleccionada con el nombre
    await abrir();
    await expect(dialogo.getByLabel("Entidad", { exact: true })).toHaveValue("otra");
    await expect(dialogo.getByLabel("Nombre de la entidad")).toHaveValue("Banco Prueba QA");
    // Daviplata
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("Daviplata");
    await dialogo.getByLabel(/Número/).fill("3105550003");
    await guardar();
    await expect(page.getByText("Datos actualizados.")).toBeVisible();
    expect(await perfilDe(OBJETIVO)).toMatchObject({ nomina_entidad: "Daviplata", nomina_tipo: "deposito_electronico" });

    // f) sin cuenta de nómina ni celular ni correo institucional
    await abrir();
    await dialogo.getByLabel("Entidad", { exact: true }).selectOption("");
    await dialogo.getByLabel("Celular").fill("");
    await dialogo.getByLabel("Correo institucional").fill("");
    await guardar();
    await expect(page.getByText("Datos actualizados.")).toBeVisible();
    expect(await perfilDe(OBJETIVO)).toMatchObject({
      telefono: null,
      correo_institucional: null,
      nomina_entidad: null,
      nomina_tipo: null,
      nomina_numero: null,
    });
    await expect(seccion).toContainText("Sin cuenta de nómina");
  });

  test("bloqueado cuando el admin es el asesor del asociado", async ({ page }) => {
    // Un admin solo puede ser asesor de alguien si tiene atiende_asociados (puede_atender()).
    await adminRest(`perfiles?id=eq.${ADMIN.id}`, { method: "PATCH", body: JSON.stringify({ atiende_asociados: true }) });
    const r = await adminRest(`perfiles?id=eq.${OBJETIVO}`, { method: "PATCH", body: JSON.stringify({ asesor_id: ADMIN.id }) });
    expect(r.status, JSON.stringify(r.cuerpo)).toBeLessThan(300);
    try {
      await entrar(page, ADMIN, "/admin");
      await page.goto(`/admin/asociados/${OBJETIVO}`);
      await expect(page.getByRole("button", { name: "Editar datos" })).toBeDisabled();
      await expect(page.getByText(/es tuya o de uno de tus clientes/i).first()).toBeVisible();
    } finally {
      await adminRest(`perfiles?id=eq.${OBJETIVO}`, { method: "PATCH", body: JSON.stringify({ asesor_id: original.asesor_id }) });
      await adminRest(`perfiles?id=eq.${ADMIN.id}`, { method: "PATCH", body: JSON.stringify({ atiende_asociados: false }) });
    }
  });

  test("el celular no se desborda en la ficha ni en el modal", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "celular", "solo celular");
    await entrar(page, ADMIN, "/admin");
    await page.goto(`/admin/asociados/${OBJETIVO}`);
    await page.getByRole("button", { name: "Editar datos" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ancho).toBeLessThanOrEqual(1);
    await capturaCompleta(page, "r1-modal-celular", testInfo);
  });
});

// ---------------------------------------------------------------------------
// 2. Afiliación con datos ya registrados
// ---------------------------------------------------------------------------
test.describe("2 · Afiliación con cédula o correo ya registrados", () => {
  const casos = [
    { nombre: "cédula de un asociado", cambios: () => ({ cedula: USUARIOS.conSolicitud.cedula }), cedulaFila: () => USUARIOS.conSolicitud.cedula },
    { nombre: "correo personal de un asociado", cambios: () => ({ email: USUARIOS.conSolicitud.correo }) },
    { nombre: "correo institucional de un asociado", cambios: () => ({ correoInstitucional: "operando.prueba@buzonejercito.mil.co", institucion: "ejercito" as const, grado: "TE" }) },
  ];
  for (const caso of casos) {
    test(`${caso.nombre} → «¡Solicitud enviada!» sin crear solicitud`, async ({ page }) => {
      await limpiarLimites();
      const cedula = cedulaUnica();
      const datos = { ...datosValidos(cedula), ...caso.cambios() };
      const cedulaFila = datos.cedula;
      const antes = (await adminRest(`solicitudes_afiliacion?select=id&cedula=eq.${cedulaFila}`)).cuerpo as unknown[];
      await page.goto("/afiliacion");
      await llenarAfiliacion(page, datos);
      const t0 = Date.now();
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
      await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 45_000 });
      await expect(page.locator("h1")).toHaveText("¡Solicitud enviada!");
      console.log(`[${caso.nombre}] respuesta en ${Date.now() - t0} ms`);
      const despues = (await adminRest(`solicitudes_afiliacion?select=id&cedula=eq.${cedulaFila}`)).cuerpo as unknown[];
      expect(despues.length, "no debe crearse solicitud").toBe(antes.length);
      if (caso.nombre.startsWith("correo")) {
        // la cédula nueva tampoco queda con solicitud
        const nuevas = (await adminRest(`solicitudes_afiliacion?select=id&cedula=eq.${cedula}`)).cuerpo as unknown[];
        expect(nuevas).toHaveLength(0);
      }
    });
  }

  test("control: datos nuevos sí crean la solicitud", async ({ page }) => {
    await limpiarLimites();
    const cedula = cedulaUnica();
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos(cedula));
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/, { timeout: 45_000 });
    const filas = (await adminRest(`solicitudes_afiliacion?select=id,estado&cedula=eq.${cedula}`)).cuerpo as { estado: string }[];
    expect(filas).toHaveLength(1);
    await adminRest(`solicitudes_afiliacion?cedula=eq.${cedula}`, { method: "DELETE" });
  });
});

// ---------------------------------------------------------------------------
// 3. Pausa y avisos
// ---------------------------------------------------------------------------
async function reanudarEnBase() {
  await adminRest("configuracion_plataforma?id=eq.true", { method: "PATCH", body: JSON.stringify({ cuenta_pausada: false, mensaje_pausa: null }) });
}
async function borrarAvisosQA() {
  await adminRest("avisos_asociados?titulo=like.QA%25", { method: "DELETE" });
}

test.describe("3 · Plataforma: pausa y avisos", () => {
  test.afterAll(async () => {
    await reanudarEnBase();
    await borrarAvisosQA();
  });

  test("pausar → asociado en /cuenta-pausada; admin y asesor entran; reanudar → /cuenta", async ({ browser, page }, testInfo) => {
    const ctxAsociado = await contextoConSesion(browser, "conSolicitud", testInfo);
    const asociado = await ctxAsociado.newPage();
    await asociado.goto("/cuenta");
    await expect(asociado).toHaveURL(/\/cuenta$/);

    await entrar(page, ADMIN, "/admin");
    await page.goto("/admin/plataforma");
    await expect(page.locator("h1")).toHaveText("Plataforma");
    await expect(page.getByText("Abierto: los asociados entran con normalidad.")).toBeVisible();
    await capturaCompleta(page, "r3-plataforma", testInfo);
    await page.locator("#pausa-mensaje").fill("Mantenimiento QA: volvemos en un rato.");
    await page.getByRole("button", { name: "Pausar el ingreso de asociados" }).click();
    await expect(page.getByText("En pausa: los asociados no pueden entrar a su cuenta.")).toBeVisible();
    await capturaCompleta(page, "r3-plataforma-pausada", testInfo);
    const { cuerpo } = await adminRest("configuracion_plataforma?select=cuenta_pausada,mensaje_pausa");
    expect((cuerpo as Record<string, unknown>[])[0]).toMatchObject({ cuenta_pausada: true, mensaje_pausa: "Mantenimiento QA: volvemos en un rato." });

    // El asociado: /cuenta y subrutas
    for (const ruta of ["/cuenta", "/cuenta/perfil", "/cuenta/solicitar", "/cuenta/carne"]) {
      await asociado.goto(ruta);
      await expect(asociado, `ruta ${ruta}`).toHaveURL(/\/cuenta-pausada$/);
    }
    await expect(asociado.locator("h1")).toHaveText("Volvemos pronto");
    await expect(asociado.getByText("Mantenimiento QA: volvemos en un rato.")).toBeVisible();
    const wa = asociado.getByRole("link", { name: "Escribir por WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/57\d{10}/);
    await expect(asociado.getByRole("button", { name: "Salir" })).toBeVisible();
    await expect(asociado.getByTestId("whatsapp-flotante")).toHaveCount(0);
    await capturaCompleta(asociado, "r3-cuenta-pausada", testInfo);

    // Admin sigue entrando a /admin y a /cuenta (no cae en la pausa)
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/cuenta");
    await expect(page).not.toHaveURL(/cuenta-pausada/);

    // Asesor entra
    const ctxAsesor = await browser.newContext({ ...testInfo.project.use });
    const pAsesor = await ctxAsesor.newPage();
    await entrar(pAsesor, ASESOR, "/asesor");
    await expect(pAsesor).not.toHaveURL(/cuenta-pausada/);
    await pAsesor.goto("/cuenta");
    await expect(pAsesor).not.toHaveURL(/cuenta-pausada/);
    await ctxAsesor.close();

    // Reanudar
    await page.goto("/admin/plataforma");
    await page.getByRole("button", { name: "Reanudar el ingreso" }).click();
    await expect(page.getByText("Abierto: los asociados entran con normalidad.")).toBeVisible();
    await asociado.goto("/cuenta-pausada");
    await expect(asociado).toHaveURL(/\/cuenta$/);
    await asociado.goto("/cuenta/perfil");
    await expect(asociado).toHaveURL(/\/cuenta\/perfil$/);
    await ctxAsociado.close();
  });

  test("pausado: «Salir» cierra sesión y lleva a /ingresar", async ({ browser, page }, testInfo) => {
    await entrar(page, ADMIN, "/admin");
    await page.goto("/admin/plataforma");
    await page.locator("#pausa-mensaje").fill("");
    await page.getByRole("button", { name: "Pausar el ingreso de asociados" }).click();
    await expect(page.getByText("En pausa:")).toBeVisible();

    const ctx = await browser.newContext({ ...testInfo.project.use });
    const asociado = await ctx.newPage();
    // Ingreso nuevo durante la pausa: cae en /cuenta-pausada con el mensaje por defecto.
    await limpiarLimites();
    await esperarVentanaReenvio(USUARIOS.sinSolicitudes.correo);
    const inicio = await pedirCodigo(asociado, USUARIOS.sinSolicitudes.cedula);
    await llenarOtp(asociado, await esperarCodigo(USUARIOS.sinSolicitudes.correo, inicio));
    await asociado.getByRole("button", { name: "Entrar a mi cuenta" }).click();
    // Tras el ingreso, la URL puede quedarse en /cuenta aunque se muestre la pausa (redirección del proxy dentro de la acción): se valida el contenido.
    await expect(asociado.locator("h1")).toHaveText("Volvemos pronto", { timeout: 60_000 });
    await expect(asociado.getByText(/Estamos haciendo ajustes en la plataforma/)).toBeVisible();
    await asociado.getByRole("button", { name: "Salir" }).click();
    await expect(asociado).toHaveURL(/\/ingresar$/);
    await asociado.goto("/cuenta");
    await expect(asociado).toHaveURL(/\/ingresar$/);
    await ctx.close();

    await page.getByRole("button", { name: "Reanudar el ingreso" }).click();
    await expect(page.getByText("Abierto:")).toBeVisible();
  });

  test("aviso: se ve una vez, «Entendido», contador «Visto por N», Retirar", async ({ browser, page }, testInfo) => {
    const ctxB = await contextoConSesion(browser, "conSolicitud", testInfo);
    const ctxC = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const b = await ctxB.newPage();
    const c = await ctxC.newPage();

    await entrar(page, ADMIN, "/admin");
    await page.goto("/admin/plataforma");
    await page.locator("#aviso-titulo").fill("QA Aviso de prueba");
    await page.locator("#aviso-mensaje").fill("Este es un aviso de QA.\nSegunda línea.");
    await page.getByRole("button", { name: "Publicar aviso" }).click();
    const fila = page.locator("li", { hasText: "QA Aviso de prueba" });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText("Activo");
    await expect(fila).toContainText("Visto por 0 asociados");

    await b.goto("/cuenta");
    await expect(b.getByText("Aviso de la cooperativa")).toBeVisible();
    await expect(b.getByRole("heading", { name: "QA Aviso de prueba" })).toBeVisible();
    await capturaCompleta(b, "r3-aviso", testInfo);
    await b.getByRole("button", { name: "Entendido" }).click();
    await expect(b.getByText("Aviso de la cooperativa")).toHaveCount(0);
    await b.waitForTimeout(1500);
    await b.reload();
    await expect(b.getByRole("heading", { name: "QA Aviso de prueba" })).toHaveCount(0);
    await b.goto("/cuenta/perfil");
    await expect(b.getByRole("heading", { name: "QA Aviso de prueba" })).toHaveCount(0);

    await page.reload();
    await expect(page.locator("li", { hasText: "QA Aviso de prueba" })).toContainText("Visto por 1 asociado");

    // Retirar: C (que no lo había visto) ya no lo ve
    await page.locator("li", { hasText: "QA Aviso de prueba" }).getByRole("button", { name: "Retirar" }).click();
    await expect(page.locator("li", { hasText: "QA Aviso de prueba" })).toContainText("Retirado");
    await c.goto("/cuenta");
    await expect(c.getByRole("heading", { name: "QA Aviso de prueba" })).toHaveCount(0);
    await ctxB.close();
    await ctxC.close();
  });

  test("aviso: el asociado que no lo había visto lo ve y se marca solo al cerrar", async ({ browser, page }, testInfo) => {
    const ctxC = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const c = await ctxC.newPage();
    await entrar(page, ADMIN, "/admin");
    await page.goto("/admin/plataforma");
    await page.locator("#aviso-titulo").fill("QA Segundo aviso");
    await page.locator("#aviso-mensaje").fill("Segundo aviso de QA.");
    await page.getByRole("button", { name: "Publicar aviso" }).click();
    await expect(page.locator("li", { hasText: "QA Segundo aviso" })).toBeVisible();
    await c.goto("/cuenta");
    await expect(c.getByRole("heading", { name: "QA Segundo aviso" })).toBeVisible();
    // Escape también lo marca como visto (después de hidratar)
    await c.waitForLoadState("networkidle");
    await c.keyboard.press("Escape");
    await expect(c.getByRole("heading", { name: "QA Segundo aviso" })).toHaveCount(0);
    await c.waitForTimeout(1500);
    await c.reload();
    await expect(c.getByRole("heading", { name: "QA Segundo aviso" })).toHaveCount(0);
    // Un asesor no ve avisos en /asesor
    await ctxC.close();
  });
});

// ---------------------------------------------------------------------------
// 4. Botón flotante de WhatsApp
// ---------------------------------------------------------------------------
test.describe("4 · Botón flotante de WhatsApp", () => {
  const GENERICO = encodeURIComponent("Hola, quiero información sobre Green Alliance");

  for (const ruta of ["/", "/afiliacion"]) {
    test(`visible en ${ruta} con mensaje genérico`, async ({ page }, testInfo) => {
      await page.goto(ruta);
      const boton = page.getByTestId("whatsapp-flotante");
      await expect(boton).toHaveCount(1);
      await expect(boton).toBeVisible();
      const href = (await boton.getAttribute("href")) ?? "";
      expect(href).toMatch(/^https:\/\/wa\.me\/57\d{10}\?text=/);
      expect(href).toContain(GENERICO);
      await expect(boton).toHaveAttribute("target", "_blank");
      await expect(boton).toHaveAttribute("rel", /noopener/);
      await capturaCompleta(page, `r4-whatsapp-${ruta === "/" ? "inicio" : "afiliacion"}`, testInfo);
    });
  }

  test("/cuenta: uno solo, con el nombre; en celular no tapa la barra inferior", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    const boton = page.getByTestId("whatsapp-flotante");
    await expect(boton).toHaveCount(1);
    const href = decodeURIComponent((await boton.getAttribute("href")) ?? "");
    expect(href).toContain("Hola, soy Asociado de Prueba, de la Cooperativa Green Alliance");
    expect(href).not.toContain(USUARIOS.conSolicitud.cedula);
    await page.goto("/cuenta/perfil");
    await expect(page.getByTestId("whatsapp-flotante")).toHaveCount(1);
    await page.goto("/cuenta");
    await capturaCompleta(page, "r4-whatsapp-cuenta", testInfo);
    await page.screenshot({ path: `test-results/qa/r4-whatsapp-cuenta-viewport-${testInfo.project.name}.png` });

    if (testInfo.project.name === "celular") {
      const caja = (await boton.boundingBox())!;
      const barras = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((e) => {
            const s = getComputedStyle(e);
            const r = e.getBoundingClientRect();
            return (s.position === "fixed" || s.position === "sticky") && r.width > 200 && r.height > 30 && r.top > window.innerHeight / 2 && e.dataset.testid !== "whatsapp-flotante";
          })
          .map((e) => ({ tag: e.tagName, top: e.getBoundingClientRect().top, h: e.getBoundingClientRect().height })),
      );
      console.log("barras fijas inferiores:", JSON.stringify(barras), "boton:", JSON.stringify(caja));
      for (const barra of barras) expect(caja.y + caja.height, "el botón no debe pisar la barra").toBeLessThanOrEqual(barra.top + 1);
    }
    await ctx.close();
  });

  test("no aparece en /admin ni /asesor", async ({ page }) => {
    await entrar(page, ADMIN, "/admin");
    for (const ruta of ["/admin", "/admin/asociados", "/admin/plataforma"]) {
      await page.goto(ruta);
      await expect(page.getByTestId("whatsapp-flotante"), ruta).toHaveCount(0);
    }
  });

  test("no aparece en /asesor", async ({ page }) => {
    await entrar(page, ASESOR, "/asesor");
    await page.goto("/asesor");
    await expect(page.getByTestId("whatsapp-flotante")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Selfie
// ---------------------------------------------------------------------------
/** Dibuja una «foto de una cara» razonable (fondo, cara, pelo, ojos, boca) con algo de ruido de sensor. */
const DIBUJAR = `
function ga_dibujar(c, ruido, oscuro) {
  const x = c.getContext('2d'); const w = c.width, h = c.height;
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#9fb3c0'); g.addColorStop(1, '#6f8794');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#4a3326'; x.beginPath(); x.ellipse(w/2, h*0.42, w*0.19, h*0.34, 0, 0, 7); x.fill();
  const r = x.createRadialGradient(w/2, h*0.45, 10, w/2, h*0.45, w*0.17); r.addColorStop(0, '#e2b79a'); r.addColorStop(1, '#c08d6d');
  x.fillStyle = r; x.beginPath(); x.ellipse(w/2, h*0.48, w*0.15, h*0.28, 0, 0, 7); x.fill();
  x.fillStyle = '#2b1d16'; for (const dx of [-0.06, 0.06]) { x.beginPath(); x.ellipse(w/2 + w*dx, h*0.42, w*0.018, h*0.014, 0, 0, 7); x.fill(); }
  x.strokeStyle = '#8a4a3d'; x.lineWidth = 6; x.beginPath(); x.arc(w/2, h*0.56, w*0.05, 0.1*Math.PI, 0.9*Math.PI); x.stroke();
  x.fillStyle = '#2f4a63'; x.fillRect(w*0.3, h*0.82, w*0.4, h*0.18);
  if (ruido) { const d = x.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * ruido; d.data[i] += n; d.data[i+1] += n; d.data[i+2] += n; } x.putImageData(d, 0, 0); }
  if (oscuro) { x.fillStyle = 'rgba(0,0,0,' + oscuro + ')'; x.fillRect(0, 0, w, h); }
}
`;

test.describe("5 · Aviso de selfie borrosa u oscura", () => {
  async function irAlFormulario(page: Page, ancho: number, alto: number, ruido: number, oscuro: number) {
    await page.addInitScript(
      ({ dibujar, ancho, alto, ruido, oscuro }) => {
        // eslint-disable-next-line no-new-func
        const f = new Function(`${dibujar}; return ga_dibujar;`)();
        const lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;
        f(lienzo, ruido, oscuro);
        const flujo = lienzo.captureStream(15);
        navigator.mediaDevices.getUserMedia = async () => flujo;
        (window as unknown as Record<string, unknown>).__f = f;
      },
      { dibujar: DIBUJAR, ancho, alto, ruido, oscuro },
    );
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
  }

  const AVISO = /Puede que la selfie esté borrosa u oscura/;

  test("cámara simulada con imagen normal (1280×720, ruido leve): no sale el aviso", async ({ page }, testInfo) => {
    await irAlFormulario(page, 1280, 720, 6, 0);
    const boton = page.getByRole("button", { name: "Tomar selfie" });
    await boton.scrollIntoViewIfNeeded();
    await boton.click();
    await page.getByRole("button", { name: "Tomar selfie" }).click();
    await expect(page.getByAltText("Vista previa: tu selfie")).toBeVisible();
    await page.waitForTimeout(1500);
    await capturaCompleta(page, "r5-selfie-normal", testInfo);
    await expect(page.getByText(AVISO)).toHaveCount(0);
  });

  test("cámara simulada 640×480 sin ruido (peor caso de un celular): no sale el aviso", async ({ page }, testInfo) => {
    await irAlFormulario(page, 640, 480, 0, 0);
    await page.getByRole("button", { name: "Tomar selfie" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Tomar selfie" }).click();
    await page.getByRole("button", { name: "Tomar selfie" }).click();
    await expect(page.getByAltText("Vista previa: tu selfie")).toBeVisible();
    await page.waitForTimeout(1500);
    await capturaCompleta(page, "r5-selfie-640", testInfo);
    await expect(page.getByText(AVISO)).toHaveCount(0);
  });

  test("control: imagen casi negra sí muestra el aviso", async ({ page }, testInfo) => {
    await irAlFormulario(page, 1280, 720, 0, 0.9);
    await page.getByRole("button", { name: "Tomar selfie" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Tomar selfie" }).click();
    await page.getByRole("button", { name: "Tomar selfie" }).click();
    await expect(page.getByText(AVISO)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Tomar la selfie de nuevo" })).toBeVisible();
    await capturaCompleta(page, "r5-selfie-oscura", testInfo);
  });
});
