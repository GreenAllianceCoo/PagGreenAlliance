import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Roles que entran a /admin. El secretario ve solo Resumen y Afiliaciones. */
export type RolPanel = "admin" | "secretario";

async function leerSesionPanel() {
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

  return { supabase, user, perfil };
}

/**
 * Comprueba, en el servidor y con la sesión real (cookies), que quien pide la
 * página o ejecuta la acción es un admin. Se usa en CADA página y CADA Server
 * Action de /admin que NO sea de afiliaciones ni del Resumen: proxy.ts solo
 * exige sesión, no exige rol (ver proxy.ts).
 *
 * Devuelve el cliente autenticado (para que las consultas pasen por RLS con
 * la sesión del admin, no con service role) y sus datos básicos.
 *
 * Un SECRETARIO no pasa por aquí: se le manda a /admin (su Resumen). Así
 * cualquier ruta o acción solo-admin lo rechaza en el servidor aunque
 * escriba la dirección a mano.
 */
export async function exigirAdmin() {
  const { supabase, user, perfil } = await leerSesionPanel();

  // RS-05: un admin dado de baja (perfiles.activo = false) pierde el acceso
  // aunque su sesión siga viva. Se manda a /cuenta, igual que a un no-admin.
  if (perfil?.rol === "secretario" && perfil.activo) redirect("/admin");
  if (perfil?.rol !== "admin" || !perfil.activo) redirect("/cuenta");

  return { supabase, userId: user.id, nombre: perfil.nombre_completo as string };
}

/**
 * Para lo que el secretario también puede ver o hacer: el Resumen y las
 * afiliaciones. Devuelve además el `rol`, para que cada pantalla y cada
 * acción decida qué mostrar y qué permitir. Un secretario o admin dado de
 * baja se manda a /cuenta.
 */
export async function exigirAdminOSecretario() {
  const { supabase, user, perfil } = await leerSesionPanel();

  if ((perfil?.rol !== "admin" && perfil?.rol !== "secretario") || !perfil.activo) redirect("/cuenta");

  return {
    supabase,
    userId: user.id,
    nombre: perfil.nombre_completo as string,
    rol: perfil.rol as RolPanel,
  };
}
