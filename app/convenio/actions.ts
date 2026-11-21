"use server";

import { redirect } from "next/navigation";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

/** «Salir» del panel del convenio: cierra la sesión y vuelve al ingreso con NIT. */
export async function cerrarSesionConvenio() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) registrar("error", { evento: "cerrar_sesion_fallo", estado: error.status, codigo: error.code });
  redirect("/ingresar/convenio");
}
