"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { registrar } from "@/lib/servidor/registro";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaActualizarProceso,
  esquemaCambiarEstadoAsociado,
  type CampoActualizarProceso,
  type CampoEstadoAsociado,
} from "@/lib/validaciones/admin";

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

export type EstadoCambiarEstadoAsociado = {
  errores?: Partial<Record<CampoEstadoAsociado, string>>;
  error?: string;
  mensaje?: string;
};

/** Textos de admin_cambiar_estado_asociado() listos para mostrar. */
const MENSAJES_ESTADO_ASOCIADO = [
  "No puedes cambiar tu propio estado; debe hacerlo otro administrador",
  "El motivo debe tener entre 5 y 300 caracteres",
  "El asociado no existe",
  "El asociado ya está activo",
  "El asociado ya está dado de baja",
];

/**
 * «Dar de baja» / «Reactivar» del detalle del asociado (spec §12.6). Solo el
 * admin, por la RPC `admin_cambiar_estado_asociado` (motivo obligatorio,
 * historial en `historial_estado_asociado`; un update directo de
 * `perfiles.activo` lo rechaza la base). La baja deja `activo = false`: el
 * servidor corta /cuenta en cada carga, así que la sesión queda inservible.
 * Campos del formulario: `asociadoId`, `activo` («false» = dar de baja,
 * «true» = reactivar) y `motivo`.
 */
export async function cambiarEstadoAsociado(
  _previo: EstadoCambiarEstadoAsociado,
  formData: FormData,
): Promise<EstadoCambiarEstadoAsociado> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaCambiarEstadoAsociado.safeParse({
    asociadoId: textoDe(formData, "asociadoId"),
    activo: textoDe(formData, "activo"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoEstadoAsociado | "activo">(resultado.error) as EstadoCambiarEstadoAsociado["errores"] };
  }
  const { asociadoId, activo, motivo } = resultado.data;

  const { error } = await supabase.rpc("admin_cambiar_estado_asociado", {
    p_asociado_id: asociadoId,
    p_activo: activo,
    p_motivo: motivo,
  });
  if (error) {
    const conocido = MENSAJES_ESTADO_ASOCIADO.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_estado_asociado_fallo", codigo: error.code, mensaje: error.message });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  revalidatePath("/admin/asociados");
  revalidatePath(`/admin/asociados/${asociadoId}`);
  return { mensaje: activo ? "Asociado reactivado." : "Asociado dado de baja." };
}
