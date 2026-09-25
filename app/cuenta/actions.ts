"use server";

import { registrar } from "@/lib/servidor/registro";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import { esquemaTelefono } from "@/lib/validaciones/perfil";

/** «Salir» (escritorio) e icono de cerrar sesión (celular): signOut → /ingresar. */
export async function cerrarSesion() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) registrar("error", { evento: "cerrar_sesion_fallo", estado: error.status, codigo: error.code });
  redirect("/ingresar");
}

export type EstadoTelefono = {
  error?: string;
  /** Lo que escribió el usuario (se conserva si hubo error). */
  telefono?: string;
  /** Mensaje para lectores de pantalla (región aria-live). */
  mensaje?: string;
};

/**
 * «Mis datos» → «Guardar»: actualiza SOLO perfiles.telefono del usuario de la
 * sesión. RLS limita la fila al propio usuario y el trigger de la base impide
 * cambiar nombre, cédula, grado y rol.
 */
export async function actualizarTelefono(
  _previo: EstadoTelefono,
  formData: FormData,
): Promise<EstadoTelefono> {
  const escrito = textoDe(formData, "telefono");
  const resultado = esquemaTelefono.safeParse({ telefono: escrito });
  if (!resultado.success) {
    return { error: erroresPorCampo<"telefono">(resultado.error).telefono, telefono: escrito };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data, error } = await supabase
    .from("perfiles")
    .update({ telefono: resultado.data.telefono })
    .eq("id", user.id)
    .select("id");

  if (error || !data || data.length === 0) {
    registrar("error", { evento: "telefono_update_fallo", codigo: error?.code, mensaje: error?.message });
    return { error: "No pudimos guardar tu celular. Intenta de nuevo.", telefono: escrito };
  }

  revalidatePath("/cuenta");
  return { mensaje: "Guardamos tu celular.", telefono: resultado.data.telefono };
}
