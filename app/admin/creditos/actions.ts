"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { enviarResultadoCredito } from "@/lib/correo/credito";
import { esquemaResolverCredito } from "@/lib/validaciones/admin";

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
    .select("nombre_completo, cedula")
    .eq("id", solicitud.asociado_id)
    .single();
  if (perfil) {
    const correo = await correoDeCedula(perfil.cedula);
    if (correo) {
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
