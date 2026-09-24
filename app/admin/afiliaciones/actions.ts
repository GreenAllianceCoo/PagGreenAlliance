"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarPlantillaResend } from "@/lib/correo/resend";
import { esquemaAprobarAfiliacion, esquemaCambiarEstadoAfiliacion } from "@/lib/validaciones/admin";

export type EstadoAccionAfiliacion = { error?: string; mensaje?: string };

/**
 * «Contactado» / «Rechazar»: la base solo tiene una columna `estado` en
 * solicitudes_afiliacion (sin `motivo_rechazo`), así que aquí solo se cambia
 * el estado. Si la cooperativa pide guardar el motivo, hace falta una
 * migración nueva (no es zona de este agente; queda en el reporte).
 */
export async function cambiarEstadoAfiliacion(
  _previo: EstadoAccionAfiliacion,
  formData: FormData,
): Promise<EstadoAccionAfiliacion> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaCambiarEstadoAfiliacion.safeParse({
    id: formData.get("id"),
    estado: formData.get("estado"),
  });
  if (!resultado.success) return { error: "Datos inválidos." };

  const { id, estado } = resultado.data;
  const { error } = await supabase.from("solicitudes_afiliacion").update({ estado }).eq("id", id);
  if (error) {
    registrar("error", { evento: "afiliacion_cambiar_estado_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  revalidatePath("/admin/afiliaciones");
  revalidatePath(`/admin/afiliaciones/${id}`);
  return { mensaje: `Estado actualizado a «${estado}».` };
}

/**
 * URL absoluta de /ingresar para el correo «Ingreso aceptado».
 * S-12 (revisión de seguridad 2026-09-24): antes salía siempre del encabezado
 * `host` de la petición, que en teoría se puede falsificar (Host header
 * injection) si algún día esto queda detrás de un proxy que no lo limpie.
 * Ahora sale de SITIO_URL (variable de servidor, .env.example) y el host de
 * la petición queda solo como respaldo para desarrollo local, donde SITIO_URL
 * normalmente no está configurada.
 */
async function urlIngreso() {
  const sitio = process.env.SITIO_URL?.trim();
  if (sitio) return `${sitio.replace(/\/+$/, "")}/ingresar`;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/ingresar`;
}

/**
 * «Aprobar»: crea la cuenta del asociado en Supabase Auth (handle_new_user
 * arma el perfil con cédula y grado desde app_metadata; se completa el
 * asesor y el teléfono), marca la solicitud como aprobada y envía el correo
 * «Ingreso aceptado». Idempotente: si ya estaba aprobada, o si ya existe un
 * perfil con esa cédula, no crea un segundo usuario ni reenvía el correo.
 */
export async function aprobarAfiliacion(
  _previo: EstadoAccionAfiliacion,
  formData: FormData,
): Promise<EstadoAccionAfiliacion> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaAprobarAfiliacion.safeParse({ id: formData.get("id") });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { id } = resultado.data;

  const { data: solicitud, error: errorConsulta } = await supabase
    .from("solicitudes_afiliacion")
    .select("id, nombre, cedula, grado, email, celular, asesor_id, estado")
    .eq("id", id)
    .single();

  if (errorConsulta || !solicitud) {
    return { error: "No encontramos la solicitud." };
  }

  // Idempotente: ya se había aprobado (y, por lo tanto, ya se creó la cuenta).
  if (solicitud.estado === "aprobada") {
    return { mensaje: "Esta solicitud ya estaba aprobada." };
  }

  const admin = crearClienteAdmin();

  // Defensa extra por si el estado no quedó sincronizado: no duplicar la cuenta.
  const { data: perfilExistente } = await admin
    .from("perfiles")
    .select("id")
    .eq("cedula", solicitud.cedula)
    .maybeSingle();

  let cuentaNueva = false;
  let perfilId = perfilExistente?.id as string | undefined;

  if (!perfilId) {
    const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
      email: solicitud.email,
      email_confirm: true,
      app_metadata: { cedula: solicitud.cedula, grado: solicitud.grado },
      user_metadata: { nombre_completo: solicitud.nombre, telefono: solicitud.celular },
    });
    if (errorCrear || !creado?.user) {
      registrar("error", {
        evento: "afiliacion_aprobar_crear_usuario_fallo",
        mensaje: errorCrear?.message,
        solicitud_id: id,
      });
      return { error: "No pudimos crear la cuenta del asociado. Intenta de nuevo." };
    }
    perfilId = creado.user.id;
    cuentaNueva = true;

    // GoTrue guarda app_metadata DESPUÉS del insert en auth.users, así que
    // handle_new_user no alcanza a ver cédula ni grado (el perfil queda con
    // «PENDIENTE-…» y grado null). Se fijan aquí; sin la cédula no puede ingresar.
    const { error: errorPerfil } = await admin
      .from("perfiles")
      .update({
        cedula: solicitud.cedula,
        grado: solicitud.grado,
        ...(solicitud.asesor_id ? { asesor_id: solicitud.asesor_id } : {}),
      })
      .eq("id", perfilId);
    if (errorPerfil) {
      registrar("error", { evento: "afiliacion_aprobar_perfil_fallo", mensaje: errorPerfil.message, solicitud_id: id });
      return { error: "Creamos la cuenta, pero no pudimos completar su perfil (cédula y grado). Avisa al equipo técnico." };
    }
  }

  const { error: errorEstado } = await supabase
    .from("solicitudes_afiliacion")
    .update({ estado: "aprobada" })
    .eq("id", id);
  if (errorEstado) {
    registrar("error", { evento: "afiliacion_aprobar_estado_fallo", mensaje: errorEstado.message, solicitud_id: id });
    return { error: "Creamos la cuenta, pero no pudimos marcar la solicitud como aprobada. Avisa al equipo técnico." };
  }

  if (cuentaNueva) {
    const plantilla = process.env.RESEND_TEMPLATE_INGRESO_ACEPTADO;
    if (!plantilla) {
      registrar("error", { evento: "ingreso_aceptado_no_enviado", motivo: "falta_plantilla", solicitud_id: id });
    } else {
      try {
        await enviarPlantillaResend({
          para: solicitud.email,
          plantilla,
          variables: { NOMBRE: solicitud.nombre, CEDULA: solicitud.cedula, URL_INGRESO: await urlIngreso() },
        });
      } catch (e) {
        // La cuenta ya quedó creada: el correo no bloquea la aprobación (spec §Afiliaciones).
        registrar("error", {
          evento: "ingreso_aceptado_correo_fallo",
          mensaje: e instanceof Error ? e.message : String(e),
          solicitud_id: id,
        });
      }
    }
  }

  revalidatePath("/admin/afiliaciones");
  revalidatePath(`/admin/afiliaciones/${id}`);
  return { mensaje: cuentaNueva ? "Solicitud aprobada: se creó la cuenta y se envió el correo." : "Solicitud aprobada." };
}
