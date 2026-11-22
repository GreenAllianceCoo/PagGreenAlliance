"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { registrar } from "@/lib/servidor/registro";
import { textoDe } from "@/lib/validaciones/comunes";
import { esquemaMostrarPublicacion, esquemaOcultarPublicacion } from "@/lib/validaciones/publicacionesConvenio";

export type EstadoModeracion = { error?: string; mensaje?: string; listo?: number };

/** Lo que cambia al ocultar o mostrar: esta pantalla, el panel del convenio y Beneficios. */
function refrescar(id: string) {
  revalidatePath("/admin/convenios/publicaciones");
  revalidatePath("/convenio");
  revalidatePath(`/convenio/${id}`);
  revalidatePath("/cuenta/beneficios");
}

/**
 * «Ocultar» (docs/spec-convenios.md §B4): la saca de Beneficios y el convenio
 * ya no puede editarla ni retirarla. El trigger sella quién y cuándo, y deja
 * la huella en el historial del equipo.
 */
export async function ocultarPublicacion(_previo: EstadoModeracion, formData: FormData): Promise<EstadoModeracion> {
  const { supabase, userId } = await exigirAdmin();
  const resultado = esquemaOcultarPublicacion.safeParse({ id: textoDe(formData, "id"), motivo: textoDe(formData, "motivo") });
  if (!resultado.success) {
    const motivo = resultado.error.issues.find((i) => i.path[0] === "motivo");
    return { error: motivo?.message ?? "Datos inválidos." };
  }
  const { id, motivo } = resultado.data;

  const { data, error } = await supabase
    .from("convenio_publicaciones")
    .update({ oculta_en: new Date().toISOString(), oculta_motivo: motivo })
    .eq("id", id)
    .is("oculta_en", null)
    .select("titulo")
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "admin_publicacion_ocultar_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos ocultarla. Intenta de nuevo." };
  }
  if (!data) return { error: "Esa publicación ya no existe o ya estaba oculta. Recarga la página." };

  registrar("info", { evento: "admin_publicacion_ocultada", publicacionId: id, admin: userId });
  refrescar(id);
  return { mensaje: `«${data.titulo}» quedó oculta.`, listo: Date.now() };
}

/** «Volver a mostrar»: vuelve a Beneficios (si sus fechas la dejan) aunque el convenio esté en el tope. */
export async function mostrarPublicacion(_previo: EstadoModeracion, formData: FormData): Promise<EstadoModeracion> {
  const { supabase, userId } = await exigirAdmin();
  const resultado = esquemaMostrarPublicacion.safeParse({ id: textoDe(formData, "id") });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { id } = resultado.data;

  const { data, error } = await supabase
    .from("convenio_publicaciones")
    .update({ oculta_en: null, oculta_motivo: null })
    .eq("id", id)
    .not("oculta_en", "is", null)
    .select("titulo")
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "admin_publicacion_mostrar_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos volver a mostrarla. Intenta de nuevo." };
  }
  if (!data) return { error: "Esa publicación ya no existe o ya se estaba mostrando. Recarga la página." };

  registrar("info", { evento: "admin_publicacion_mostrada", publicacionId: id, admin: userId });
  refrescar(id);
  return { mensaje: `«${data.titulo}» se volvió a mostrar.`, listo: Date.now() };
}
