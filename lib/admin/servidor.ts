import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Comprueba, en el servidor y con la sesión real (cookies), que quien pide la
 * página o ejecuta la acción es un admin. Se usa en CADA página y CADA Server
 * Action de /admin: proxy.ts solo exige sesión, no exige rol (ver proxy.ts).
 *
 * Devuelve el cliente autenticado (para que las consultas pasen por RLS con
 * la sesión del admin, no con service role) y sus datos básicos.
 */
export async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, nombre_completo")
    .eq("id", user.id)
    .single();

  // No es admin: no se revela nada, se manda al lugar que le corresponda.
  if (perfil?.rol !== "admin") redirect("/cuenta");

  return { supabase, userId: user.id, nombre: perfil.nombre_completo as string };
}
