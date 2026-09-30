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
    .select("rol, nombre_completo, activo")
    .eq("id", user.id)
    .single();

  // No es admin: no se revela nada, se manda al lugar que le corresponda.
  // RS-05: un admin dado de baja (perfiles.activo = false) pierde el acceso
  // aunque su sesión siga viva. Se manda a /cuenta, igual que a un no-admin.
  if (perfil?.rol !== "admin" || !perfil.activo) redirect("/cuenta");

  return { supabase, userId: user.id, nombre: perfil.nombre_completo as string };
}
