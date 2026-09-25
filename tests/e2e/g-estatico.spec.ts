import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./utils";

/** G. Revisión estática rápida del código de la app (no abre el navegador). */

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "escritorio", "Revisión estática: una sola vez.");
});

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(e.name)) salida.push(p);
  }
  return salida;
}

const CODIGO = [...archivos(path.join(RAIZ, "app")), ...archivos(path.join(RAIZ, "components")), ...archivos(path.join(RAIZ, "lib")), path.join(RAIZ, "proxy.ts")];
const leer = (f: string) => fs.readFileSync(f, "utf8");
const rel = (f: string) => path.relative(RAIZ, f).replace(/\\/g, "/");
/** Sin comentarios (// y /* *\/) para no contar ejemplos en la documentación. */
const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("SUPABASE_SERVICE_ROLE_KEY no aparece en archivos 'use client'", () => {
  const malos = CODIGO.filter((f) => /^\s*["']use client["']/.test(leer(f)) && leer(f).includes("SUPABASE_SERVICE_ROLE_KEY"));
  expect(malos.map(rel)).toEqual([]);
  // El cliente admin es server-only.
  expect(leer(path.join(RAIZ, "lib/supabase/admin.ts"))).toContain('import "server-only"');
});

test("Los 'use client' no importan el cliente admin ni módulos server-only", () => {
  const malos = CODIGO.filter(
    (f) => /^\s*["']use client["']/.test(leer(f)) && /@\/lib\/(supabase\/admin|servidor\/|ingreso\/servidor|afiliacion\/flash|grados)/.test(leer(f)),
  );
  expect(malos.map(rel)).toEqual([]);
});

test("Sin console.log en el código de la app", () => {
  const malos = CODIGO.filter((f) => /console\.log\(/.test(sinComentarios(leer(f))));
  expect(malos.map(rel)).toEqual([]);
});

test("Los registros no incluyen correo, cédula ni celular", () => {
  const llamadas = CODIGO.flatMap((f) =>
    Array.from(sinComentarios(leer(f)).matchAll(/registrar\([\s\S]*?\}\)/g)).map((m) => ({ f: rel(f), t: m[0] })),
  );
  const malos = llamadas.filter(({ t }) => /\b(email|correo|cedula|celular|telefono)\s*[:,}]/.test(t));
  expect(malos).toEqual([]);
});

test("Sin textos de ejemplo del diseño fijos en pantallas de producción", () => {
  // lib/mock.ts guarda los ejemplos; se revisa que ninguna página use los del asociado/correo.
  const prohibidos = ["ju•••@correo.com", "[Nombre]", "[TOPE]", "[MONTO]", "[PLAZO]"];
  const malos: string[] = [];
  for (const f of CODIGO) {
    if (rel(f) === "lib/mock.ts") continue;
    const t = sinComentarios(leer(f));
    for (const p of prohibidos) if (t.includes(p)) malos.push(`${rel(f)}: ${p}`);
  }
  expect(malos).toEqual([]);
  const usosMock = CODIGO.filter((f) => /(CORREO_ENMASCARADO_EJEMPLO|ASOCIADO_EJEMPLO|SOLICITUD_EJEMPLO|OTP_EJEMPLO|TIEMPO_REENVIO_EJEMPLO)/.test(leer(f)) && rel(f) !== "lib/mock.ts");
  expect(usosMock.map(rel)).toEqual([]);
});
