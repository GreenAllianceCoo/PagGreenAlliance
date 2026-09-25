"use server";

import { redirect } from "next/navigation";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

/**
 * «Salir» del asesor: mismo mecanismo que app/cuenta/actions.ts (no se
 * reutiliza ese archivo porque es zona de otro agente; misma lógica).
 */
export async function cerrarSesionAsesor() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    registrar("error", { evento: "asesor_cerrar_sesion_fallo", estado: error.status, codigo: error.code });
  }
  redirect("/ingresar");
}
