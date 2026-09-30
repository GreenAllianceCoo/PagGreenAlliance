import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { puedeAtender } from "@/lib/asesor/puedeAtender";
import { vistaComisiones, type FilaComisionesPeriodo, type VistaComisiones } from "@/lib/asesor/comisiones";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

export { puedeAtender };

/**
 * Comprueba en el servidor que quien pide /asesor (o ejecuta una acción del
 * asesor) puede atender asociados HOY (F2-03). Ricardo Varón es admin con
 * `atiende_asociados` y también entra. Si no, se le manda a su lugar:
 * admin → /admin, asociado → /cuenta, sin perfil → /ingresar.
 * Las funciones de la base vuelven a exigir lo mismo (puede_atender()).
 */
export async function exigirAsesor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol, atiende_asociados, activo")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/ingresar");
  if (!puedeAtender(perfil)) redirect(perfil.rol === "admin" ? "/admin" : "/cuenta");

  return {
    supabase,
    userId: user.id,
    nombre: (perfil.nombre_completo as string | null) ?? "Asesor",
    rol: perfil.rol as "asesor" | "admin",
  };
}

/** Comisiones del periodo en curso (o del que contiene `fecha`) del asesor en sesión. */
export async function cargarComisionesAsesor(
  supabase: SupabaseClient,
  fecha?: string,
): Promise<VistaComisiones | null> {
  const { data, error } = await supabase
    .rpc("comisiones_periodo_asesor", fecha ? { p_fecha: fecha } : {})
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "comisiones_periodo_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return vistaComisiones(data as FilaComisionesPeriodo | null);
}
