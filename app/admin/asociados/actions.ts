"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { exigirAdmin } from "@/lib/admin/servidor";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarCreditoHabilitado } from "@/lib/correo/credito";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { avisarCambioCorreoIngreso } from "@/lib/correo/recuperacion";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaActualizarProceso,
  esquemaCambiarEstadoAsociado,
  esquemaHabilitarCredito,
  type CampoHabilitarCredito,
  type CampoActualizarProceso,
  type CampoEstadoAsociado,
} from "@/lib/validaciones/admin";
import {
  esquemaCambiarCorreoAdmin,
  type CampoCambiarCorreoAdmin,
} from "@/lib/validaciones/recuperacion";

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

// ---------------------------------------------------------------------------
// Recuperación de acceso: «Cambiar correo de ingreso»
// ---------------------------------------------------------------------------

export type EstadoCambiarCorreoIngreso = {
  errores?: Partial<Record<CampoCambiarCorreoAdmin | "confirmaCelular", string>>;
  error?: string;
  mensaje?: string;
};

/** Textos de admin_validar_cambio_correo() / admin_registrar_cambio_correo() listos para mostrar. */
const MENSAJES_CAMBIO_CORREO = [
  "Otro administrador debe cambiar el correo de tus clientes",
  "No puedes cambiar tu propio correo de ingreso desde aquí; usa tu perfil",
  "El motivo debe tener entre 5 y 300 caracteres",
  "El asociado no existe",
  "Otro administrador debe cambiar el correo: cambiaste el asesor de esta persona hace menos de 24 horas",
  "No hay una solicitud de recuperación pendiente de esta persona",
];

/**
 * «Cambiar correo de ingreso» (recuperación de acceso). Solo el admin, con
 * motivo obligatorio (5 a 300). Orden (SEC-REC-03: validar ANTES de tocar
 * Auth): valida → límite → RPC admin_validar_cambio_correo (asociado, no es
 * suyo ni su cliente, no le cambió el asesor en 24 h, hay solicitud de
 * recuperación PENDIENTE) → si el celular escrito no coincidía con el del
 * perfil exige la casilla «verifiqué por el celular del perfil» → cambia el
 * correo de AUTH con service role (el correo solo vive allí) → cierra TODAS las
 * sesiones de esa persona (SEC-REC-04) → deja el historial y cierra la
 * solicitud con admin_registrar_cambio_correo → avisa al correo anterior y al
 * nuevo (después de responder). Campos: asociadoId, correo, motivo y
 * confirmaCelular (casilla).
 */
export async function cambiarCorreoIngreso(
  _previo: EstadoCambiarCorreoIngreso,
  formData: FormData,
): Promise<EstadoCambiarCorreoIngreso> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaCambiarCorreoAdmin.safeParse({
    asociadoId: textoDe(formData, "asociadoId"),
    correo: textoDe(formData, "correo"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoCambiarCorreoAdmin>(resultado.error) };
  }
  const { asociadoId, correo, motivo } = resultado.data;
  const confirmaCelular = textoDe(formData, "confirmaCelular") === "on";

  if (asociadoId === userId) {
    return { error: "No puedes cambiar tu propio correo de ingreso desde aquí; usa tu perfil." };
  }
  if (!(await dentroDelLimite("admin-cambio-correo", userId, 10, 60 * 60))) {
    return { error: "Hiciste muchos cambios seguidos. Intenta de nuevo en una hora." };
  }

  // 1) Validar ANTES de tocar Auth (con la sesión del admin: el actor es quien llama).
  const { data: solicitudId, error: errorValidar } = await supabase.rpc("admin_validar_cambio_correo", {
    p_asociado_id: asociadoId,
    p_motivo: motivo,
  });
  if (errorValidar || !solicitudId) {
    const conocido = MENSAJES_CAMBIO_CORREO.find((m) => errorValidar?.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_cambio_correo_validar_fallo", codigo: errorValidar?.code });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  // 2) SEC-REC-01: si el celular escrito no es el del perfil, confirmación aparte.
  const { data: solicitud } = await supabase
    .from("solicitudes_recuperacion_acceso")
    .select("celular_coincide")
    .eq("id", solicitudId as string)
    .maybeSingle();
  if (solicitud && solicitud.celular_coincide === false && !confirmaCelular) {
    return {
      errores: {
        confirmaCelular: "Confirma que verificaste la identidad por el celular del perfil, no por el escrito en la solicitud.",
      },
    };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo")
    .eq("id", asociadoId)
    .maybeSingle();
  const nombre = (perfil?.nombre_completo as string | undefined) ?? "asociado";

  // 3) Cambio en Auth (service role, solo servidor).
  const admin = crearClienteAdmin();
  const { data: actual, error: errorLectura } = await admin.auth.admin.getUserById(asociadoId);
  if (errorLectura || !actual?.user) {
    registrar("error", { evento: "admin_cambio_correo_lectura_fallo", estado: errorLectura?.status });
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }
  const anterior = actual.user.email ?? null;
  if (anterior && anterior.toLowerCase() === correo) {
    return { errores: { correo: "Ese ya es su correo de ingreso." } };
  }
  const { error: errorCambio } = await admin.auth.admin.updateUserById(asociadoId, {
    email: correo,
    email_confirm: true,
  });
  if (errorCambio) {
    if (errorCambio.code === "email_exists" || errorCambio.status === 422) {
      return { errores: { correo: "Ese correo ya lo usa otra cuenta." } };
    }
    registrar("error", { evento: "admin_cambio_correo_fallo", estado: errorCambio.status, codigo: errorCambio.code });
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  // 4) SEC-REC-04: cerrar todas las sesiones abiertas de esa persona (si el
  //    correo viejo estaba comprometido, el intruso queda fuera).
  const { error: errorSesiones } = await admin.rpc("cerrar_sesiones_usuario", { p_user_id: asociadoId });
  if (errorSesiones) {
    registrar("error", { evento: "admin_cambio_correo_cerrar_sesiones_fallo", codigo: errorSesiones.code });
  }

  // 5) Historial + solicitud atendida (con la sesión del admin).
  const { error: errorHistorial } = await supabase.rpc("admin_registrar_cambio_correo", {
    p_asociado_id: asociadoId,
    p_motivo: motivo,
  });
  if (errorHistorial) {
    // El correo YA cambió: no se deshace; se deja el aviso en el registro del servidor.
    registrar("error", {
      evento: "admin_cambio_correo_historial_fallo",
      codigo: errorHistorial.code,
      mensaje: errorHistorial.message,
    });
    revalidatePath(`/admin/asociados/${asociadoId}`);
    return { error: "El correo cambió, pero no pudimos guardar el historial. Avisa al equipo técnico." };
  }

  after(() => avisarCambioCorreoIngreso({ nombre, anterior, nuevo: correo }));

  revalidatePath("/admin/asociados");
  revalidatePath(`/admin/asociados/${asociadoId}`);
  revalidatePath("/admin/alertas");
  return {
    mensaje: errorSesiones
      ? "Correo de ingreso cambiado, pero no pudimos cerrar sus sesiones abiertas. Avisa al equipo técnico."
      : "Correo de ingreso cambiado y sesiones anteriores cerradas. Avisamos al correo anterior y al nuevo.",
  };
}
