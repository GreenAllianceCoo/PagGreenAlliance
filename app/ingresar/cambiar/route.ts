import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_INGRESO } from "@/lib/ingreso/servidor";

/**
 * «Cambiar cédula» (escritorio) y flecha «Volver» (celular) de /ingresar/codigo:
 * borra la cookie del paso 1 y vuelve a /ingresar (mapa de botones §3).
 * Los enlaces que llegan aquí son <a> normales (sin prefetch); aun así, si
 * llega una petición de prefetch no se borra nada.
 */
export async function GET(request: NextRequest) {
  const destino = NextResponse.redirect(new URL("/ingresar", request.url), 303);
  const esPrefetch =
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch");
  if (!esPrefetch) destino.cookies.delete(COOKIE_INGRESO);
  return destino;
}
