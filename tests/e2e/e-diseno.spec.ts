import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  capturaCompleta,
  CEDULA_NO_REGISTRADA,
  contextoConSesion,
  datosValidos,
  esEscritorio,
  limpiarLimites,
  llenarAfiliacion,
  pedirCodigo,
  revisarOrden,
  textoVisible,
  USUARIOS,
} from "./utils";

/**
 * E. Fidelidad al diseño (design/*.dc.html): textos en el mismo orden,
 * verde #1E6652 en primarios, borde navy #1A3C57 en secundarios, Manrope.
 * Los marcadores del diseño se reemplazan por el dato real (correo
 * enmascarado, nombre, montos). Captura completa en test-results/qa/.
 */

const VERDE = "rgb(30, 102, 82)";
const NAVY = "rgb(26, 60, 87)";

const CONVENIOS_LANDING = [
  "AMB Móvil S.A.S.",
  "Tecnología",
  "Locos por los Viajes S.A.S.",
  "Viajes y turismo",
  "Dr. Ribero Dental Group",
  "Odontología estética",
  "Racing Tours Villa de Leyva",
  "Tours en Villa de Leyva",
  "Dream & Go Visas",
  "Trámite de visas",
];

const APOYOS = [
  "Tres apoyos, una cooperativa",
  "Microcréditos",
  "Montos según tu grado, modalidad 50% o 100%, todo en línea.",
  "Orientación financiera",
  "Una conversación para ordenar tus cuentas antes de endeudarte.",
  "Apoyo legal",
  "Acompañamiento en trámites para ti y tu familia.",
  "Lo que hicieron con su crédito",
];

async function revisarEstilos(page: Page, primarios: string[], secundarios: string[]) {
  // Puntero fuera de los botones: sin :hover (verde oscuro) al medir.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(500); // fin de la transición de color
  for (const texto of primarios) {
    const el = page.getByRole("button", { name: texto, exact: true }).or(page.getByRole("link", { name: texto, exact: true })).first();
    await expect(el, `primario «${texto}»`).toBeVisible();
    const fondo = await el.evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(fondo, `fondo de «${texto}»`).toBe(VERDE);
  }
  for (const texto of secundarios) {
    const el = page.getByRole("link", { name: texto, exact: true }).first();
    await expect(el, `secundario «${texto}»`).toBeVisible();
    const estilo = await el.evaluate((n) => {
      const s = getComputedStyle(n);
      // Chrome redondea 1.5px a píxeles enteros en el estilo calculado: se lee la regla CSS.
      let declarado = "";
      for (const hoja of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(hoja.cssRules) as CSSStyleRule[]) {
            if (r.selectorText && n.matches(r.selectorText) && r.style?.borderWidth) declarado = r.style.borderWidth;
          }
        } catch {
          /* hojas de otro origen */
        }
      }
      return { color: s.borderTopColor, declarado };
    });
    expect(estilo.color, `borde de «${texto}»`).toBe(NAVY);
    expect(estilo.declarado, `grosor del borde de «${texto}»`).toBe("1.5px");
  }
  // Fuente: Manrope cargada y aplicada al cuerpo, títulos y botones.
  const fuente = await page.evaluate(async () => {
    await document.fonts.ready;
    const h1 = document.querySelector("h1")!;
    return {
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(h1).fontFamily,
      cargada: document.fonts.check("16px Manrope") || Array.from(document.fonts).some((f) => /manrope/i.test(f.family) && f.status === "loaded"),
    };
  });
  expect(fuente.body.toLowerCase()).toContain("manrope");
  expect(fuente.h1.toLowerCase()).toContain("manrope");
  expect(fuente.cargada).toBe(true);
}

async function revisarTextos(page: Page, esperados: string[], nombre: string, testInfo: TestInfo) {
  const texto = await textoVisible(page);
  const problemas = revisarOrden(texto, esperados);
  await capturaCompleta(page, nombre, testInfo);
  expect(problemas, `Textos del diseño en ${nombre} (${testInfo.project.name})`).toEqual([]);
}

test.describe("E · Landing /", () => {
  test("Textos, orden, colores y fuente", async ({ page }, testInfo) => {
    await page.goto("/");
    const esperados = esEscritorio(testInfo)
      ? [
          "Apoyos",
          "Historias",
          "Convenios",
          "Afíliate",
          "Mi cuenta",
          "Crédito entre compañeros, con reglas claras.",
          "Somos una cooperativa hecha por y para la familia policial. Pides en línea, sabes tu tope desde el inicio y ves cada paso de tu solicitud.",
          "Solicitar crédito",
          "Conocer la cooperativa",
          // «[Foto real de asociados…]» del diseño: reemplazado por el espacio de foto de marca decorativo (plan 5.7, aria-hidden).
          "Tu solicitud",
          "En revisión",
          "Enviada",
          "En revisión",
          "Aprobada",
          "Desembolso",
          "asociados activos",
          "créditos aprobados este año",
          "respuesta promedio",
          ...APOYOS,
          "Empresas en convenio",
          "Condiciones preferenciales para asociados, con el respaldo de la cooperativa en cada compra o servicio.",
          "Ver beneficios en mi cuenta",
          ...CONVENIOS_LANDING,
          "WhatsApp [NÚMERO] · [correo]@greenallianceco.com",
          "Vigilada por Supersolidaria",
        ]
      : [
          "Ingresar",
          "Crédito entre compañeros, con reglas claras.",
          "Somos una cooperativa hecha por y para la familia policial. Pides en línea, sabes tu tope desde el inicio y ves cada paso de tu solicitud.",
          "Solicitar crédito",
          "Quiero afiliarme",
          // «[Foto real de asociados…]» del diseño: reemplazado por el espacio de foto de marca decorativo (plan 5.7, aria-hidden).
          "Así ves tu solicitud",
          "En revisión",
          "Enviada",
          "En revisión",
          "Aprobada",
          "Desembolso",
          "asociados activos",
          "créditos aprobados",
          "respuesta promedio",
          ...APOYOS,
          "Empresas en convenio",
          "Condiciones preferenciales para asociados, con el respaldo de la cooperativa.",
          ...CONVENIOS_LANDING,
          "WhatsApp [NÚMERO] · [correo]@greenallianceco.com",
          "Vigilada por Supersolidaria",
        ];
    await revisarTextos(page, esperados, "landing", testInfo);
    await revisarEstilos(
      page,
      ["Solicitar crédito"],
      esEscritorio(testInfo) ? ["Conocer la cooperativa"] : ["Quiero afiliarme"],
    );
  });
});

test.describe("E · Ingreso paso 1 /ingresar", () => {
  test("Textos, orden, colores y fuente", async ({ page }, testInfo) => {
    await page.goto("/ingresar");
    const esperados = esEscritorio(testInfo)
      ? [
          "Hola de nuevo",
          "Entra con tu cédula y un código que te llega al correo. Sin contraseñas que recordar.",
          "Pide tu crédito según tu grado",
          "Mira el estado de tu solicitud",
          "Usa los convenios para asociados",
          "Ayuda por WhatsApp [NÚMERO]",
          "Paso 1 de 2",
          "Ingresa con tu cédula",
          "Número de cédula",
          "Si tu cédula está registrada, te enviamos un código de 6 números al correo que tienes en la cooperativa.",
          "Enviarme el código",
          "¿Aún no eres asociado?",
          "Deseo afiliarme",
        ]
      : [
          "Hola de nuevo",
          "Entra para ver cómo va tu crédito.",
          "Paso 1 de 2",
          "Número de cédula",
          "Si tu cédula está registrada, te enviamos un código de 6 números al correo que tienes en la cooperativa. No necesitas contraseña.",
          "Enviarme el código",
          "¿Aún no eres asociado?",
          "Deseo afiliarme",
          "Ayuda por WhatsApp [NÚMERO]",
        ];
    await revisarTextos(page, esperados, "ingresar", testInfo);
    await expect(page.getByLabel("Número de cédula")).toHaveAttribute("placeholder", "Sin puntos ni espacios");
    await revisarEstilos(page, ["Enviarme el código"], ["Deseo afiliarme"]);
  });
});

test.describe("E · Ingreso paso 2 /ingresar/codigo", () => {
  test("Textos, orden, colores y fuente", async ({ page }, testInfo) => {
    await limpiarLimites();
    await pedirCodigo(page, CEDULA_NO_REGISTRADA);
    const texto = await textoVisible(page);
    const mascara = /[a-z]{2}•••@[a-z.]+\.[a-z]+/.exec(texto)?.[0] ?? "<sin correo enmascarado>";
    const esperados = esEscritorio(testInfo)
      ? [
          "Revisa tu correo",
          `Te enviamos un código a ${mascara}. Vence en 10 minutos.`,
          "¿Cambiaste de correo? Escríbenos por WhatsApp [NÚMERO] para actualizarlo.",
          "Paso 2 de 2",
          "Cambiar cédula",
          "Escribe el código",
          "Código de 6 números",
          "Si no lo ves, revisa la carpeta de spam.",
          "Entrar a mi cuenta",
          "¿No te llegó?",
          "Reenviar código",
          "en 0:4",
        ]
      : [
          "Revisa tu correo",
          `Lo enviamos a ${mascara}`,
          "Paso 2 de 2",
          "Código de 6 números",
          "El código vence en 10 minutos. Si no lo ves, revisa la carpeta de spam.",
          "Entrar a mi cuenta",
          "¿No te llegó?",
          "Reenviar código",
          "en 0:4",
          "¿Cambiaste de correo? Escríbenos por WhatsApp [NÚMERO] para actualizarlo.",
        ];
    await revisarTextos(page, esperados, "ingresar-codigo", testInfo);
    await revisarEstilos(page, ["Entrar a mi cuenta"], []);
  });
});

test.describe("E · Inicio del asociado /cuenta", () => {
  test("Textos, orden, colores y fuente (asociado con solicitud)", async ({ browser }, testInfo) => {
    const u = USUARIOS.conSolicitud;
    const ctx = await contextoConSesion(browser, "conSolicitud", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    const esperados = esEscritorio(testInfo)
      ? [
          "Inicio",
          "Nueva solicitud",
          "Convenios",
          u.nombre,
          "Salir",
          `Hola, ${u.nombre}`,
          "Tu solicitud",
          "En revisión",
          "Monto solicitado",
          "$ 500.000",
          "Modalidad",
          "50%",
          "Plazo",
          "3 meses",
          "Enviada",
          "En revisión",
          "Aprobada",
          "Desembolso",
          "Te avisaremos por correo cuando cambie el estado.",
          "Tope disponible para tu grado",
          "$ 2.100.000",
          "Nueva solicitud",
          "Hablar con la cooperativa",
          "Tus convenios",
          "AMB Móvil",
          "Locos por los Viajes",
          "Dr. Ribero Dental",
          "Racing Tours",
          "Dream & Go Visas",
        ]
      : [
          "Hola,",
          u.nombre,
          "Tu solicitud",
          "En revisión",
          "Monto solicitado · modalidad 50%",
          "$ 500.000",
          "Enviada",
          "En revisión",
          "Aprobada",
          "Desembolso",
          "Te avisaremos por correo cuando cambie el estado.",
          "Tope disponible para tu grado",
          "$ 2.100.000",
          "Nueva solicitud",
          "Convenios",
          "Hablar con la cooperativa",
        ];
    await revisarTextos(page, esperados, "cuenta", testInfo);
    // «Hablar con la cooperativa»: borde verde (terciario) como en el diseño.
    const hablar = page.getByText("Hablar con la cooperativa", { exact: true });
    expect(await hablar.evaluate((n) => getComputedStyle(n).borderTopColor)).toBe(VERDE);
    await revisarEstilos(page, ["Guardar"], []);
    await ctx.close();
  });

  test("Estado vacío (asociada sin solicitudes): captura", async ({ browser }, testInfo) => {
    const ctx = await contextoConSesion(browser, "sinSolicitudes", testInfo);
    const page = await ctx.newPage();
    await page.goto("/cuenta");
    await expect(page.getByText("Todavía no tienes solicitudes de crédito")).toBeVisible();
    await capturaCompleta(page, "cuenta-vacia", testInfo);
    await ctx.close();
  });
});

test.describe("E · Afiliación /afiliacion", () => {
  test("Textos, orden, colores y fuente", async ({ page }, testInfo) => {
    await page.goto("/afiliacion");
    await page.waitForLoadState("networkidle");
    const comun = [
      "Quiero afiliarme",
      "Déjanos tus datos y el equipo de la cooperativa te contactará para completar tu afiliación.",
      "Esto no crea tu cuenta todavía. Cuando tu afiliación quede activa, podrás ingresar con tu cédula.",
    ];
    const autoriza =
      "Autorizo a la Cooperativa Green Alliance a tratar mis datos personales para gestionar mi afiliación, según su política de datos (Ley 1581 de 2012).";
    const esperados = esEscritorio(testInfo)
      ? [
          "¿Ya eres asociado? Ingresa",
          ...comun,
          "Envías este formulario.",
          "El equipo te contacta por WhatsApp o correo.",
          "Ya activo, ingresas con tu cédula.",
          "Nombres y apellidos",
          "Número de cédula",
          "Grado",
          "Selecciona tu grado",
          "Celular (WhatsApp)",
          "Correo electrónico",
          "Unidad o dependencia (opcional)",
          "¿Algo que debamos saber? (opcional)",
          autoriza,
        ]
      : [
          ...comun,
          "Nombres y apellidos",
          "Número de cédula",
          "Grado",
          "Selecciona tu grado",
          "Unidad o dependencia (opcional)",
          "Celular (WhatsApp)",
          "Correo electrónico",
          "Aquí te llegará la confirmación y, después, tus códigos de ingreso.",
          "¿Algo que debamos saber? (opcional)",
          autoriza,
          "Enviar solicitud",
          "Te enviaremos una copia de tu solicitud a tu correo.",
        ];
    await revisarTextos(page, esperados, "afiliacion", testInfo);
    if (esEscritorio(testInfo)) {
      // Diseño PC: texto de la copia a la izquierda y botón a la derecha, en la misma fila.
      const boton = await page.getByRole("button", { name: "Enviar solicitud" }).boundingBox();
      const copia = await page.getByText("Te enviaremos una copia de tu solicitud a tu correo.").boundingBox();
      expect(boton!.x).toBeGreaterThan(copia!.x + copia!.width - 1);
      expect(Math.abs(boton!.y + boton!.height / 2 - (copia!.y + copia!.height / 2))).toBeLessThan(20);
      // La ayuda del correo solo va en celular.
      await expect(page.getByText("Aquí te llegará la confirmación y, después, tus códigos de ingreso.")).toBeHidden();
      // Visual en 2 columnas: cédula y grado en la misma fila.
      const cc = await page.locator("#af-cc").boundingBox();
      const gr = await page.locator("#af-grado").boundingBox();
      expect(Math.abs(cc!.y - gr!.y)).toBeLessThan(2);
    }
    await revisarEstilos(page, ["Enviar solicitud"], []);
  });
});

test.describe("E · Afiliación enviada /afiliacion/enviada", () => {
  test("Textos, orden, colores y fuente", async ({ page }, testInfo) => {
    // Se llega con el campo trampa para no crear filas.
    await page.goto("/afiliacion");
    await llenarAfiliacion(page, datosValidos());
    await page.locator("#af-sitio").evaluate((el: HTMLInputElement) => (el.value = "x"));
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page).toHaveURL(/\/afiliacion\/enviada$/);
    const esperados = esEscritorio(testInfo)
      ? [
          "¡Solicitud enviada!",
          "El equipo de la cooperativa ya recibió tus datos. Te enviamos una copia a la•••@correo.com. Te contactaremos en [N] días hábiles por WhatsApp o correo.",
          "Volver al inicio",
        ]
      : [
          "¡Solicitud enviada!",
          "El equipo de la cooperativa ya recibió tus datos. Te enviamos una copia a la•••@correo.com.",
          "Qué sigue",
          "Revisamos tu solicitud en [N] días hábiles.",
          "Te contactamos por WhatsApp o correo para completar la afiliación.",
          "Cuando quedes activo, ingresas con tu cédula y pides tu crédito.",
          "Volver al inicio",
        ];
    await revisarTextos(page, esperados, "afiliacion-enviada", testInfo);
    await revisarEstilos(page, ["Volver al inicio"], []);
  });
});
