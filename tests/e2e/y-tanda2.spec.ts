/**
 * Y. Tanda 2 de requerimientos (spec-requerimientos-ricardo-2026-09-29 §8–§12) y
 * cambios del 30-sep/1-oct: landing, convenios con modal, crédito solo con proceso
 * «operando», /cuenta/solicitar (3t), F-01, desembolso, baja, sorteo con ganador
 * visible y dashboards de admin/asesor (3r/3s). Seguridad de las RPC nuevas.
 *
 * Solo contra Supabase LOCAL (utils.ts se niega a correr si no). Las pruebas que
 * escriben (desembolso, baja, sorteo) corren solo en escritorio, en serie, y dejan
 * la base como estaba salvo el sorteo (inmutable por diseño): para repetir, correr
 * antes `npx supabase db reset`.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  adminRest,
  anonRest,
  borrarAfiliaciones,
  cedulaUnica,
  contextoConSesion,
  datosValidos,
  esEscritorio,
  esperarCodigo,
  esperarVentanaReenvio,
  limpiarLimites,
  llenarAfiliacion,
  llenarOtp,
  pedirCodigo,
  restaurarCreditoDeEjemplo,
  tokenDeUsuario,
  USUARIOS,
  usuarioRest,
} from "./utils";

const ADMIN = {
  cedula: "1234567899",
  correo: "admin.prueba@greenalliance.test",
};
const ASESOR = {
  cedula: "1234567892",
  correo: "asesor.prueba@greenalliance.test",
};
const OPERANDO = {
  id: "3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b01",
  cedula: "1234567893",
  correo: "operando.prueba@greenalliance.test",
  nombre: "Asociado Operando de Prueba",
};
const SIN_CUPO = {
  id: "3a9c1e52-7b1d-4c3e-8f2a-5d6e7f8a9b02",
  cedula: "1234567894",
  correo: "sin.cupo@greenalliance.test",
};
const ID_ASOCIADO_2 = "7d1f0c2a-3b4e-4f5a-8b6c-9d0e1f2a3b4c"; // sinSolicitudes (seed.sql)

const rpc = (nombre: string, token: string, cuerpo: Record<string, unknown>) =>
  usuarioRest(`rpc/${nombre}`, token, {
    method: "POST",
    body: JSON.stringify(cuerpo),
  });

async function ingresar(page: Page, cedula: string, correo: string) {
  await limpiarLimites();
  await esperarVentanaReenvio(correo);
  const inicio = await pedirCodigo(page, cedula);
  const codigo = await esperarCodigo(correo, inicio);
  await llenarOtp(page, codigo);
  await page.getByRole("button", { name: "Entrar a mi cuenta" }).click();
}

// ---------------------------------------------------------------------------
// Y1 · Landing (§12.8 y decisión 30-sep) y convenios como botones con modal
// ---------------------------------------------------------------------------
test.describe("Y1 · Landing", () => {
  test("Sin «Embargo solidario a 36 meses», sin «+200», sin «4 horas»; misión con el Ejército", async ({
    page,
  }) => {
    await page.goto("/");
    const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(texto).not.toContain("Embargo solidario a 36 meses");
    expect(texto).not.toMatch(/\+\s?200/);
    expect(texto).not.toMatch(/4 horas/i);
    expect(texto).toContain("Policía Nacional y el Ejército Nacional");
  });

  test("Convenios: cada marca es un botón que abre un diálogo con su detalle; Esc lo cierra", async ({
    page,
  }) => {
    await page.goto("/#c-convenios");
    const botones = page.locator("#c-convenios button[aria-haspopup='dialog']");
    expect(await botones.count()).toBeGreaterThanOrEqual(5);
    // Ningún convenio es un enlace a otra página.
    await expect(
      page.locator("#c-convenios a[href^='/convenios']"),
    ).toHaveCount(0);
    const primero = botones.first();
    const nombre = (await primero.locator("strong").innerText()).trim();
    await primero.click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(nombre);
    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
    await expect(primero).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Y2 · F-01: Institución y Grado no se vacían tras un error del servidor
// ---------------------------------------------------------------------------
test.describe("Y2 · F-01 /afiliacion", () => {
  test("S-06: cédula con solicitud pendiente responde igual que un envío exitoso y no guarda otra fila", async ({
    page,
  }) => {
    const cedula = cedulaUnica();
    try {
      await limpiarLimites();
      await page.goto("/afiliacion");
      await llenarAfiliacion(page, { ...datosValidos(cedula), acepto: true });
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
      await page.waitForURL("**/afiliacion/enviada", { timeout: 30_000 });

      await page.goto("/afiliacion");
      const d = {
        ...datosValidos(cedula),
        institucion: "ejercito" as const,
        grado: "",
        acepto: true,
      };
      d.correoInstitucional = `laura.qa.${cedula}@ejercito.mil.co`;
      await llenarAfiliacion(page, d);
      const grado = await page
        .locator("#af-grado option")
        .nth(1)
        .getAttribute("value");
      await page.locator("#af-grado").selectOption(grado ?? "");
      await page.getByRole("button", { name: "Enviar solicitud" }).click();
      await page.waitForURL("**/afiliacion/enviada", { timeout: 30_000 });
      await expect(page.locator("#af-cc-error")).toHaveCount(0);
      const { cuerpo } = await adminRest(
        `solicitudes_afiliacion?select=id&cedula=eq.${cedula}`,
      );
      expect((cuerpo as unknown[]).length).toBe(1);
    } finally {
      await borrarAfiliaciones(cedula);
    }
  });
});

// ---------------------------------------------------------------------------
// Y3 · /cuenta/solicitar (3t) y crédito solo con proceso «operando» (§8)
// ---------------------------------------------------------------------------
test.describe("Y3 · /cuenta/solicitar", () => {
  test("Con proceso operando: radios 50 % y 100 % sin elegir de entrada, cupo visible y sin tasa", async ({
    browser,
  }, testInfo) => {
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta/solicitar");
    const r50 = page.getByRole("radio", { name: /50\s?%/ });
    const r100 = page.getByRole("radio", { name: /100\s?%/ });
    await expect(r50).toBeVisible();
    await expect(r50).not.toBeChecked();
    await expect(r100).not.toBeChecked();
    const texto = await page.locator("main").innerText();
    expect(texto).toContain("$3.000.000"); // cupo grupo SI al 100 %
    expect(texto).not.toMatch(/inter[eé]s|tasa/i);
    await ctx.close();
  });

  test("Proceso fuera de «operando» → aviso y sin formulario; la base también lo rechaza", async ({
    browser,
  }, testInfo) => {
    test.skip(
      !esEscritorio(testInfo),
      "Escribe en la base: solo una vez (escritorio)",
    );
    const admin = await tokenDeUsuario(ADMIN.correo);
    const cambiar = (estado: string) =>
      rpc("admin_actualizar_proceso_ejecutivo", admin, {
        p_asociado_id: ID_ASOCIADO_2,
        p_estado: estado,
        p_fecha_inicio_embargo: null,
      });
    const { cuerpo: antes } = await adminRest(
      `procesos_ejecutivos?select=estado,fecha_inicio_embargo&asociado_id=eq.${ID_ASOCIADO_2}`,
    );
    const original = (
      antes as { estado: string; fecha_inicio_embargo: string }[]
    )[0];
    try {
      const r = await cambiar("liquidacion");
      expect(r.status, JSON.stringify(r.cuerpo)).toBeLessThan(300);
      const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
      const page = await ctx.newPage();
      await page.goto("/cuenta/solicitar");
      await expect(page.locator("main")).toContainText(
        "Podrás pedir tu crédito cuando tu proceso esté operando",
      );
      await expect(page.getByRole("radio")).toHaveCount(0);
      await ctx.close();

      const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
      const ins = await usuarioRest("solicitudes_credito", token, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          asociado_id: ID_ASOCIADO_2,
          porcentaje_devolucion: "50",
          monto_solicitado: 500000,
        }),
      });
      expect(ins.status).toBeGreaterThanOrEqual(400);
    } finally {
      await adminRest(`procesos_ejecutivos?asociado_id=eq.${ID_ASOCIADO_2}`, {
        method: "PATCH",
        body: JSON.stringify({
          estado: original.estado,
          fecha_inicio_embargo: original.fecha_inicio_embargo,
        }),
      });
      await adminRest(`solicitudes_credito?asociado_id=eq.${ID_ASOCIADO_2}`, {
        method: "DELETE",
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Y4 · Seguridad de las RPC nuevas: ni anon ni un asociado pueden usarlas
// ---------------------------------------------------------------------------
test.describe("Y4 · RPC de admin cerradas para anon y asociados", () => {
  const llamadas = [
    [
      "admin_marcar_desembolsado",
      { p_solicitud_id: "00000000-0000-0000-0000-000000000000", p_fecha: null },
    ],
    [
      "admin_cambiar_estado_asociado",
      {
        p_asociado_id: ID_ASOCIADO_2,
        p_activo: false,
        p_motivo: "Intento indebido",
      },
    ],
    ["admin_realizar_sorteo", { p_mes: "2026-08-01" }],
    ["admin_metricas_dashboard", {}],
  ] as const;
  for (const [nombre, cuerpo] of llamadas) {
    test(`${nombre}: anon y asociado reciben error`, async () => {
      const a = await anonRest(`rpc/${nombre}`, {
        method: "POST",
        body: JSON.stringify(cuerpo),
      });
      expect(a.status, JSON.stringify(a.cuerpo)).toBeGreaterThanOrEqual(400);
      const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
      const u = await rpc(nombre, token, cuerpo);
      // 200 con null (sin datos) también es no-fuga (migración 20261001100000).
      if (u.status < 300) expect(u.cuerpo, JSON.stringify(u.cuerpo)).toBeNull();
      else expect(u.status).toBeGreaterThanOrEqual(400);
    });
  }
  test("asesor_metricas_dashboard: un asociado no ve conteos de asesor", async () => {
    const token = await tokenDeUsuario(USUARIOS.sinSolicitudes.correo);
    const u = await rpc("asesor_metricas_dashboard", token, {});
    if (u.status < 300) expect(JSON.stringify(u.cuerpo)).not.toMatch(/[1-9]/);
    else expect(u.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// Y5 · Flujos de admin (escritorio, en serie): desembolso, baja, sorteo y dashboards
// ---------------------------------------------------------------------------
test.describe("Y5 · Admin: desembolso, baja, sorteo y dashboards", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "Escribe en la base: solo escritorio");

  test("Desembolso (§12.2): «Aprobado · pendiente de desembolso» → «Desembolsado»", async ({
    browser,
  }, testInfo) => {
    // k-roles deja el crédito de ejemplo aprobado/rechazado: se restaura a «pendiente».
    await restaurarCreditoDeEjemplo();
    const admin = await tokenDeUsuario(ADMIN.correo);
    const { cuerpo } = await adminRest(
      "solicitudes_credito?select=id&asociado_id=eq.4c7808d8-085f-42ed-9e5d-f53c117b4cd1&estado=eq.pendiente",
    );
    const id = (cuerpo as { id: string }[])[0]?.id;
    expect(id, "crédito de ejemplo pendiente (seed)").toBeTruthy();
    try {
      const ap = await usuarioRest(`solicitudes_credito?id=eq.${id}`, admin, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado: "aprobado" }),
      });
      expect(ap.status, JSON.stringify(ap.cuerpo)).toBeLessThan(300);

      const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
      const page = await ctx.newPage();
      await page.goto("/cuenta");
      await expect(page.locator("main")).toContainText(
        "Aprobado · pendiente de desembolso",
      );

      // El asociado no puede marcarlo.
      const tokenAsociado = await tokenDeUsuario(USUARIOS.conSolicitud.correo);
      const propio = await rpc("admin_marcar_desembolsado", tokenAsociado, {
        p_solicitud_id: id,
        p_fecha: null,
      });
      expect(propio.status).toBeGreaterThanOrEqual(400);

      const r = await rpc("admin_marcar_desembolsado", admin, {
        p_solicitud_id: id,
        p_fecha: null,
      });
      expect(r.status, JSON.stringify(r.cuerpo)).toBeLessThan(300);
      const { cuerpo: fila } = await adminRest(
        `solicitudes_credito?select=fecha_desembolso,desembolsado_por&id=eq.${id}`,
      );
      const f = (
        fila as {
          fecha_desembolso: string | null;
          desembolsado_por: string | null;
        }[]
      )[0];
      expect(f.fecha_desembolso).toBeTruthy();
      expect(f.desembolsado_por).toBeTruthy();

      await page.reload();
      await expect(page.locator("main")).toContainText("Desembolsado");
      await expect(page.locator("main")).not.toContainText(
        "pendiente de desembolso",
      );
      await ctx.close();
    } finally {
      await restaurarCreditoDeEjemplo();
    }
  });

  test("Baja (§12.6): motivo obligatorio; el asociado dado de baja ve «Tu cuenta está inactiva»; se reactiva", async ({
    page,
  }) => {
    const admin = await tokenDeUsuario(ADMIN.correo);
    const sinMotivo = await rpc("admin_cambiar_estado_asociado", admin, {
      p_asociado_id: SIN_CUPO.id,
      p_activo: false,
      p_motivo: "",
    });
    expect(sinMotivo.status).toBeGreaterThanOrEqual(400);
    try {
      const baja = await rpc("admin_cambiar_estado_asociado", admin, {
        p_asociado_id: SIN_CUPO.id,
        p_activo: false,
        p_motivo: "Prueba automática de QA (baja)",
      });
      expect(baja.status, JSON.stringify(baja.cuerpo)).toBeLessThan(300);
      await ingresar(page, SIN_CUPO.cedula, SIN_CUPO.correo);
      await page.waitForURL(/\/ingresar/, { timeout: 30_000 });
      await expect(page.locator("main")).toContainText(
        "Tu cuenta está inactiva. Comunícate con la cooperativa.",
      );
      await page.goto("/cuenta");
      await expect(page).not.toHaveURL(/\/cuenta$/);
    } finally {
      const re = await rpc("admin_cambiar_estado_asociado", admin, {
        p_asociado_id: SIN_CUPO.id,
        p_activo: true,
        p_motivo: "Prueba automática de QA (reactivar)",
      });
      expect(re.status, JSON.stringify(re.cuerpo)).toBeLessThan(300);
    }
  });

  test("Sorteo (§12.10): una vez por mes y ganador visible solo con grado y nombre", async ({
    browser,
  }, testInfo) => {
    const hoy = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
    );
    const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const anio = anterior.getFullYear();
    const mes = anterior.getMonth() + 1;
    const pMes = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const numero = "424242";

    const bol = await adminRest("boletas_sorteo", {
      method: "POST",
      body: JSON.stringify({
        asociado_id: OPERANDO.id,
        anio,
        mes,
        numero,
        estado: "confirmada",
        fecha_confirmacion: new Date().toISOString(),
      }),
    });
    expect(bol.status, JSON.stringify(bol.cuerpo)).toBeLessThan(300);

    const admin = await tokenDeUsuario(ADMIN.correo);
    const r = await rpc("admin_realizar_sorteo", admin, { p_mes: pMes });
    expect(r.status, JSON.stringify(r.cuerpo)).toBeLessThan(300);
    const ganador = (
      r.cuerpo as { asociado_id: string; participantes: number }[]
    )[0];
    expect(ganador.asociado_id).toBe(OPERANDO.id);
    expect(ganador.participantes).toBe(1);

    const otra = await rpc("admin_realizar_sorteo", admin, { p_mes: pMes });
    expect(otra.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(otra.cuerpo)).toContain("ya se realizó");

    // Visible para otro asociado con sesión, sin cédula ni número de boleta.
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    const banda = page.getByText(/Ganador del sorteo de/);
    await expect(banda).toBeVisible();
    await expect(banda).toContainText(OPERANDO.nombre);
    const texto = await page.locator("body").innerText();
    expect(texto).not.toContain(numero);
    expect(texto).not.toContain(OPERANDO.cedula);
    await ctx.close();

    // No se publica en la landing pública.
    const anon = await browser.newContext();
    const landing = await anon.newPage();
    await landing.goto("/");
    await expect(landing.getByText(/Ganador del sorteo/)).toHaveCount(0);
    await anon.close();
  });

  test("Dashboard admin (3r) y «Resumen» del asesor (3s): solo cifras, sin datos personales", async ({
    page,
  }) => {
    await ingresar(page, ADMIN.cedula, ADMIN.correo);
    await page.waitForURL("**/admin");
    await expect(page.locator("h1")).toHaveText("Resumen de clientes");
    await expect(
      page.getByRole("heading", { name: "Asociados por grado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Por institución" }),
    ).toBeVisible();
    let cuerpo = await page.locator("main").innerText();
    expect(cuerpo).not.toMatch(/@greenalliance\.test/);
    expect(cuerpo).not.toMatch(/\b\d{10}\b/);
    expect(cuerpo).not.toMatch(/inter[eé]s|tasa/i);

    await page.context().clearCookies();
    await ingresar(page, ASESOR.cedula, ASESOR.correo);
    await page.waitForURL("**/asesor");
    await page
      .getByRole("button", { name: "Resumen" })
      .first()
      .click()
      .catch(() => undefined);
    await expect(page.locator("h1")).toHaveText("Resumen");
    cuerpo = await page.locator("main").innerText();
    expect(cuerpo).not.toMatch(/@greenalliance\.test/);
    expect(cuerpo).not.toMatch(/\b\d{10}\b/);
  });
});
