import { NextResponse, type NextRequest } from "next/server";
import { PARAMETRO_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { createClient } from "@/lib/supabase/server";

/**
 * §12.6: destino de quien entra a /cuenta con la cuenta dada de baja. Cierra
 * la sesión (aquí sí se pueden escribir las cookies, en un componente de
 * servidor no) y lo manda a /ingresar con el aviso «Tu cuenta está inactiva».
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/ingresar";
  url.search = `?cuenta=${PARAMETRO_CUENTA_INACTIVA}`;
  return NextResponse.redirect(url);
}
