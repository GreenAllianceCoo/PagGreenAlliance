import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

/**
 * Secretos solo de servidor que deben existir en cada despliegue de Vercel.
 * Si falta alguno, el build falla y el despliegue anterior sigue en línea:
 * así nadie despliega sin notarlo una app con el límite de intentos apagado.
 * Solo se exige en Vercel (VERCEL=1); en local lo avisa el log en tiempo de ejecución.
 */
const SECRETOS_OBLIGATORIOS = ["LIMITE_HMAC_SECRET"];
const LARGO_MINIMO = 32;

/** @type {(phase: string) => import('next').NextConfig} */
export default function configuracion(phase) {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL === "1") {
    const faltan = SECRETOS_OBLIGATORIOS.filter(
      (nombre) => (process.env[nombre] ?? "").length < LARGO_MINIMO,
    );
    if (faltan.length > 0) {
      throw new Error(
        `Faltan variables de entorno (${LARGO_MINIMO}+ caracteres): ${faltan.join(", ")}. ` +
          "Agrégalas en Vercel (Production y Preview) y vuelve a desplegar.",
      );
    }
  }
  return {
    // F-05: protección contra clickjacking (que no se pueda incrustar
    // /ingresar, /cuenta, etc. en un iframe de otro sitio) y otras cabeceras
    // de seguridad básicas, en todas las rutas.
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            // Redundante con la CSP de abajo, pero la mantenemos porque
            // algunos navegadores viejos solo entienden X-Frame-Options.
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "X-Content-Type-Options", value: "nosniff" },
          ],
        },
      ];
    },
  };
}
