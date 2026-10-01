"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarIngresoAceptado } from "@/lib/correo/ingreso";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { datosPerfilDeAfiliacion } from "@/lib/admin/afiliacion";
import {
  esquemaAprobarAfiliacion,
  esquemaAsignarAsesor,
  esquemaCambiarEstadoAfiliacion,
} from "@/lib/validaciones/admin";

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
 * «Aprobar»: crea la cuenta del asociado en Supabase Auth con el CORREO
 * PERSONAL (`solicitudes_afiliacion.email`: el código de ingreso queda
 * anclado a ese correo, spec-requerimientos-ricardo §2.8), copia al perfil
 * cédula, grado, institución, correo institucional, cuenta de nómina y
 * asesor (§2.12, lib/admin/afiliacion.ts), marca la solicitud como aprobada
 * y envía «Ingreso aceptado» al personal y, si existe, al institucional.
 * Idempotente: si ya estaba aprobada, o si ya existe un perfil con esa
 * cédula, no crea un segundo usuario ni reenvía el correo.
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
    .select(
      "id, nombre, cedula, grado, institucion, email, correo_institucional, nomina_entidad, nomina_tipo, nomina_numero, celular, asesor_id, estado",
    )
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
  let avisoAsesor: string | null = null;
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
    // Además pasan institución, correo institucional, nómina y asesor (§2.12).
    const datosPerfil = datosPerfilDeAfiliacion(solicitud);
    let { error: errorPerfil } = await admin.from("perfiles").update(datosPerfil).eq("id", perfilId);
    // El asesor elegido pudo dejar de atender asociados desde que se envió la
    // solicitud (trigger validar_perfil_asesor_id): no se bloquea la
    // aprobación; se guarda el resto y se avisa para asignarlo desde la ficha.
    if (errorPerfil?.message?.includes("rol asesor") && datosPerfil.asesor_id) {
      const sinAsesor = { ...datosPerfil };
      delete sinAsesor.asesor_id;
      ({ error: errorPerfil } = await admin.from("perfiles").update(sinAsesor).eq("id", perfilId));
      avisoAsesor = " El asesor elegido ya no atiende asociados: asígnalo desde la ficha.";
    }
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
    // El aviso institucional sale siempre que haya correo institucional (no depende de la plantilla).
    await avisarCorreoInstitucional(solicitud.email, solicitud.correo_institucional);
    await enviarIngresoAceptado({
      id,
      nombre: solicitud.nombre,
      cedula: solicitud.cedula,
      // RS-02: con la cédula, SOLO al personal (el de Auth).
      correo: destinatariosAviso(solicitud.email),
      urlIngreso: await urlIngreso(),
    });
  }

  revalidatePath("/admin/afiliaciones");
  revalidatePath(`/admin/afiliaciones/${id}`);
  const mensaje = cuentaNueva ? "Solicitud aprobada: se creó la cuenta y se envió el correo." : "Solicitud aprobada.";
  return { mensaje: avisoAsesor ? `${mensaje}${avisoAsesor}` : mensaje };
}

/**
 * «Asignar asesor» (P-96): solo debe verse en la UI cuando la afiliación ya
 * está aprobada y el perfil del asociado todavía no tiene asesor, pero eso es
 * solo la condición para MOSTRAR el botón; aquí se vuelve a comprobar todo en
 * el servidor por si el formulario llega con datos viejos (otra pestaña,
 * doble clic, etc.). No hay opción de cambiar ni quitar un asesor ya
 * asignado (fuera de alcance de P-96).
 *
 * Cédula como puente: `aprobarAfiliacion` ya crea el perfil del asociado con
 * la misma cédula de la solicitud (arriba, `admin.from("perfiles").update({
 * cedula: solicitud.cedula, ... })`), así que el perfil se busca por ahí.
 *
 * Sin service role: la política "perfiles_update" (RLS) ya deja que un admin
 * (es_admin()) actualice cualquier perfil, y el trigger
 * `proteger_campos_perfil` ya deja pasar el cambio de `asesor_id` cuando
 * quien edita tiene rol admin — ver
 * supabase/migrations/20260924000100_perfiles_asesor_id.sql. No hizo falta
 * ninguna migración nueva para esto.
 *
 * Carrera: el `update` solo afecta la fila si `asesor_id` sigue siendo null
 * en ese instante (`.is("asesor_id", null)`); si otro admin ya lo asignó
 * entre el select y el update, `maybeSingle()` devuelve null y se avisa en
 * vez de sobrescribir en silencio.
 */
export async function asignarAsesor(
  _previo: EstadoAccionAfiliacion,
  formData: FormData,
): Promise<EstadoAccionAfiliacion> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaAsignarAsesor.safeParse({
    id: formData.get("id"),
    asesorId: formData.get("asesorId"),
  });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { id, asesorId } = resultado.data;
  // RS-17: un admin no se asigna clientes a sí mismo (la base también lo exige).
  if (asesorId === userId) return { error: "Otro administrador debe asignar tus clientes." };

  const { data: solicitud, error: errorConsulta } = await supabase
    .from("solicitudes_afiliacion")
    .select("id, cedula, estado")
    .eq("id", id)
    .single();
  if (errorConsulta || !solicitud) {
    return { error: "No encontramos la solicitud." };
  }
  if (solicitud.estado !== "aprobada") {
    return { error: "Solo se puede asignar un asesor a una afiliación aprobada." };
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("id, asesor_id")
    .eq("cedula", solicitud.cedula)
    .maybeSingle();
  if (errorPerfil || !perfil) {
    return { error: "No encontramos la cuenta del asociado." };
  }
  if (perfil.asesor_id) {
    return { error: "Este asociado ya tiene un asesor asignado." };
  }

  const { data: actualizado, error: errorUpdate } = await supabase
    .from("perfiles")
    .update({ asesor_id: asesorId })
    .eq("id", perfil.id)
    .is("asesor_id", null)
    .select("id")
    .maybeSingle();

  if (errorUpdate) {
    // El trigger validar_perfil_asesor_id lanza este mensaje si el id
    // elegido no tiene rol asesor (o, en teoría, si apuntara a sí mismo).
    // RS-17: la base impide que un admin se asigne (o se quite) clientes a sí mismo.
    if (errorUpdate.message?.includes("Otro administrador debe asignar tus clientes")) {
      return { error: "Otro administrador debe asignar tus clientes." };
    }
    if (errorUpdate.message?.includes("rol asesor")) {
      return { error: "El perfil elegido no tiene rol de asesor." };
    }
    registrar("error", {
      evento: "asignar_asesor_fallo",
      codigo: errorUpdate.code,
      mensaje: errorUpdate.message,
      solicitud_id: id,
    });
    return { error: "No pudimos asignar el asesor. Intenta de nuevo." };
  }
  if (!actualizado) {
    // Perdió la carrera: otro admin lo asignó entre el select y el update.
    return { error: "Este asociado ya tiene un asesor asignado." };
  }

  revalidatePath(`/admin/afiliaciones/${id}`);
  return { mensaje: "Asesor asignado." };
}
