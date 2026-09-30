import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/servidor/sitio", () => ({ urlDelSitio: async (r: string) => `https://www.greenallianceco.com${r}` }));
const registrar = vi.fn();
vi.mock("@/lib/servidor/registro", () => ({ registrar: (...a: unknown[]) => registrar(...a) }));

import { avisarCorreoInstitucional, TEXTO_AVISO_INSTITUCIONAL } from "@/lib/correo/institucional";

/** Resend simulado: captura cada POST a la API; nada sale a internet. */
function simularResend(respuestas: Array<{ ok: boolean; status?: number; cuerpo?: string }> = []) {
  const llamadas: { url: string; cuerpo: Record<string, unknown> }[] = [];
  const fetchSimulado = vi.fn(async (url: string, init: { body: string }) => {
    llamadas.push({ url, cuerpo: JSON.parse(init.body) });
    const r = respuestas[llamadas.length - 1] ?? { ok: true };
    return { ok: r.ok, status: r.status ?? 200, text: async () => r.cuerpo ?? "fallo de prueba" };
  });
  vi.stubGlobal("fetch", fetchSimulado);
  return llamadas;
}

const DATOS_PROHIBIDOS = ["1014256789", "Camilo", "1.500.000", "Tope", "482913", "camilo.personal@gmail.com"];

describe("avisarCorreoInstitucional (RS-02)", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "llave-de-prueba";
    process.env.EMAIL_FROM = "Green Alliance <no-responder@ejemplo.co>";
    delete process.env.RESEND_TEMPLATE_AVISO_INSTITUCIONAL;
    registrar.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("con plantilla: va SOLO al institucional y su única variable es el enlace", async () => {
    process.env.RESEND_TEMPLATE_AVISO_INSTITUCIONAL = "ga-aviso-institucional";
    const llamadas = simularResend();
    await avisarCorreoInstitucional("camilo.personal@gmail.com", "camilo@policia.gov.co");

    expect(llamadas).toHaveLength(1);
    const { cuerpo } = llamadas[0];
    expect(cuerpo.to).toEqual(["camilo@policia.gov.co"]);
    expect(cuerpo.template).toEqual({
      id: "ga-aviso-institucional",
      variables: { URL_INGRESO: "https://www.greenallianceco.com/ingresar" },
    });
    const json = JSON.stringify(cuerpo);
    for (const dato of DATOS_PROHIBIDOS) expect(json).not.toContain(dato);
  });

  it("sin plantilla: texto plano con la misma frase y el enlace, sin datos, y lo registra", async () => {
    const llamadas = simularResend();
    await avisarCorreoInstitucional("camilo.personal@gmail.com", "camilo@policia.gov.co");

    expect(llamadas).toHaveLength(1);
    const { cuerpo } = llamadas[0];
    expect(cuerpo.to).toEqual(["camilo@policia.gov.co"]);
    expect(cuerpo.subject).toBe("Novedad en tu cuenta de Green Alliance");
    expect(cuerpo.text).toContain(TEXTO_AVISO_INSTITUCIONAL);
    expect(cuerpo.text).toContain("https://www.greenallianceco.com/ingresar");
    for (const dato of DATOS_PROHIBIDOS) expect(JSON.stringify(cuerpo)).not.toContain(dato);
    expect(registrar).toHaveBeenCalledWith("warn", { evento: "aviso_institucional_sin_plantilla" });
  });

  it("si la plantilla falla en Resend, cae a texto plano y registra sin correos", async () => {
    process.env.RESEND_TEMPLATE_AVISO_INSTITUCIONAL = "ga-aviso-institucional";
    const llamadas = simularResend([{ ok: false, status: 422, cuerpo: "invalid to camilo@policia.gov.co" }, { ok: true }]);
    await avisarCorreoInstitucional("camilo.personal@gmail.com", "camilo@policia.gov.co");

    expect(llamadas).toHaveLength(2);
    expect(llamadas[0].cuerpo.template).toBeDefined();
    expect(llamadas[1].cuerpo.text).toContain(TEXTO_AVISO_INSTITUCIONAL);
    expect(registrar).toHaveBeenCalledWith("warn", expect.objectContaining({ evento: "aviso_institucional_plantilla_fallo" }));
    expect(JSON.stringify(registrar.mock.calls)).not.toContain("camilo@policia.gov.co");
  });

  it("si todo falla no lanza y solo registra, sin el correo", async () => {
    simularResend([{ ok: false, status: 500, cuerpo: "rebotó b@policia.gov.co" }]);
    await expect(avisarCorreoInstitucional("a@gmail.com", "b@policia.gov.co")).resolves.toBeUndefined();
    const errores = registrar.mock.calls.filter((c) => c[0] === "error");
    expect(errores).toHaveLength(1);
    expect(JSON.stringify(errores)).not.toContain("b@policia.gov.co");
  });

  it("no manda nada sin institucional, o si es igual al personal", async () => {
    const llamadas = simularResend();
    await avisarCorreoInstitucional("a@gmail.com", null);
    await avisarCorreoInstitucional("a@gmail.com", "A@gmail.com");
    expect(llamadas).toHaveLength(0);
  });
});
