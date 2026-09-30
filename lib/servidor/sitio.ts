import "server-only";
import { headers } from "next/headers";

/**
 * URL absoluta de una ruta del sitio para enlaces en correos. Sale de
 * SITIO_URL (S-12: no se confía en el encabezado `host` en producción); el
 * host de la petición queda solo como respaldo para desarrollo local.
 */
export async function urlDelSitio(ruta: string) {
  const sitio = process.env.SITIO_URL?.trim();
  const limpia = ruta.startsWith("/") ? ruta : `/${ruta}`;
  if (sitio) return `${sitio.replace(/\/+$/, "")}${limpia}`;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}${limpia}`;
}
