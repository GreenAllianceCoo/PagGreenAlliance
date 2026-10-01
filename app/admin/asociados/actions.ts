"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarCreditoHabilitado } from "@/lib/correo/credito";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { registrar } from "@/lib/servidor/registro";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaActualizarProceso,
  esquemaCambiarEstadoAsociado,
  esquemaHabilitarCredito,
  type CampoHabilitarCredito,
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

export type EstadoHabilitarCredito = {
  errores?: Partial<Record<CampoHabilitarCredito, string>>;
  error?: string;
  mensaje?: string;
  /** Lo que aún impediría pedir (inactivo, sin_grado, sin_cupo, no_operando), ya traducido. */
  pendientes?: string[];
};

/** Textos de admin_habilitar_credito() listos para mostrar. */
const MENSAJES_HABILITAR = [
  "Solo un administrador puede habilitar el crédito de un asociado",
  "El motivo debe tener entre 5 y 300 caracteres",
  "No puedes habilitar tu propio crédito; debe hacerlo otro administrador",
  "El asociado no existe",
  "El asociado no tiene un crédito rechazado por habilitar",
  "Este rechazo ya fue habilitado",
];

const TEXTO_BLOQUEO: Record<string, string> = {
  inactivo: "la cuenta está dada de baja",
  sin_grado: "no tiene grado asignado",
  sin_cupo: "su grado no tiene cupo",
  no_operando: "su proceso ejecutivo aún no está en «Operando»",
};

/**
 * «Habilitar crédito» del detalle del asociado (spec §13.2). Solo el admin,
 * por la RPC `admin_habilitar_credito` (motivo 5–300, no sobre sí mismo, la
 * última solicitud debe estar rechazada y sin habilitar; deja una fila
 * inmutable en historial_solicitudes). El motivo NUNCA llega al asociado.
 * Después: correo al personal y aviso sin datos al institucional (no bloquean).
 * Campos: `asociadoId` y `motivo`.
 */
export async function habilitarCredito(
  _previo: EstadoHabilitarCredito,
  formData: FormData,
): Promise<EstadoHabilitarCredito> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaHabilitarCredito.safeParse({
    asociadoId: textoDe(formData, "asociadoId"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoHabilitarCredito>(resultado.error) };
  }
  const { asociadoId, motivo } = resultado.data;

  const { data, error } = await supabase.rpc("admin_habilitar_credito", {
    p_asociado_id: asociadoId,
    p_motivo: motivo,
  });
  if (error) {
    const conocido = MENSAJES_HABILITAR.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_habilitar_credito_fallo", codigo: error.code, mensaje: error.message });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos guardar el cambio. Intenta de nuevo." };
  }
  const fila = Array.isArray(data) ? data[0] : data;
  const bloqueos = Array.isArray(fila?.bloqueos) ? (fila.bloqueos as string[]) : [];
  const pendientes = bloqueos.map((b) => TEXTO_BLOQUEO[b]).filter((t): t is string => Boolean(t));

  // Avisos: no bloquean. Nombre y cédula salen de la ficha (RLS del admin).
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, cedula, correo_institucional")
    .eq("id", asociadoId)
    .maybeSingle();
  if (perfil) {
    const correoPersonal = await correoDeCedula(perfil.cedula);
    const correo = destinatariosAviso(correoPersonal);
    await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
    if (correo.length > 0) await enviarCreditoHabilitado({ id: asociadoId, nombre: perfil.nombre_completo, correo });
  }

  revalidatePath("/admin/asociados");
  revalidatePath(`/admin/asociados/${asociadoId}`);
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/solicitar");
  return {
    mensaje: pendientes.length
      ? `Crédito habilitado. Aún no podrá pedir porque ${pendientes.join(" y ")}.`
      : "Crédito habilitado. Ya puede hacer una nueva solicitud.",
    pendientes,
  };
}
