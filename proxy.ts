import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * - Refresca la sesión de Supabase (cookies).
 * - /cuenta y /dashboard requieren sesión: sin sesión → /ingresar.
 * - /ingresar (y sus pasos) con sesión → /cuenta. Así los botones de la landing
 *   que apuntan a /ingresar («Mi cuenta», «Ingresar», «Solicitar crédito»,
 *   «Ver beneficios en mi cuenta») llevan a /cuenta cuando ya hay sesión.
 * Las páginas y Server Actions vuelven a comprobar la sesión: el proxy no es
 * la única barrera.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const ruta = request.nextUrl.pathname;

  const redirigir = (destino: string) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    const redireccion = NextResponse.redirect(url);
    // Conserva las cookies de sesión que Supabase haya refrescado.
    response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
    return redireccion;
  };

  const esPrivada =
    ruta === "/cuenta" || ruta.startsWith("/cuenta/") ||
    ruta === "/dashboard" || ruta.startsWith("/dashboard/");
  if (!user && esPrivada) return redirigir("/ingresar");

  const esIngreso = ruta === "/ingresar" || ruta.startsWith("/ingresar/");
  if (user && esIngreso) return redirigir("/cuenta");

  return response;
}

export const config = {
  matcher: ["/cuenta/:path*", "/dashboard/:path*", "/ingresar/:path*"],
};
