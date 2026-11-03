"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { avisarCambioCedula } from "@/lib/correo/cedula";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import { esquemaCambiarCedula, type CampoCambiarCedula } from "@/lib/validaciones/admin";

export type EstadoCambiarCedula = {
  errores?: Partial<Record<CampoCambiarCedula, string>>;
  error?: string;
  mensaje?: string;
};

/**
 * Textos de admin_cambiar_cedula() listos para mostrar (los demás errores se ocultan).
 * Una sola lista para alinearla con la migración: se compara con `includes`.
 */
const MENSAJES_CAMBIO_CEDULA = [
  "No puedes cambiar tu propia cédula; debe hacerlo otro administrador",
  "No encontramos al asociado",
  "Es uno de tus clientes: otro administrador debe cambiar su cédula",
  "La cédula nueva es igual a la actual",
  "Esa cédula ya tiene cuenta u otra solicitud en curso",
  "El motivo no debe incluir números de cédula",
];
/** Choque con el índice único de perfiles.cedula (o de otra tabla con la cédula). */
const MENSAJE_CEDULA_REPETIDA = "Esa cédula ya está registrada en otra cuenta.";

/**
 * «Corregir cédula» (solo admin), en la ficha del crédito y en la del asociado.
 * La cédula es con lo que la persona ingresa: escribe SOLO por la RPC
 * admin_cambiar_cedula, que exige admin, no a sí mismo, y deja el historial con
 * el motivo. Después avisa al correo personal con la cédula nueva (nunca el
 * motivo) y al institucional con el aviso genérico sin datos.
 */
export async function cambiarCedulaAsociado(
  _previo: EstadoCambiarCedula,
  formData: FormData,
): Promise<EstadoCambiarCedula> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaCambiarCedula.safeParse({
    asociadoId: textoDe(formData, "asociadoId"),
    cedula: textoDe(formData, "cedula"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    const errores = erroresPorCampo<CampoCambiarCedula>(resultado.error);
    if (errores.asociadoId) return { error: errores.asociadoId };
    return { errores };
  }
  const datos = resultado.data;
  if (datos.asociadoId === userId) {
    return { error: "No puedes cambiar tu propia cédula; debe hacerlo otro administrador." };
  }
  // RS-01, como el correo de ingreso: la cédula da acceso a la cuenta, así que nadie
  // cambia la de sus propios clientes (la base vuelve a revisar sus reglas).
  const { data: actual } = await supabase
    .from("perfiles")
    .select("rol, asesor_id, eliminado_at")
    .eq("id", datos.asociadoId)
    .maybeSingle();
  if (!actual || actual.rol !== "asociado" || actual.eliminado_at) {
    return { error: "No encontramos al asociado." };
  }
  if (actual.asesor_id === userId) {
    return { error: "Es uno de tus clientes: otro administrador debe cambiar su cédula." };
  }
  // Mismo freno de frecuencia que el cambio de correo de ingreso.
  if (!(await dentroDelLimite("admin-cambiar-cedula", userId, 10, 60 * 60))) {
    return { error: "Hiciste muchos cambios seguidos. Intenta de nuevo en una hora." };
  }

  const { error } = await supabase.rpc("admin_cambiar_cedula", {
    p_asociado_id: datos.asociadoId,
    p_cedula: datos.cedula,
    p_motivo: datos.motivo,
  });
  if (error) {
    if (error.code === "23505") return { errores: { cedula: MENSAJE_CEDULA_REPETIDA } };
    const conocido = MENSAJES_CAMBIO_CEDULA.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_cambiar_cedula_fallo", codigo: error.code, mensaje: error.message });
    }
    if (conocido === "Esa cédula ya tiene cuenta u otra solicitud en curso") return { errores: { cedula: MENSAJE_CEDULA_REPETIDA } };
    return { error: conocido ? `${conocido}.` : "No pudimos cambiar la cédula. Intenta de nuevo." };
  }
  registrar("info", { evento: "admin_cedula_cambiada", actor_id: userId, asociado_id: datos.asociadoId });

  // Aviso al asociado (no bloquea la respuesta si algo falla). La base ya tiene la
  // cédula nueva, así que el correo personal se busca con ella.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, correo_institucional")
    .eq("id", datos.asociadoId)
    .single();
  if (perfil) {
    const correoPersonal = await correoDeCedula(datos.cedula);
    const correo = destinatariosAviso(correoPersonal);
    await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
    if (correo.length > 0) {
      await avisarCambioCedula({ asociadoId: datos.asociadoId, nombre: perfil.nombre_completo, correo, cedula: datos.cedula });
    }
  }

  revalidatePath("/admin/creditos");
  revalidatePath("/admin/asociados");
  revalidatePath(`/admin/asociados/${datos.asociadoId}`);
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/perfil");
  return { mensaje: "Cédula corregida. Desde ahora el asociado ingresa con la nueva." };
}
