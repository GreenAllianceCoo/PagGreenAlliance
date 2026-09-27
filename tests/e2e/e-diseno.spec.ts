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
 * E. Fidelidad al diseño (docs/Green Alliance C+.dc.html, piezas 2a-2d y
 * 3a-3h): textos en el mismo orden, verde #1E6652 en primarios, borde navy
 * #1A3C57 en secundarios, Manrope en el cuerpo y Bricolage Grotesque en
 * títulos (h1). Captura completa en test-results/qa/.
 *
 * Reescrito para el rediseño C+ (27-sep-2026): la landing, el ingreso, la
 * afiliación (v2: nombres/apellidos, institución, Nequi, asesor, 3 fotos) y
 * /cuenta cambiaron de marcado y de textos frente a la versión anterior de
 * esta prueba (que databa de la afiliación v1, con un solo campo «Nombres y
 * apellidos» y sin institución/Nequi/asesor/fotos). Los textos esperados se
 * verificaron contra el código real de cada pantalla (no solo el lienzo),
 * volcando `textoVisible(page)` en ambos viewports antes de escribir esta
 * prueba.
 */

const VERDE = "rgb(30, 102, 82)";
const NAVY = "rgb(26, 60, 87)";

// Las categorías se ven en MAYÚSCULA (`text-transform: uppercase`, pieza 2a):
// `innerText` refleja el texto ya transformado por CSS, no el literal del JSX.
const CONVENIOS_LANDING = [
  "TECNOLOGÍA",
  "AMB Móvil S.A.S.",
  "VIAJES Y TURISMO",
  "Locos por los Viajes S.A.S.",
  "ODONTOLOGÍA ESTÉTICA",
  "Dr. Ribero Dental Group",
  "TOURS EN VILLA DE LEYVA",
  "Racing Tours Villa de Leyva",
  "TRÁMITE DE VISAS",
  "Dream & Go Visas",
];

const SERVICIOS_APOYOS = [
  "Lo que encuentras en Green Alliance",
  "Microcréditos",
  "Pídelo en línea desde la plataforma, con modalidad del 50 % o 100 % y un tope claro según tu grado.",
  "Orientación financiera",
  "Una conversación estratégica para ordenar tus cuentas y decidir mejor antes de endeudarte.",
  "Apoyo legal",
  "Acompañamiento jurídico integral en trámites para ti y tu familia.",
  "Embargo solidario a 36 meses",
  "Un alivio financiero pensado para que, con el tiempo, recuperes tu vida comercial ante los bancos.",
];

async function revisarEstilos(
  page: Page,
  primarios: string[],
  secundarios: string[],
  // /cuenta (pieza 2b): el <h1> «Hola, {nombre}» deja «Hola,» en texto normal
  // (caption) y solo el nombre en Bricolage Grotesque (`.font-display` en el
  // <span>, no en el propio <h1>, que por eso no hereda ese font-family). El
  // resto de pantallas sí pone `font-display` directo en el <h1>.
  selectorTitulo = "h1",
) {
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
      // Rediseño C+: los botones secundarios de landing/ingreso ya no usan
      // `border`, sino `box-shadow: inset 0 0 0 1.5px var(--ga-navy)` (pieza
      // 3a: así el borde no cambia el tamaño de la caja). Si no hay borde
      // declarado, se cae a leer el box-shadow calculado.
      const sombra = s.boxShadow;
      return { color: s.borderTopColor, declarado, sombra };
    });
    const tieneBorde = estilo.color === NAVY && estilo.declarado === "1.5px";
    const tieneSombraNavy = /rgb\(26,\s*60,\s*87\)/.test(estilo.sombra) && estilo.sombra.includes("1.5px");
    expect(tieneBorde || tieneSombraNavy, `borde/sombra navy de «${texto}» (${JSON.stringify(estilo)})`).toBe(true);
  }
  // Fuente: Manrope en el cuerpo, Bricolage Grotesque en los títulos (h1),
  // ambas cargadas (pieza 3a del rediseño C+: docs/Green Alliance C+.dc.html).
  const fuente = await page.evaluate(async (selector) => {
    await document.fonts.ready;
    const h1 = document.querySelector(selector)!;
    return {
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(h1).fontFamily,
      manropeCargada:
        document.fonts.check("16px Manrope") ||
        Array.from(document.fonts).some((f) => /manrope/i.test(f.family) && f.status === "loaded"),
      bricolageCargada:
        document.fonts.check("16px 'Bricolage Grotesque'") ||
        Array.from(document.fonts).some((f) => /bricolage/i.test(f.family) && f.status === "loaded"),
    };
  }, selectorTitulo);
  expect(fuente.body.toLowerCase()).toContain("manrope");
  expect(fuente.h1.toLowerCase()).toContain("bricolage");
  expect(fuente.manropeCargada).toBe(true);
  expect(fuente.bricolageCargada).toBe(true);
}

async function revisarTextos(page: Page, esperados: string[], nombre: string, testInfo: TestInfo) {
  const texto = await textoVisible(page);
  const problemas = revisarOrden(texto, esperados);
  await capturaCompleta(page, nombre, testInfo);
  expect(problemas, `Textos del diseño en ${nombre} (${testInfo.project.name})`).toEqual([]);
}

test.describe("E · Landing /", () => {
  // El comprobante «Tu solicitud» del hero avanza solo cada 2.6 s
  // (components/pantallas/landing/ComprobanteSolicitud.tsx): con
  // `prefers-reduced-motion: reduce` se queda fijo en «2 de 4» / «En
  // revisión», como pide la nota MOVIMIENTO de la pieza 2a. Sin esto, la
  // prueba de texto sería intermitente si tarda más de 2.6 s en correr.
  test.use({ reducedMotion: "reduce" });

  test("Textos, orden, colores y fuente", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const comprobante = esEscritorio(testInfo)
      ? ["Tu solicitud", "En revisión", "2 de 4 pasos"]
      : ["Así ves tu solicitud", "En revisión", "2 de 4"];
    const esperados = esEscritorio(testInfo)
      ? [
          "Apoyos",
          "Cómo funciona",
          "Convenios",
          "Afíliate",
          "Mi cuenta",
          "Policía Nacional · Ejército Nacional",
          "Crédito entre compañeros, con reglas claras.",
          "Somos una cooperativa hecha por y para la familia policial y militar. Pides en línea, sabes tu tope desde el inicio y ves cada paso de tu solicitud.",
          "Solicitar crédito",
          "Conocer la cooperativa",
          "asociados activos",
          "o menos de respuesta promedio",
          ...comprobante,
          "Enviada",
          "En revisión",
          "Aprobada",
          "Desembolso",
          "Esto suele tardar 4 horas o menos.",
          "NUESTRA MISIÓN",
          "Ser escudo y lazo solidario para la familia policial.",
          "Lo hacemos con microcréditos de fácil acceso, orientación financiera estratégica y acompañamiento jurídico integral, para que tu vocación de servicio también se traduzca en crecimiento económico.",
          "NUESTRA VISIÓN",
          "Liderar el cooperativismo colombiano por identidad y arraigo institucional.",
          "Con una organización moderna y de proyección internacional, capaz de asegurar el bienestar financiero de nuestros hombres y mujeres.",
          "Si hoy el banco te dice que no, aquí empezamos de nuevo.",
          "Muchos compañeros quedan atrapados en deudas que terminan afectando su tranquilidad y su familia. Te proponemos una alternativa pensada para tu caso y te acompañamos de principio a fin.",
          "3 años",
          "para volver al sistema financiero tradicional, sin rechazos",
          "01",
          "Te afilias",
          "02",
          "Recibes alivio",
          "03",
          "Vuelves a empezar",
          ...SERVICIOS_APOYOS,
          "Empresas en convenio",
          "Condiciones preferenciales y el respaldo de la cooperativa en cada compra o servicio.",
          "Ver beneficios en mi cuenta",
          ...CONVENIOS_LANDING,
          "5",
          "sedes para atenderte",
          "Sede principal en Bogotá y cuatro sucursales en la región.",
          "Bogotá · sede principal",
          "WhatsApp 311 724 1942 · soporte@greenallianceco.com",
          "Vigilada por Supersolidaria",
        ]
      : [
          "Ingresar",
          "Policía · Ejército",
          "Crédito entre compañeros, con reglas claras.",
          "Somos una cooperativa hecha por y para la familia policial y militar. Pides en línea, sabes tu tope desde el inicio y ves cada paso de tu solicitud.",
          "Solicitar crédito",
          "Quiero afiliarme",
          "asociados activos",
          "o menos de respuesta promedio",
          ...comprobante,
          "Enviada",
          "En revisión",
          "Aprobada",
          "Desembolso",
          "Esto suele tardar 4 horas o menos.",
          "NUESTRA MISIÓN",
          "Ser escudo y lazo solidario para la familia policial.",
          "Microcréditos de fácil acceso, orientación financiera y acompañamiento jurídico integral.",
          "NUESTRA VISIÓN",
          "Liderar el cooperativismo colombiano por identidad y arraigo institucional.",
          "Si hoy el banco te dice que no, aquí empezamos de nuevo.",
          "3 años",
          ...SERVICIOS_APOYOS,
          "Empresas en convenio",
          "Condiciones preferenciales y el respaldo de la cooperativa en cada compra o servicio.",
          ...CONVENIOS_LANDING,
          "5",
          "sedes para atenderte",
          "WhatsApp 311 724 1942 · soporte@greenallianceco.com",
          "Vigilada por Supersolidaria",
        ];
    await revisarTextos(page, esperados, "landing", testInfo);
    await revisarEstilos(
      page,
      ["Solicitar crédito"],
      esEscritorio(testInfo) ? ["Conocer la cooperativa"] : ["Quiero afiliarme"],
    );
  });

  test("Testimonios de ejemplo ([entre corchetes]) no se muestran en la landing", async ({
    page,
  }) => {
    // lib/mock.ts#TESTIMONIOS_EJEMPLO: texto y autor literales entre
    // corchetes («[Testimonio real de un asociado…]», «[Nombre], [grado]…»).
    // Sección G del encargo: no deberían quedar marcadores del diseño fijos
    // en producción. Se deja como prueba (no se «arregla» solo con datos:
    // hace falta contenido real de la cooperativa) para que no se pierda de
    // vista; ver hallazgo en el informe de QA.
    await page.goto("/#c-historias");
    const texto = await textoVisible(page);
    const marcadores = texto.match(/\[[^\]]{1,80}\]/g) ?? [];
    // eslint-disable-next-line no-console
    console.log("Marcadores [entre corchetes] en la landing:", marcadores);
    expect(marcadores, "La sección de testimonios debe ocultarse mientras sean de ejemplo (D-07)").toEqual([]);
    await expect(page.getByText("Lo que hicieron con su crédito")).toHaveCount(0);
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
          "Ayuda por WhatsApp 311 724 1942",
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
          "Ayuda por WhatsApp 311 724 1942",
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
    // lib/mascara.ts oculta el dominio COMPLETO desde la revisión de
    // privacidad del 25-sep (antes se veían las primeras letras del
    // dominio): «ju•••@•••», nunca «ju•••@correo.com».
    const mascara = /[a-z]{2}•••@•••/.exec(texto)?.[0] ?? "<sin correo enmascarado>";
    const esperados = esEscritorio(testInfo)
      ? [
          "Revisa tu correo",
          `Te enviamos un código a ${mascara}. Vence en 10 minutos.`,
          "¿Cambiaste de correo? Escríbenos por WhatsApp 311 724 1942 para actualizarlo.",
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
          "¿Cambiaste de correo? Escríbenos por WhatsApp 311 724 1942 para actualizarlo.",
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
    await page.waitForLoadState("networkidle");

    // Partes con fecha (dependen del día en que se corre la prueba y de
    // cuándo quedó la fila de ejemplo en supabase/seed.sql): se capturan del
    // propio render en vez de escribirlas a mano, igual que ya se hace con
    // el correo enmascarado en «Ingreso paso 2». El sorteo, además, solo
    // muestra «Sorteo de <mes>: abre el…» en escritorio (acceso rápido del
    // nav) y «Próximo sorteo: …» en las dos plataformas cuando la ventana de
    // inscripción (1 al 5, hora de Colombia) está cerrada; esta prueba cubre
    // ese caso (el resto del mes), no la ventana abierta.
    const texto = await textoVisible(page);
    const fechaEnviada = /Enviada \d{1,2} de \w+\.?/.exec(texto)?.[0];
    const proximoSorteo = /Próximo sorteo: \d{1,2} de \w+/.exec(texto)?.[0];
    const sorteoNav = /Sorteo de \w+: abre el \d{1,2} de \w+/.exec(texto)?.[0];
    expect(fechaEnviada, "no se encontró «Enviada <fecha>»: revisar seed/ventana del sorteo").toBeTruthy();
    expect(proximoSorteo, "no se encontró «Próximo sorteo: …»: ¿está la ventana 1-5 abierta hoy?").toBeTruthy();

    const esperados = esEscritorio(testInfo)
      ? [
          "Inicio",
          "Nueva solicitud",
          "Convenios",
          u.nombre,
          "Salir",
          `Hola, ${u.nombre}`,
          ...(sorteoNav ? [sorteoNav] : []),
          "Tu solicitud",
          "En revisión",
          "Monto solicitado",
          "$ 500.000",
          "Modalidad",
          "50%",
          "Plazo",
          "3 meses",
          fechaEnviada!,
          "En revisión",
          "Aprobada",
          "Desembolso",
          "Te avisaremos por correo cuando cambie el estado.",
          "Tope disponible para tu grado",
          "$ 2.100.000",
          "Tu solicitud usa",
          "$ 500.000",
          "Nueva solicitud",
          proximoSorteo!,
          "Hablar con la cooperativa",
          "CARNÉ DE ASOCIADO",
          u.nombre,
          "Muéstralo en cada empresa en convenio.",
          "Tus convenios",
          "AMB Móvil",
          "Locos por los Viajes",
          "Dr. Ribero Dental",
          "Racing Tours",
          "Dream & Go Visas",
          "Mis datos",
          "Si tu nombre, cédula o grado no están bien, habla con la cooperativa.",
          "Nombre",
          u.nombre,
          "Cédula",
          "1234567890",
          "Grado",
          "PP",
          "Celular",
          "Guardar",
        ]
      : [
          `Hola, ${u.nombre}`,
          "Tu solicitud",
          "En revisión",
          "Monto solicitado · modalidad 50%",
          "$ 500.000",
          fechaEnviada!,
          "En revisión",
          "Aprobada",
          "Desembolso",
          "Te avisaremos por correo cuando cambie el estado.",
          "Tope disponible para tu grado",
          "$ 2.100.000",
          "Tu solicitud usa",
          "$ 500.000",
          "Nueva solicitud",
          "Convenios",
          proximoSorteo!,
          "Hablar con la cooperativa",
          "CARNÉ DE ASOCIADO",
          u.nombre,
          "Muéstralo en cada empresa en convenio.",
          "Tus convenios",
          "Mis datos",
          "Si tu nombre, cédula o grado no están bien, habla con la cooperativa.",
          "Nombre",
          u.nombre,
          "Cédula",
          "1234567890",
          "Grado",
          "PP",
          "Celular",
          "Guardar",
          "Inicio",
          "Solicitar",
          "Sorteo",
          "Mis datos",
        ];
    await revisarTextos(page, esperados, "cuenta", testInfo);
    // «Hablar con la cooperativa»: variante «terciario» (components/ui/Button.tsx),
    // borde verde real (no navy).
    const hablar = page.getByRole("link", { name: "Hablar con la cooperativa" });
    const bordeHablar = await hablar.evaluate((n) => getComputedStyle(n).borderTopColor);
    expect(bordeHablar, "«Hablar con la cooperativa» debe llevar el borde verde (terciario)").toBe(VERDE);
    await revisarEstilos(page, ["Guardar"], [], "h1 .font-display");
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
      "Autorizo a la Cooperativa Green Alliance a tratar mis datos personales, incluida la foto de mi cédula (frente y reverso) y mi selfie como dato sensible, para gestionar mi afiliación, según su política de datos (Ley 1581 de 2012).";
    const camposComunes = [
      "Nombres",
      "Apellidos",
      "Número de cédula",
      "Grado",
      "Selecciona tu grado",
      "Número Nequi",
      "Institución",
      "Selecciona tu institución",
      "Policía Nacional",
      "Ejército Nacional",
      "Celular",
      "Correo electrónico",
      "Asesor",
      "No tengo asesor",
      "Fotos de tu documento",
      "Cédula (frente)",
      "Toca para tomar o subir la foto",
      "Cédula (reverso)",
      "Selfie",
      "¿Algo que debamos saber?",
      autoriza,
    ];
    const esperados = esEscritorio(testInfo)
      ? [
          "¿Ya eres asociado? Ingresa",
          ...comun,
          "Envías este formulario.",
          "El equipo te contacta por WhatsApp o correo.",
          "Ya activo, ingresas con tu cédula.",
          ...camposComunes,
          "Enviar solicitud",
          "El equipo te contactará por WhatsApp o a tu correo.",
        ]
      : [...comun, ...camposComunes, "Enviar solicitud", "El equipo te contactará por WhatsApp o a tu correo."];
    await revisarTextos(page, esperados, "afiliacion", testInfo);
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
          "El equipo de la cooperativa ya recibió tus datos. Te enviamos una copia a la•••@•••. Te contactaremos en 4 horas o menos por WhatsApp o correo.",
          "Volver al inicio",
        ]
      : [
          "¡Solicitud enviada!",
          "El equipo de la cooperativa ya recibió tus datos. Te enviamos una copia a la•••@•••.",
          "Qué sigue",
          "Revisamos tu solicitud en 4 horas o menos.",
          "Te contactamos por WhatsApp o correo para completar la afiliación.",
          "Cuando quedes activo, ingresas con tu cédula y pides tu crédito.",
          "Volver al inicio",
        ];
    await revisarTextos(page, esperados, "afiliacion-enviada", testInfo);
    await revisarEstilos(page, ["Volver al inicio"], []);
  });
});
