"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { registrar } from "@/lib/servidor/registro";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import { esquemaActualizarProceso, type CampoActualizarProceso } from "@/lib/validaciones/admin";

export type EstadoActualizarProceso = {
  errores?: Partial<Record<CampoActualizarProceso, string>>;
  error?: string;
  mensaje?: string;
};

/** Textos de admin_actualizar_proceso_ejecutivo() / normalizar_proceso_ejecutivo() listos para mostrar. */
const MENSAJES_DE_LA_BASE = [
  // RS-01: nadie cambia el proceso de sus propios clientes ni el suyo.
  "Otro administrador debe actualizar el proceso de tus clientes",
  "Otro administrador debe actualizar tu propio proceso",
  "La fecha de inicio del embargo solo se registra desde el paso «Operando»",
  "La fecha de inicio del embargo no puede estar a más de un mes en el futuro",
  "No existe ese asociado",
];

/**
 * Selector «Estado del proceso ejecutivo» + «Fecha de inicio del embargo»
 * del detalle del asociado (spec-requerimientos-ricardo §3.6–§3.7 y §6,
 * pieza 3m). Solo el admin; escribe SOLO por la RPC
 * admin_actualizar_proceso_ejecutivo (la tabla no tiene privilegios de
 * escritura para authenticated) y el historial lo deja un trigger con la
 * fecha y el admin. Fecha vacía = conservar la actual (o hoy, al pasar a
 * «Operando»).
 */
export async function actualizarProcesoEjecutivo(
  _previo: EstadoActualizarProceso,
  formData: FormData,
): Promise<EstadoActualizarProceso> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaActualizarProceso.safeParse({
    asociadoId: textoDe(formData, "asociadoId"),
    estado: textoDe(formData, "estado"),
    fechaInicioEmbargo: textoDe(formData, "fechaInicioEmbargo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoActualizarProceso>(resultado.error) };
  }
  const { asociadoId, estado, fechaInicioEmbargo } = resultado.data;

  const { error } = await supabase.rpc("admin_actualizar_proceso_ejecutivo", {
    p_asociado_id: asociadoId,
    p_estado: estado,
    p_fecha_inicio_embargo: fechaInicioEmbargo,
  });
  if (error) {
    const conocido = MENSAJES_DE_LA_BASE.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_proceso_ejecutivo_fallo", codigo: error.code, mensaje: error.message });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  revalidatePath("/admin/asociados");
  revalidatePath(`/admin/asociados/${asociadoId}`);
  return { mensaje: "Proceso actualizado." };
}
