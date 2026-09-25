import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas unitarias y de integración de Green Alliance.
// El alias "@/" apunta a la raíz del proyecto, igual que en tsconfig.json.
// No se cargan variables de .env.local: las pruebas nunca tocan Supabase real.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});
