"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { MONTO_MAXIMO_PAGO } from "@/lib/asesor/comisiones";
import { exigirAdmin } from "@/lib/admin/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import {
  esquemaAnularPagoComision,
  esquemaAtiendeAsociados,
  esquemaCambiarRolEquipo,
  type CampoCambiarRolEquipo,
  esquemaEditarPagoComision,
  leerFormularioEditarPago,
  type CampoEditarPagoComision,
  esquemaCrearAsesor,
  esquemaPagoComision,
  leerFormularioAsesor,
  leerFormularioPagoComision,
  type CampoCrearAsesor,
  type CampoPagoComision,
} from "@/lib/validaciones/admin";
import { textoDe } from "@/lib/validaciones/comunes";

export type EstadoCrearAsesor = {
  errores?: Partial<Record<CampoCrearAsesor, string>>;
  /** Error que no es de un campo (correo/cédula duplicados en Auth, falla de la base). */
  errorGeneral?: string;
  mensaje?: string;
  /** Lo que escribió el admin, para no borrarlo si hay error. */
  valores?: ReturnType<typeof leerFormularioAsesor>;
};

/**
 * «Registrar asesor»: crea el usuario en Supabase Auth (mismo mecanismo que
 * un asociado: `auth.admin.createUser` con la cédula en `app_metadata`) y
 * luego, con la sesión del admin, cambia su rol a `asesor` (handle_new_user
 * siempre crea el perfil como `asociado`; el cambio de rol solo lo puede
 * hacer un admin autenticado, por RLS).
 */
export async function crearAsesor(
  _previo: EstadoCrearAsesor,
  formData: FormData,
): Promise<EstadoCrearAsesor> {
  const { supabase } = await exigirAdmin();

  const entrada = leerFormularioAsesor(formData);
  const resultado = esquemaCrearAsesor.safeParse(entrada);
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoCrearAsesor>(resultado.error), valores: entrada };
  }
  const datos = resultado.data;
  const nombreCompleto = `${datos.nombres} ${datos.apellidos}`;

  const admin = crearClienteAdmin();

  const { data: existente } = await admin.from("perfiles").select("id").eq("cedula", datos.cedula).maybeSingle();
  if (existente) {
    return { errores: { cedula: "Ya existe una cuenta con esta cédula." }, valores: entrada };
  }

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: datos.correo,
    email_confirm: true,
    app_metadata: { cedula: datos.cedula },
    user_metadata: { nombre_completo: nombreCompleto },
  });
  if (error || !creado?.user) {
    registrar("error", { evento: "crear_asesor_usuario_fallo", mensaje: error?.message });
    return {
      errorGeneral: "No pudimos crear el asesor. Revisa que el correo no esté ya registrado.",
      valores: entrada,
    };
  }

  // GoTrue guarda app_metadata después del insert: handle_new_user deja la
  // cédula en «PENDIENTE-…». Se fija aquí para que el asesor pueda ingresar.
  const { error: errorCedula } = await admin.from("perfiles").update({ cedula: datos.cedula }).eq("id", creado.user.id);
  if (errorCedula) {
    registrar("error", { evento: "crear_asesor_cedula_fallo", mensaje: errorCedula.message });
    return {
      errorGeneral: "Creamos la cuenta, pero no pudimos guardar su cédula. Avisa al equipo técnico.",
      valores: entrada,
    };
  }

  const { error: errorRol } = await supabase.from("perfiles").update({ rol: datos.rol }).eq("id", creado.user.id);
  if (errorRol) {
    registrar("error", { evento: "crear_asesor_rol_fallo", mensaje: errorRol.message });
    return {
      errorGeneral: `Creamos la cuenta, pero no pudimos asignarle el rol de ${datos.rol}. Avisa al equipo técnico.`,
      valores: entrada,
    };
  }

  revalidatePath("/admin/asesores");
  // Quién y cuándo: lo escribe el trigger registrar_cambio_rol (historial_cambio_rol); aquí queda además en el registro.
  registrar("info", { evento: "equipo_creado", rol: datos.rol, perfil_id: creado.user.id });
  return { mensaje: `${datos.rol === "secretario" ? "Secretario" : "Asesor"} «${nombreCompleto}» creado.` };
}

// ---------------------------------------------------------------------------
// Requerimientos de Ricardo (spec-requerimientos-ricardo §5.4 y §6, pieza 3m)
// ---------------------------------------------------------------------------

/** RS-01: texto de la base (sellar_pago_comision / proteger_pago_comision) cuando el pago sería a nombre del propio admin. */
const MENSAJE_PAGO_PROPIO = "Otro administrador debe registrar tus comisiones.";

export type EstadoPagoComision = {
  errores?: Partial<Record<CampoPagoComision, string>>;
  errorGeneral?: string;
  mensaje?: string;
  valores?: ReturnType<typeof leerFormularioPagoComision>;
};

/**
 * «Registrar pago de comisión»: inserta en pagos_comision con la sesión del
 * admin (RLS: solo admin inserta; el trigger sella quién y cuándo y exige
 * que el asesor pueda atender). Libro contable: no hay editar ni borrar; una
 * corrección se registra como «Ajuste» (puede ser negativo).
 * R-09 decidido: solo el admin (Sebas o Ricardo) registra pagos; el asesor ve la suma de estos pagos.
 */
export async function registrarPagoComision(
  _previo: EstadoPagoComision,
  formData: FormData,
): Promise<EstadoPagoComision> {
  const { supabase } = await exigirAdmin();

  const entrada = leerFormularioPagoComision(formData);
  const resultado = esquemaPagoComision.safeParse(entrada);
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoPagoComision>(resultado.error), valores: entrada };
  }
  const datos = resultado.data;

  const { error } = await supabase.from("pagos_comision").insert({
    asesor_id: datos.asesorId,
    asociado_id: datos.asociadoId,
    periodo_corte: datos.periodoCorte,
    concepto: datos.concepto,
    monto: datos.monto,
    nota: datos.nota,
  });
  if (error) {
    if (error.message?.includes("Otro administrador debe registrar tus comisiones")) {
      return { errores: { asesorId: MENSAJE_PAGO_PROPIO }, valores: entrada };
    }
    if (error.message?.includes("asesor activo")) {
      return { errores: { asesorId: "El pago debe ser para un asesor activo." }, valores: entrada };
    }
    registrar("error", { evento: "registrar_pago_comision_fallo", codigo: error.code, mensaje: error.message });
    return { errorGeneral: "No pudimos registrar el pago. Intenta de nuevo.", valores: entrada };
  }

  revalidatePath("/admin/asesores");
  return { mensaje: "Pago registrado." };
}

export type EstadoCambiarRolEquipo = {
  errores?: Partial<Record<CampoCambiarRolEquipo, string>>;
  error?: string;
  mensaje?: string;
};

/** Textos de admin_cambiar_rol_equipo() listos para mostrar. */
const MENSAJES_CAMBIO_ROL = [
  "No puedes cambiar tu propio rol; debe hacerlo otro administrador",
  "Ese cambio de rol no está permitido",
  "Tiene clientes asignados; reasígnalos antes de pasarlo a secretario",
  "La persona no existe",
];

/**
 * «Cambiar rol» de un miembro del equipo (secretario a asesor o admin, asesor a
 * secretario). Solo el admin, por la RPC admin_cambiar_rol_equipo: motivo obligatorio
 * (5 a 300), nunca el propio rol, y queda en historial_cambio_rol con el motivo
 * (se ve en «Historial del equipo»). Campos: perfilId, rol (el nuevo) y motivo.
 */
export async function cambiarRolEquipo(
  _previo: EstadoCambiarRolEquipo,
  formData: FormData,
): Promise<EstadoCambiarRolEquipo> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaCambiarRolEquipo.safeParse({
    perfilId: textoDe(formData, "perfilId"),
    rol: textoDe(formData, "rol"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoCambiarRolEquipo>(resultado.error) };
  }
  const { perfilId, rol, motivo } = resultado.data;
  if (perfilId === userId) return { error: "No puedes cambiar tu propio rol; debe hacerlo otro administrador." };

  const { error } = await supabase.rpc("admin_cambiar_rol_equipo", { p_perfil_id: perfilId, p_rol: rol, p_motivo: motivo });
  if (error) {
    const conocido = MENSAJES_CAMBIO_ROL.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "admin_cambiar_rol_equipo_fallo", codigo: error.code, mensaje: error.message });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  revalidatePath("/admin/asesores");
  revalidatePath("/admin/historial");
  revalidatePath("/afiliacion");
  return { mensaje: "Rol cambiado." };
}

export type EstadoAtiendeAsociados = { error?: string; mensaje?: string };

/**
 * Interruptor «Atiende asociados» (spec §2.9 y §6): solo aplica a ADMINS
 * (un asesor siempre atiende). Encendido = aparece en el desplegable de
 * /afiliacion, puede tener clientes y entra a /asesor. Lo protege
 * proteger_campos_perfil: solo un admin lo cambia (RLS con su sesión).
 */
export async function alternarAtiendeAsociados(
  _previo: EstadoAtiendeAsociados,
  formData: FormData,
): Promise<EstadoAtiendeAsociados> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaAtiendeAsociados.safeParse({
    perfilId: textoDe(formData, "perfilId"),
    atiende: textoDe(formData, "atiende"),
  });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { perfilId, atiende } = resultado.data;

  const { data, error } = await supabase
    .from("perfiles")
    .update({ atiende_asociados: atiende })
    .eq("id", perfilId)
    .eq("rol", "admin")
    .select("id, nombre_completo")
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "atiende_asociados_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }
  if (!data) return { error: "Este interruptor solo aplica a administradores." };

  revalidatePath("/admin/asesores");
  revalidatePath("/afiliacion");
  return {
    mensaje: atiende
      ? `${data.nombre_completo} ahora atiende asociados.`
      : `${data.nombre_completo} ya no atiende asociados.`,
  };
}

/** Textos de las RPC de corrección/anulación listos para mostrar. */
const MENSAJES_PAGO_DE_LA_BASE = [
  "Otro administrador debe registrar tus comisiones",
  "Un pago anulado ya no se puede modificar",
  "No existe ese pago",
  "No hay cambios para guardar",
];

function mensajeErrorPago(error: { code?: string; message?: string }, evento: string) {
  const conocido = MENSAJES_PAGO_DE_LA_BASE.find((m) => error.message?.includes(m));
  if (conocido) return `${conocido}.`;
  // RS-10 (pagos_comision_monto_tope_chk): tope por pago, también al corregir.
  if (error.code === "23514" && error.message?.includes("tope")) {
    return `El monto no puede pasar de $ ${MONTO_MAXIMO_PAGO.toLocaleString("es-CO")}.`;
  }
  // pagos_comision_monto_chk: el monto no cuadra con el concepto.
  if (error.code === "23514") return "El monto no es válido para ese concepto (para descontar usa «Ajuste»).";
  registrar("error", { evento, codigo: error.code, mensaje: error.message });
  return "No pudimos guardar el cambio. Intenta de nuevo.";
}

export type EstadoEditarPago = {
  errores?: Partial<Record<CampoEditarPagoComision, string>>;
  error?: string;
  mensaje?: string;
};

/**
 * «Corregir pago» (spec-requerimientos-ricardo §8, migración
 * 20260930100000): cambia monto, concepto y/o nota de un pago VIGENTE por la
 * RPC admin_editar_pago_comision, con motivo obligatorio (5–300). Campo
 * vacío = no cambiar. Queda en bitacora_pagos_comision (antes/después).
 */
export async function editarPagoComision(_previo: EstadoEditarPago, formData: FormData): Promise<EstadoEditarPago> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaEditarPagoComision.safeParse(leerFormularioEditarPago(formData));
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoEditarPagoComision>(resultado.error) };
  }
  const datos = resultado.data;

  const { error } = await supabase.rpc("admin_editar_pago_comision", {
    p_pago_id: datos.pagoId,
    p_motivo: datos.motivo,
    p_monto: datos.monto,
    p_concepto: datos.concepto,
    p_nota: datos.nota,
  });
  if (error) return { error: mensajeErrorPago(error, "editar_pago_comision_fallo") };

  revalidatePath("/admin/asesores");
  return { mensaje: "Pago corregido." };
}

export type EstadoAnularPago = { errores?: { motivo?: string }; error?: string; mensaje?: string };

/**
 * «Anular pago»: el pago queda anulado (no se borra), deja de sumar en el
 * acumulado del asesor y queda en la bitácora con el motivo.
 */
export async function anularPagoComision(_previo: EstadoAnularPago, formData: FormData): Promise<EstadoAnularPago> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaAnularPagoComision.safeParse({
    pagoId: textoDe(formData, "pagoId"),
    motivo: textoDe(formData, "motivo"),
  });
  if (!resultado.success) {
    const errores = erroresPorCampo<"pagoId" | "motivo">(resultado.error);
    return errores.motivo ? { errores: { motivo: errores.motivo } } : { error: "Datos inválidos." };
  }

  const { error } = await supabase.rpc("admin_anular_pago_comision", {
    p_pago_id: resultado.data.pagoId,
    p_motivo: resultado.data.motivo,
  });
  if (error) return { error: mensajeErrorPago(error, "anular_pago_comision_fallo") };

  revalidatePath("/admin/asesores");
  return { mensaje: "Pago anulado." };
}
