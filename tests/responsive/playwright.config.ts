import { defineConfig } from "@playwright/test";
import path from "node:path";

/**
 * Pruebas responsive de ga-verificador-responsive.
 *   npm run dev   (Supabase local para /cuenta, /dashboard, /ingresar/codigo)
 *   npx playwright test -c tests/responsive
 * Navegador: Chrome instalado (channel "chrome").
 */
const RAIZ = path.resolve(__dirname, "..", "..");

export default defineConfig({
  testDir: __dirname,
  outputDir: path.join(RAIZ, "test-results", "playwright-responsive"),
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 300_000,
  reporter: [["list"], ["json", { outputFile: path.join(RAIZ, "test-results", "responsive", "resultados.json") }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev", cwd: RAIZ, url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "responsive", use: { browserName: "chromium", channel: "chrome" } }],
});
