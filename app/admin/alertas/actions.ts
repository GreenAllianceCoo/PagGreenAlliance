"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { registrar } from "@/lib/servidor/registro";
import { textoDe } from "@/lib/validaciones/comunes";
import { esquemaMarcarAlerta } from "@/lib/validaciones/admin";
import { esquemaRechazarRecuperacion, type CampoRechazarRecuperacion } from "@/lib/validaciones/recuperacion";
import { erroresPorCampo } from "@/lib/validaciones/comunes";

export type EstadoMarcarAlerta = { error?: string; mensaje?: string };

/**
 * «Marcar atendida» de la bandeja de alertas (spec-requerimientos-ricardo §6,
 * pieza 3m). Solo admin (exigirAdmin + la RPC lo vuelve a comprobar); la RPC
 * guarda quién y cuándo. Si otro admin ya la atendió, se avisa.
 */
export async function marcarAlertaAtendida(
  _previo: EstadoMarcarAlerta,
  formData: FormData,
): Promise<EstadoMarcarAlerta> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaMarcarAlerta.safeParse({ alertaId: textoDe(formData, "alertaId") });
  if (!resultado.success) return { error: "Datos inválidos." };

  const { error } = await supabase.rpc("admin_marcar_alerta_atendida", { p_alerta_id: resultado.data.alertaId });
  if (error) {
    if (error.message?.includes("ya estaba atendida")) {
      return { error: "Esta alerta ya estaba atendida." };
    }
    registrar("error", { evento: "admin_marcar_alerta_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos marcar la alerta. Intenta de nuevo." };
  }

  revalidatePath("/admin/alertas");
  return { mensaje: "Alerta atendida." };
}

export type EstadoRechazarRecuperacion = {
  errores?: Partial<Record<CampoRechazarRecuperacion, string>>;
  error?: string;
  mensaje?: string;
};

const MENSAJES_RECHAZO_RECUPERACION = [
  "La solicitud no existe o ya fue resuelta",
  "El motivo debe tener entre 5 y 300 caracteres",
];

/**
 * «Rechazar» una solicitud de recuperación de acceso (no cambia ningún correo).
 * Solo admin (exigirAdmin + la RPC lo vuelve a comprobar); motivo obligatorio.
 */
export async function rechazarRecuperacion(
  _previo: EstadoRechazarRecuperacion,
  formData: FormData,
): Promise<EstadoRechazarRecuperacion> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaRechazarRecuperacion.safeParse({
    solicitudId: textoDe(formData, "solicitudId"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoRechazarRecuperacion>(resultado.error) };
  }

  const { error } = await supabase.rpc("admin_rechazar_recuperacion", {
    p_solicitud_id: resultado.data.solicitudId,
    p_motivo: resultado.data.motivo,
  });
  if (error) {
    const conocido = MENSAJES_RECHAZO_RECUPERACION.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_rechazar_recuperacion_fallo", codigo: error.code, mensaje: error.message });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos rechazar la solicitud. Intenta de nuevo." };
  }

  revalidatePath("/admin/alertas");
  return { mensaje: "Solicitud rechazada." };
}
