import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarCelularColombiano } from "@/lib/admin/whatsapp";
import { formatearFecha } from "@/lib/cuenta";
import { registrar } from "@/lib/servidor/registro";

/**
 * Solicitudes de recuperación de acceso (/ingresar/recuperar) para el admin.
 * Reciben el cliente de `exigirAdmin()`: RLS deja leer estas tablas solo al
 * admin (solicitudes_recuperacion_acceso, historial_cambio_correo_ingreso).
 */

export type EstadoRecuperacion = "pendiente" | "atendida" | "rechazada";

export type FilaRecuperacion = {
  id: string;
  perfilId: string;
  nombre: string;
  cedula: string;
  correoNuevo: string;
  celular: string;
  celularCoincide: boolean;
  motivo: string;
  estado: EstadoRecuperacion;
  creada: string | undefined;
  resuelta: string | undefined;
  resueltaPor: string | null;
  motivoResolucion: string | null;
  /** WhatsApp al celular del PERFIL (nunca al que escribió quien pide: SEC-REC-01). */
  whatsappUrl: string | null;
  /** RS-01: el admin en sesión atiende a esta persona (otro admin debe cambiarle el correo). */
  bloqueado: boolean;
};

const COLUMNAS =
  "id, perfil_id, cedula, correo_nuevo, celular, celular_coincide, motivo, estado, created_at, resuelta_por, resuelta_at, motivo_resolucion";

type FilaBase = {
  id: string;
  perfil_id: string;
  cedula: string;
  correo_nuevo: string;
  celular: string;
  celular_coincide: boolean;
  motivo: string;
  estado: EstadoRecuperacion;
  created_at: string;
  resuelta_por: string | null;
  resuelta_at: string | null;
  motivo_resolucion: string | null;
};

async function armarFilas(supabase: SupabaseClient, base: FilaBase[], adminId: string): Promise<FilaRecuperacion[]> {
  const ids = [...new Set(base.flatMap((s) => [s.perfil_id, s.resuelta_por]).filter(Boolean))] as string[];
  const { data: perfiles } = ids.length
    ? await supabase.from("perfiles").select("id, nombre_completo, asesor_id, telefono").in("id", ids)
    : { data: [] };
  const porId = new Map((perfiles ?? []).map((p) => [p.id as string, p]));
  return base.map((s) => {
    const perfil = porId.get(s.perfil_id);
    // SEC-REC-01: el contacto es el celular que la cooperativa ya tenía, no el que escribió quien pide.
    const numero = normalizarCelularColombiano(perfil?.telefono as string | null | undefined);
    return {
      id: s.id,
      perfilId: s.perfil_id,
      nombre: (perfil?.nombre_completo as string | undefined) ?? "Asociado",
      cedula: s.cedula,
      correoNuevo: s.correo_nuevo,
      celular: s.celular,
      celularCoincide: s.celular_coincide,
      motivo: s.motivo,
      estado: s.estado,
      creada: formatearFecha(s.created_at),
      resuelta: formatearFecha(s.resuelta_at),
      resueltaPor: s.resuelta_por
        ? ((porId.get(s.resuelta_por)?.nombre_completo as string | undefined) ?? null)
        : null,
      motivoResolucion: s.motivo_resolucion,
      whatsappUrl: numero ? `https://wa.me/${numero}` : null,
      bloqueado: (perfil?.asesor_id as string | null | undefined) === adminId || s.perfil_id === adminId,
    };
  });
}

/** Bandeja de recuperaciones (pendientes primero las más antiguas; resueltas, las más recientes). */
export async function listarRecuperaciones(
  supabase: SupabaseClient,
  adminId: string,
  estado: "pendiente" | "resueltas" = "pendiente",
): Promise<{ filas: FilaRecuperacion[]; error: boolean }> {
  const consulta = supabase.from("solicitudes_recuperacion_acceso").select(COLUMNAS);
  const { data, error } = await (estado === "pendiente"
    ? consulta.eq("estado", "pendiente").order("created_at", { ascending: true })
    : consulta.neq("estado", "pendiente").order("created_at", { ascending: false })
  ).limit(200);
  if (error) {
    registrar("error", { evento: "admin_recuperaciones_fallo", codigo: error.code, mensaje: error.message });
    return { filas: [], error: true };
  }
  return { filas: await armarFilas(supabase, (data ?? []) as FilaBase[], adminId), error: false };
}

/** Pendientes (para la insignia «Alertas» del menú). */
export async function contarRecuperacionesPendientes(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("solicitudes_recuperacion_acceso")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if (error) {
    registrar("error", { evento: "admin_recuperaciones_conteo_fallo", codigo: error.code, mensaje: error.message });
    return 0;
  }
  return count ?? 0;
}

export type CambioCorreoHistorial = {
  id: string;
  origen: "admin" | "asociado";
  actor: string | null;
  motivo: string;
  cuando: string | undefined;
};

/** Para la ficha del asociado: solicitud pendiente (si hay) e historial de cambios del correo. */
export async function cargarCorreoIngresoAsociado(
  supabase: SupabaseClient,
  asociadoId: string,
  adminId: string,
): Promise<{ pendiente: FilaRecuperacion | null; historial: CambioCorreoHistorial[] }> {
  const [{ data: pend }, { data: hist }] = await Promise.all([
    supabase
      .from("solicitudes_recuperacion_acceso")
      .select(COLUMNAS)
      .eq("perfil_id", asociadoId)
      .eq("estado", "pendiente")
      .maybeSingle(),
    supabase
      .from("historial_cambio_correo_ingreso")
      .select("id, origen, actor_id, motivo, created_at")
      .eq("perfil_id", asociadoId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const actores = [...new Set((hist ?? []).map((h) => h.actor_id as string | null).filter(Boolean))] as string[];
  const { data: perfiles } = actores.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", actores)
    : { data: [] };
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, p.nombre_completo as string]));
  return {
    pendiente: pend ? (await armarFilas(supabase, [pend as FilaBase], adminId))[0] : null,
    historial: (hist ?? []).map((h) => ({
      id: h.id as string,
      origen: h.origen as "admin" | "asociado",
      actor: h.actor_id ? (nombre.get(h.actor_id as string) ?? null) : null,
      motivo: h.motivo as string,
      cuando: formatearFecha(h.created_at as string),
    })),
  };
}
