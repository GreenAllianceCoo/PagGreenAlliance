"use server";

import { exigirAdmin } from "@/lib/admin/servidor";
import { enviarCodigoEliminacion } from "@/lib/correo/eliminacion";
import {
  agruparPorBucket,
  generarCodigoEliminacion,
  hashCodigoEliminacion,
  secretoEliminacion,
} from "@/lib/eliminacion";
import { enmascararCorreo } from "@/lib/mascara";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaConfirmarEliminacion,
  esquemaPedirEliminacion,
  esquemaReintentoEliminacion,
  type CampoPedirEliminacion,
} from "@/lib/validaciones/eliminacion";

/**
 * «Eliminar definitivamente» (pedido de Sebas, 1-oct) = ANONIMIZAR: la fila del
 * asociado y sus cifras (créditos, pagos, comisiones, historial) se conservan sin
 * datos personales; se borran su afiliación, fotos, token del carné y su usuario
 * de Auth. Solo admin; el asociado debe estar dado de baja; motivo obligatorio;
 * confirmación con un código de 6 dígitos que llega al correo del admin que lo pide
 * (10 minutos, 3 intentos). Las funciones de la base son SOLO service_role: este
 * archivo es el único camino, y siempre después de `exigirAdmin()`.
 */

export type EstadoPedirEliminacion = {
  errores?: Partial<Record<CampoPedirEliminacion, string>>;
  error?: string;
  /** Hay un código enviado: se pasa al paso 2. */
  solicitudId?: string;
  correoMascara?: string;
};

export type EstadoConfirmarEliminacion = {
  errores?: { codigo?: string };
  error?: string;
  /** El código ya no sirve (vencido, bloqueado o inválido): hay que volver a pedirlo. */
  reiniciar?: boolean;
  /** La base ya quedó anonimizada pero falló borrar Storage/Auth: se puede reintentar SIN código. */
  limpiezaPendiente?: boolean;
  mensaje?: string;
};

/** Textos de validar_eliminacion_asociado() / admin_solicitar_eliminacion() listos para mostrar. */
const MENSAJES_ELIMINACION = [
  "Solo un administrador puede eliminar a un asociado",
  "No puedes eliminarte a ti mismo; debe hacerlo otro administrador",
  "El asociado no existe",
  "Este asociado ya fue eliminado",
  "Los asesores y administradores no se eliminan desde aquí",
  "Primero da de baja al asociado; solo se elimina a un asociado inactivo",
  "Este asociado atiende a otros asociados; reasigna a sus clientes antes de eliminarlo",
  "Tiene una solicitud de crédito pendiente; resuélvela antes de eliminarlo",
  "El motivo debe tener entre 5 y 300 caracteres",
];

const GENERICO = "No pudimos completar la acción. Intenta de nuevo.";

// ---------------------------------------------------------------------------
// Paso 1: motivo → código al correo del admin
// ---------------------------------------------------------------------------

export async function pedirEliminacionAsociado(
  _previo: EstadoPedirEliminacion,
  formData: FormData,
): Promise<EstadoPedirEliminacion> {
  const { supabase, userId, nombre } = await exigirAdmin();

  const resultado = esquemaPedirEliminacion.safeParse({
    asociadoId: textoDe(formData, "asociadoId"),
    motivo: textoDe(formData, "motivo"),
    entiendo: textoDe(formData, "entiendo"),
  });
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoPedirEliminacion>(resultado.error) };
  }
  const { asociadoId, motivo } = resultado.data;

  const secreto = secretoEliminacion();
  if (!secreto) {
    registrar("error", { evento: "eliminacion_sin_secreto" });
    return { error: GENERICO };
  }
  if (!(await dentroDelLimite("admin-eliminar-codigo", userId, 5, 60 * 60))) {
    return { error: "Pediste muchos códigos seguidos. Intenta de nuevo en una hora." };
  }

  // El código va al correo de ESTE admin (el de su sesión), nunca a otro.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const correoAdmin = user?.email?.trim().toLowerCase();
  if (!correoAdmin) return { error: "Tu cuenta no tiene un correo para enviarte el código." };

  const codigo = generarCodigoEliminacion();
  const servicio = crearClienteAdmin();
  const { data: solicitudId, error } = await servicio.rpc("admin_solicitar_eliminacion", {
    p_admin_id: userId,
    p_asociado_id: asociadoId,
    p_motivo: motivo,
    p_codigo_hash: hashCodigoEliminacion(codigo, userId, asociadoId, secreto),
  });
  if (error || !solicitudId) {
    const conocido = MENSAJES_ELIMINACION.find((m) => error?.message?.includes(m));
    if (!conocido) registrar("error", { evento: "eliminacion_pedir_fallo", codigo: error?.code, mensaje: error?.message });
    return { error: conocido ? `${conocido}.` : GENERICO };
  }

  const enviado = await enviarCodigoEliminacion({ correo: correoAdmin, nombreAdmin: nombre, codigo });
  if (!enviado) {
    await servicio.rpc("admin_cancelar_eliminacion", { p_admin_id: userId, p_solicitud_id: solicitudId });
    return { error: "No pudimos enviar el código a tu correo. Intenta de nuevo." };
  }

  return { solicitudId: solicitudId as string, correoMascara: enmascararCorreo(correoAdmin) };
}

// ---------------------------------------------------------------------------
// Paso 2: código → anonimizar → limpiar Storage y Auth
// ---------------------------------------------------------------------------

export async function confirmarEliminacionAsociado(
  _previo: EstadoConfirmarEliminacion,
  formData: FormData,
): Promise<EstadoConfirmarEliminacion> {
  const { userId } = await exigirAdmin();
  const reintento = textoDe(formData, "reintento") === "1";

  const base = {
    asociadoId: textoDe(formData, "asociadoId"),
    solicitudId: textoDe(formData, "solicitudId"),
  };
  const resultado = reintento
    ? esquemaReintentoEliminacion.safeParse(base)
    : esquemaConfirmarEliminacion.safeParse({ ...base, codigo: textoDe(formData, "codigo") });
  if (!resultado.success) {
    const codigo = resultado.error.issues.find((i) => i.path[0] === "codigo")?.message;
    return codigo ? { errores: { codigo } } : { error: resultado.error.issues[0]?.message ?? GENERICO, reiniciar: true };
  }
  const { asociadoId, solicitudId } = resultado.data;
  const codigo = reintento ? "" : ((resultado.data as { codigo?: string }).codigo ?? "");

  const secreto = secretoEliminacion();
  if (!secreto) {
    registrar("error", { evento: "eliminacion_sin_secreto" });
    return { error: GENERICO };
  }
  // Tope extra de pruebas por hora (además de los 3 intentos por código que cuenta la base).
  if (!(await dentroDelLimite("admin-eliminar-confirmar", userId, 20, 60 * 60))) {
    return { error: "Hiciste muchos intentos seguidos. Intenta de nuevo en una hora." };
  }

  const servicio = crearClienteAdmin();
  const { data, error } = await servicio
    .rpc("admin_confirmar_eliminacion", {
      p_admin_id: userId,
      p_solicitud_id: solicitudId,
      p_codigo_hash: hashCodigoEliminacion(codigo, userId, asociadoId, secreto),
    })
    .maybeSingle();
  if (error || !data) {
    const conocido = MENSAJES_ELIMINACION.find((m) => error?.message?.includes(m));
    if (!conocido) registrar("error", { evento: "eliminacion_confirmar_fallo", codigo: error?.code, mensaje: error?.message });
    return { error: conocido ? `${conocido}.` : GENERICO, reiniciar: Boolean(conocido) };
  }

  const fila = data as { resultado: string; intentos_restantes: number; archivos: string[] | null };
  switch (fila.resultado) {
    case "codigo_incorrecto":
      return {
        errores: {
          codigo: `El código no es correcto. Te ${fila.intentos_restantes === 1 ? "queda 1 intento" : `quedan ${fila.intentos_restantes} intentos`}.`,
        },
      };
    case "bloqueada":
      return { error: "Superaste los 3 intentos. Pide un código nuevo.", reiniciar: true };
    case "vencida":
      return { error: "El código venció. Pide uno nuevo.", reiniciar: true };
    case "ok":
      break;
    default:
      return { error: "Este pedido ya no es válido. Pide un código nuevo.", reiniciar: true };
  }

  // Ya quedó anonimizado en la base. Falta borrar fotos/comprobantes de Storage y el usuario de Auth.
  let completo = true;
  for (const [bucket, rutas] of agruparPorBucket(fila.archivos ?? [])) {
    const { error: errorBorrado } = await servicio.storage.from(bucket).remove(rutas);
    if (errorBorrado) {
      completo = false;
      registrar("error", { evento: "eliminacion_storage_fallo", bucket, mensaje: errorBorrado.message });
    }
  }
  const { error: errorAuth } = await servicio.auth.admin.deleteUser(asociadoId);
  // «No existe» cuenta como hecho (un reintento después de un borrado a medias).
  if (errorAuth && errorAuth.status !== 404 && errorAuth.code !== "user_not_found") {
    completo = false;
    registrar("error", { evento: "eliminacion_auth_fallo", estado: errorAuth.status, codigo: errorAuth.code });
  }

  // Sin revalidatePath a propósito: en una Server Action refrescaría la ficha abierta y el diálogo
  // (con el resultado o el «Reintentar») se desmontaría. Las páginas de /admin son dinámicas: al
  // volver a la lista o a la ficha se leen de nuevo.
  if (!completo) {
    return {
      error:
        "Los datos del asociado ya quedaron anónimos, pero no pudimos borrar todos sus archivos o su acceso. Presiona «Reintentar» para terminar.",
      limpiezaPendiente: true,
    };
  }
  await servicio.rpc("admin_cerrar_limpieza_eliminacion", { p_admin_id: userId, p_solicitud_id: solicitudId });
  registrar("info", { evento: "asociado_eliminado", asociado_id: asociadoId, admin_id: userId });
  return { mensaje: "Asociado eliminado definitivamente." };
}
