import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Pruebas de punta a punta de ga-verificador-qa.
 *
 * Cómo correrlas (desde la raíz del proyecto):
 *   export PATH="/c/Program Files/nodejs:$PATH"
 *   npx supabase db reset          # base local limpia (NUNCA --linked)
 *   npm run dev                    # usa .env.development.local → Supabase LOCAL
 *   npx playwright test -c tests/e2e
 *
 * Solo corren contra http://localhost:3000 + Supabase local (127.0.0.1:54321).
 * tests/e2e/utils.ts se niega a correr si la URL de Supabase no es local.
 *
 * Navegador: Chrome instalado en el equipo (channel "chrome"); la descarga de
 * Chromium de Playwright no está disponible en esta máquina.
 */
const RAIZ = path.resolve(__dirname, "..", "..");

export default defineConfig({
  testDir: __dirname,
  outputDir: path.join(RAIZ, "test-results", "playwright"),
  // Un solo worker: los envíos de código comparten límites (45 s por cédula).
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(RAIZ, "test-results", "qa", "resultados.json") }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  webServer: {
    command: "npm run dev",
    cwd: RAIZ,
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
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
