"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarDesembolsoCredito, enviarResultadoCredito } from "@/lib/correo/credito";
import { formatearFechaLarga } from "@/lib/fechas";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { esquemaMarcarDesembolso, esquemaResolverCredito } from "@/lib/validaciones/admin";

export type EstadoAccionCredito = { error?: string; mensaje?: string };

/**
 * «Aprobar» / «Rechazar» de /admin/creditos. La base es la última barrera
 * real (trigger sellar_revision_solicitud): nadie resuelve su propia
 * solicitud y una ya resuelta no cambia; aquí solo se traduce el error de
 * Postgres a un mensaje genérico.
 */
export async function resolverCredito(
  _previo: EstadoAccionCredito,
  formData: FormData,
): Promise<EstadoAccionCredito> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaResolverCredito.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
    motivo: formData.get("motivo") ?? undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const datos = resultado.data;

  const { data: solicitud, error: errorConsulta } = await supabase
    .from("solicitudes_credito")
    .select("id, estado, asociado_id, monto_solicitado")
    .eq("id", datos.id)
    .single();
  if (errorConsulta || !solicitud) {
    return { error: "No encontramos la solicitud." };
  }
  if (solicitud.estado !== "pendiente") {
    return { error: "Esta solicitud ya fue resuelta." };
  }
  if (solicitud.asociado_id === userId) {
    return { error: "No puedes resolver tu propia solicitud; debe hacerlo otro administrador." };
  }

  const cambios =
    datos.decision === "aprobado"
      ? { estado: "aprobado" as const, motivo_rechazo: null }
      : { estado: "rechazado" as const, motivo_rechazo: datos.motivo };

  // S-11 (revisión de seguridad 2026-09-24): el `select` de arriba ya
  // comprobó `estado === 'pendiente'`, pero entre ese select y este update
  // otro admin podría haberla resuelto (carrera). El trigger
  // sellar_revision_solicitud también lo bloquea, pero aquí se filtra
  // ADEMÁS por estado en el propio update: si otra transacción ganó la
  // carrera, este update afecta 0 filas (`.select()` lo confirma) y no se
  // manda el correo de un resultado que ya se había resuelto distinto.
  const { data: actualizada, error } = await supabase
    .from("solicitudes_credito")
    .update(cambios)
    .eq("id", datos.id)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();
  if (error) {
    // No exponemos el texto de Postgres (puede traer montos o nombres de constraint).
    registrar("error", { evento: "credito_resolver_fallo", codigo: error.code, mensaje: error.message, solicitud_id: datos.id });
    return { error: "No pudimos guardar la decisión. Intenta de nuevo." };
  }
  if (!actualizada) {
    return { error: "Esta solicitud ya fue resuelta." };
  }

  // Correo del resultado (lib/correo/credito.ts, ya existente): busca nombre y
  // correo del asociado y no bloquea la respuesta si Resend falla.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, cedula, correo_institucional")
    .eq("id", solicitud.asociado_id)
    .single();
  if (perfil) {
    // RS-02: montos y motivo SOLO al correo personal (Auth); al institucional,
    // un aviso genérico sin datos.
    const correoPersonal = await correoDeCedula(perfil.cedula);
    const correo = destinatariosAviso(correoPersonal);
    await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
    if (correo.length > 0) {
      await enviarResultadoCredito({
        id: datos.id,
        nombre: perfil.nombre_completo,
        correo,
        resultado: datos.decision,
        monto: Number(solicitud.monto_solicitado),
        motivo: datos.decision === "rechazado" ? datos.motivo : undefined,
      });
    }
  }

  revalidatePath("/admin/creditos");
  return { mensaje: datos.decision === "aprobado" ? "Crédito aprobado." : "Crédito rechazado." };
}

/** Textos de admin_marcar_desembolsado() listos para mostrar (los demás errores se ocultan). */
const MENSAJES_DESEMBOLSO = [
  "Solo un crédito aprobado se puede marcar como desembolsado",
  "Este crédito ya fue marcado como desembolsado",
  "La fecha de desembolso no puede ser futura",
  "La fecha de desembolso no puede ser anterior a la aprobación",
  "No puede marcar el desembolso de su propio crédito; debe hacerlo otro administrador",
  "La solicitud no existe",
];

/**
 * «Marcar desembolsado» de /admin/creditos (spec §12.2). Solo el admin, por la
 * RPC `admin_marcar_desembolsado` (la base valida estado, fecha y que no sea
 * el propio crédito, y deja el historial). Sin fecha = hoy en Colombia. Después
 * avisa: correo con el monto al personal y aviso sin datos al institucional.
 * Campos del formulario: `id` y `fecha` (opcional, AAAA-MM-DD).
 */
export async function marcarDesembolsado(
  _previo: EstadoAccionCredito,
  formData: FormData,
): Promise<EstadoAccionCredito> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaMarcarDesembolso.safeParse({
    id: formData.get("id"),
    fecha: formData.get("fecha") ?? undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const datos = resultado.data;

  const { data, error } = await supabase
    .rpc("admin_marcar_desembolsado", { p_solicitud_id: datos.id, p_fecha: datos.fecha ?? null })
    .maybeSingle();
  if (error || !data) {
    const conocido = MENSAJES_DESEMBOLSO.find((m) => error?.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "credito_desembolso_fallo", codigo: error?.code, mensaje: error?.message, solicitud_id: datos.id });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos marcar el desembolso. Intenta de nuevo." };
  }
  const fecha = String((data as { fecha_desembolso: string }).fecha_desembolso).slice(0, 10);

  // Aviso al asociado (no bloquea la respuesta si algo falla).
  const { data: solicitud } = await supabase
    .from("solicitudes_credito")
    .select("asociado_id, monto_solicitado")
    .eq("id", datos.id)
    .single();
  if (solicitud) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_completo, cedula, correo_institucional")
      .eq("id", solicitud.asociado_id)
      .single();
    if (perfil) {
      const correoPersonal = await correoDeCedula(perfil.cedula);
      const correo = destinatariosAviso(correoPersonal);
      await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
      if (correo.length > 0) {
        await enviarDesembolsoCredito({
          id: datos.id,
          nombre: perfil.nombre_completo,
          correo,
          monto: Number(solicitud.monto_solicitado),
          fecha,
          fechaTexto: formatearFechaLarga(fecha),
        });
      }
    }
  }

  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  return { mensaje: "Desembolso registrado." };
}
