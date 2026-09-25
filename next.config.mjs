import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

/**
 * Secretos solo de servidor que deben existir en cada despliegue de Vercel,
 * con un largo mínimo (son claves criptográficas). Si falta alguno, el build
 * falla y el despliegue anterior sigue en línea: así nadie despliega sin
 * notarlo una app con el límite de intentos apagado.
 * Solo se exige en Vercel (VERCEL=1); en local lo avisa el log en tiempo de ejecución.
 */
const SECRETOS_OBLIGATORIOS = ["LIMITE_HMAC_SECRET"];
const LARGO_MINIMO = 32;

/**
 * S-05 (revisión de seguridad 2026-09-24): sin estas variables, el correo
 * del número de boleta del sorteo (y cualquier otro correo a asociados) no
 * se puede enviar; antes solo se notaba en producción al ver los registros.
 * Mismo patrón que SECRETOS_OBLIGATORIOS, pero solo exige que no estén
 * vacías (no son secretos con un formato de largo fijo).
 */
const VARIABLES_OBLIGATORIAS = ["RESEND_API_KEY", "EMAIL_FROM", "RESEND_TEMPLATE_SORTEO_BOLETA"];

/** @type {(phase: string) => import('next').NextConfig} */
export default function configuracion(phase) {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.VERCEL === "1") {
    const faltanSecretos = SECRETOS_OBLIGATORIOS.filter(
      (nombre) => (process.env[nombre] ?? "").length < LARGO_MINIMO,
    );
    const faltanVariables = VARIABLES_OBLIGATORIAS.filter((nombre) => !(process.env[nombre] ?? "").trim());
    if (faltanSecretos.length > 0 || faltanVariables.length > 0) {
      const detalle = [
        faltanSecretos.length > 0 ? `${faltanSecretos.join(", ")} (${LARGO_MINIMO}+ caracteres)` : null,
        faltanVariables.length > 0 ? faltanVariables.join(", ") : null,
      ]
        .filter(Boolean)
        .join("; ");
      throw new Error(
        `Faltan variables de entorno: ${detalle}. Agrégalas en Vercel (Production y Preview) y vuelve a desplegar.`,
      );
    }
  }
  return {
    experimental: {
      serverActions: {
        // S-03 (revisión de seguridad 2026-09-24): la afiliación sube 3 fotos
        // en el mismo envío. El límite por defecto de las Server Actions es
        // 1 MB; con esto y la compresión SIEMPRE en el cliente (CampoFoto.tsx,
        // ~300 KB por foto), el envío completo queda muy por debajo de los
        // 4,5 MB que permite Vercel.
        bodySizeLimit: "3mb",
      },
    },
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
            // S-14: fuerza HTTPS en el navegador durante 2 años, incluidos
            // subdominios (Vercel ya sirve por HTTPS; esto evita que un
            // primer request por HTTP se pueda interceptar). NO se agrega
            // `default-src` a la CSP: rompería los scripts de Next (no usan
            // nonce todavía).
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
            // S-14: la app no usa cámara/micrófono/ubicación salvo la propia
            // pestaña (CampoFoto.tsx abre el selector de archivos/cámara del
            // sistema operativo, no getUserMedia), así que se cierran todas
            // menos cámara del mismo origen.
            {
              key: "Permissions-Policy",
              value: "camera=(self), microphone=(), geolocation=()",
            },
          ],
        },
      ];
    },
  };
}
