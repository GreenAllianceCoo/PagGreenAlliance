import "server-only";
import { redirect } from "next/navigation";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { urlLogo } from "@/lib/conveniosServidor";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda del panel de la empresa en convenio (/convenio, docs/spec-convenios.md
 * §B2). Se usa en el layout, en CADA página y en CADA Server Action de
 * /convenio: proxy.ts solo exige sesión.
 *
 * - Sin sesión → /ingresar.
 * - Otro rol → /cuenta (desde ahí cada área manda a su lugar).
 * - Rol convenio pero el convenio está oculto, eliminado o la cuenta inactiva
 *   (convenio_del_usuario() = null) → cierra la sesión y muestra «Tu cuenta
 *   está inactiva» (RUTA_CUENTA_INACTIVA).
 *
 * Devuelve el cliente con la sesión del convenio: las consultas pasan por RLS.
 */
export async function exigirConvenio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "convenio") redirect("/cuenta");

  const { data: convenioId } = await supabase.rpc("convenio_del_usuario");
  if (typeof convenioId !== "string" || convenioId.length === 0) redirect(RUTA_CUENTA_INACTIVA);

  const { data: convenio } = await supabase
    .from("convenios")
    .select("id, nombre_empresa, logo_path")
    .eq("id", convenioId)
    .maybeSingle();
  if (!convenio) redirect(RUTA_CUENTA_INACTIVA);

  return {
    supabase,
    userId: user.id,
    convenio: {
      id: convenio.id as string,
      nombre: convenio.nombre_empresa as string,
      logoUrl: urlLogo(convenio.logo_path as string | null),
    },
  };
}
