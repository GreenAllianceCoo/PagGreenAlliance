import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Configuración SOLO para la verificación de producción (actividad 6.3,
 * 2026-09-25) contra https://www.greenallianceco.com (rama main, merge
 * 5a39d34). NO reemplaza tests/e2e (que exige Supabase local); vive fuera de
 * tests/ a propósito para que nadie la corra sin darse cuenta contra datos
 * reales.
 *
 * Reglas de esta corrida (ver encargo): NUNCA enviar el formulario de
 * afiliación, NUNCA pedir un código de ingreso real, NUNCA crear ni
 * modificar datos. Solo navegación y validaciones del lado del navegador.
 *
 * Cómo correrla:
 *   npx playwright test -c docs/verificaciones/prod-2026-09-25
 */
const RAIZ = path.resolve(__dirname, "..", "..", "..");

export default defineConfig({
  testDir: __dirname,
  outputDir: path.join(RAIZ, "test-results", "qa", "produccion", "playwright"),
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(RAIZ, "test-results", "qa", "produccion", "resultados.json") }],
  ],
  use: {
    baseURL: "https://www.greenallianceco.com",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  // Sin webServer: apunta a producción, no se levanta nada local.
  projects: [
    {
      name: "escritorio",
      use: { browserName: "chromium", channel: "chrome", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "celular",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        channel: "chrome",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
