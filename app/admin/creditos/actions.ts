"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarDesembolsoCredito, enviarResultadoCredito } from "@/lib/correo/credito";
import { formatearFechaLarga } from "@/lib/fechas";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { textoDe } from "@/lib/validaciones/comunes";
import { esquemaMarcarDesembolso, esquemaResolverCredito } from "@/lib/validaciones/admin";
import { crearSubidaComprobante, firmarComprobante, registrarComprobanteSubido, rutaDeComprobante } from "@/lib/admin/comprobantes";
import { esquemaPrepararComprobante, esquemaRegistrarComprobante, esquemaVerComprobante } from "@/lib/validaciones/comprobante";

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
  revalidatePath("/cuenta"); // el asociado ve el estado nuevo en su pantalla
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
  // Comprobante opcional (se recomienda): el navegador ya lo subió a Storage con una
  // URL firmada y solo manda la ruta; se verifica más abajo, DESPUÉS de marcar el desembolso.
  const rutaComprobante = textoDe(formData, "comprobanteRuta");

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

  // Comprobante: si falla, el desembolso YA quedó marcado; se avisa para que lo suba de nuevo.
  let conComprobante = false;
  let avisoComprobante = "";
  if (rutaComprobante) {
    const guardado = esquemaRegistrarComprobante.safeParse({ solicitudId: datos.id, ruta: rutaComprobante });
    const r = guardado.success ? await registrarComprobanteSubido(supabase, datos.id, guardado.data.ruta) : null;
    if (r?.ok) conComprobante = true;
    else avisoComprobante = " El comprobante no se guardó; súbelo de nuevo desde este crédito.";
  }

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
          conComprobante,
        });
      }
    }
  }

  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  return { mensaje: conComprobante ? "Desembolso registrado con su comprobante." : `Desembolso registrado.${avisoComprobante}` };
}

// ---------------------------------------------------------------------------
// Comprobante de desembolso (subir / reemplazar / ver)
// ---------------------------------------------------------------------------

export type RespuestaPrepararComprobante =
  | { ok: true; ruta: string; token: string; bucket: string }
  | { ok: false; error: string };

/**
 * Paso 1 de la subida: URL firmada para que el navegador suba el archivo directo
 * a Storage. Solo admin; valida tipo y tamaño (el bucket los vuelve a exigir).
 */
export async function prepararSubidaComprobante(entrada: {
  solicitudId: string;
  tipo: string;
  tamano: number;
}): Promise<RespuestaPrepararComprobante> {
  await exigirAdmin();
  const r = esquemaPrepararComprobante.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const subida = await crearSubidaComprobante(r.data.solicitudId, r.data.tipo);
  if (!subida) return { ok: false, error: "No pudimos preparar la subida. Intenta de nuevo." };
  return { ok: true, ...subida };
}

/**
 * Paso 2 (crédito ya desembolsado): liga el archivo subido a la solicitud. Sirve para
 * subir el comprobante por primera vez o reemplazarlo; la base deja el historial.
 */
export async function guardarComprobanteDesembolso(entrada: {
  solicitudId: string;
  ruta: string;
}): Promise<EstadoAccionCredito> {
  const { supabase } = await exigirAdmin();
  const r = esquemaRegistrarComprobante.safeParse(entrada);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const resultado = await registrarComprobanteSubido(supabase, r.data.solicitudId, r.data.ruta);
  if (!resultado.ok) return { error: resultado.error };
  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  return { mensaje: "Comprobante guardado." };
}

/** «Ver comprobante» del admin: URL firmada de 3 minutos. */
export async function urlComprobanteAdmin(entrada: { solicitudId: string }): Promise<{ url?: string; error?: string }> {
  await exigirAdmin();
  const r = esquemaVerComprobante.safeParse(entrada);
  if (!r.success) return { error: "No encontramos la solicitud." };
  const ruta = await rutaDeComprobante(r.data.solicitudId);
  if (!ruta) return { error: "Este crédito no tiene comprobante." };
  const url = await firmarComprobante(ruta);
  return url ? { url } : { error: "No pudimos abrir el comprobante. Intenta de nuevo." };
}
