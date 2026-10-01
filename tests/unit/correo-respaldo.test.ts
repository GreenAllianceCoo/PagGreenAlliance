import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const registrar = vi.fn();
vi.mock("@/lib/servidor/registro", () => ({ registrar: (...a: unknown[]) => registrar(...a) }));

import { enviarResultadoCredito, enviarDesembolsoCredito } from "@/lib/correo/credito";
import { enviarBoletaSorteo, enviarGanadorSorteo } from "@/lib/correo/sorteo";
import { enviarIngresoAceptado } from "@/lib/correo/ingreso";

type Cuerpo = Record<string, unknown>;
function simular(respuestas: boolean[] = []) {
  const llamadas: Cuerpo[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_u: string, init: { body: string }) => {
      llamadas.push(JSON.parse(init.body));
      const ok = respuestas[llamadas.length - 1] ?? true;
      return { ok, status: ok ? 200 : 422, text: async () => "fallo para camilo@correo.co" };
    }),
  );
  return llamadas;
}

const VARIABLES = [
  "RESEND_TEMPLATE_CREDITO_APROBADO",
  "RESEND_TEMPLATE_CREDITO_RECHAZADO",
  "RESEND_TEMPLATE_CREDITO_DESEMBOLSADO",
  "RESEND_TEMPLATE_SORTEO_BOLETA",
  "RESEND_TEMPLATE_SORTEO_GANADOR",
  "RESEND_TEMPLATE_INGRESO_ACEPTADO",
];

const CASOS: Array<{ nombre: string; variable: string; enviar: () => Promise<void>; texto: string }> = [
  {
    nombre: "crédito aprobado",
    variable: "RESEND_TEMPLATE_CREDITO_APROBADO",
    enviar: () => enviarResultadoCredito({ id: "s1", nombre: "Ana", correo: "a@x.co", resultado: "aprobado", monto: 1500000 }),
    texto: "fue aprobada",
  },
  {
    nombre: "crédito rechazado",
    variable: "RESEND_TEMPLATE_CREDITO_RECHAZADO",
    enviar: () =>
      enviarResultadoCredito({ id: "s1", nombre: "Ana", correo: ["a@x.co"], resultado: "rechazado", monto: 1500000, motivo: "Sin cupo" }),
    texto: "Motivo: Sin cupo",
  },
  {
    nombre: "desembolso",
    variable: "RESEND_TEMPLATE_CREDITO_DESEMBOLSADO",
    enviar: () =>
      enviarDesembolsoCredito({ id: "s1", nombre: "Ana", correo: ["a@x.co"], monto: 1500000, fecha: "2026-10-01", fechaTexto: "1 de octubre" }),
    texto: "desembolsado el 1 de octubre",
  },
  {
    nombre: "boleta del sorteo",
    variable: "RESEND_TEMPLATE_SORTEO_BOLETA",
    enviar: () => enviarBoletaSorteo({ correo: ["a@x.co"], nombre: "Ana", numero: "482913", mes: "octubre" }),
    texto: "482913",
  },
  {
    nombre: "ganador del sorteo",
    variable: "RESEND_TEMPLATE_SORTEO_GANADOR",
    enviar: () => enviarGanadorSorteo({ correo: ["a@x.co"], nombre: "Ana", mes: "octubre" }),
    texto: "ganador del sorteo de octubre",
  },
  {
    nombre: "ingreso aceptado",
    variable: "RESEND_TEMPLATE_INGRESO_ACEPTADO",
    enviar: () =>
      enviarIngresoAceptado({ id: "s1", nombre: "Ana", cedula: "1014256789", correo: ["a@x.co"], urlIngreso: "https://x.co/ingresar" }),
    texto: "https://x.co/ingresar",
  },
];

describe("§13.4 correos con plantilla y respaldo en texto plano", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "llave";
    process.env.EMAIL_FROM = "GA <no-responder@x.co>";
    for (const v of VARIABLES) delete process.env[v];
    registrar.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  for (const caso of CASOS) {
    describe(caso.nombre, () => {
      it("sin variable de plantilla: texto plano y registra la variable faltante", async () => {
        const llamadas = simular();
        await caso.enviar();
        expect(llamadas).toHaveLength(1);
        expect(llamadas[0].template).toBeUndefined();
        expect(String(llamadas[0].text)).toContain(caso.texto);
        expect(llamadas[0].subject).toBeTruthy();
        expect(registrar).toHaveBeenCalledWith("warn", expect.objectContaining({ evento: "correo_plantilla_faltante", variable: caso.variable }));
        // El registro no lleva datos personales.
        expect(JSON.stringify(registrar.mock.calls)).not.toMatch(/Ana|1014256789|a@x\.co|1\.500\.000/);
      });

      it("con plantilla: la usa y no manda texto", async () => {
        process.env[caso.variable] = "ga-plantilla";
        const llamadas = simular();
        await caso.enviar();
        expect(llamadas).toHaveLength(1);
        expect((llamadas[0].template as { id: string }).id).toBe("ga-plantilla");
        expect(registrar).not.toHaveBeenCalledWith("warn", expect.objectContaining({ evento: "correo_plantilla_faltante" }));
      });

      it("si la plantilla falla: cae a texto plano y registra sin correos", async () => {
        process.env[caso.variable] = "ga-plantilla";
        const llamadas = simular([false, true]);
        await caso.enviar();
        expect(llamadas).toHaveLength(2);
        expect(llamadas[1].template).toBeUndefined();
        expect(String(llamadas[1].text)).toContain(caso.texto);
        expect(JSON.stringify(registrar.mock.calls)).not.toContain("camilo@correo.co");
        expect(registrar).toHaveBeenCalledWith("warn", expect.objectContaining({ evento: "correo_plantilla_faltante", variable: caso.variable }));
      });
    });
  }
});
