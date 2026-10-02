import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarCelularColombiano } from "@/lib/admin/whatsapp";
import { formatearFecha } from "@/lib/cuenta";
import { ETIQUETA_ALERTA, type TipoAlertaAsociado } from "@/lib/alertasAsociado";
import { contarRecuperacionesPendientes } from "@/lib/admin/recuperaciones";
import { registrar } from "@/lib/servidor/registro";

/**
 * Bandeja de «Alertas» de /admin (retiro anticipado y renovación;
 * spec-requerimientos-ricardo §6, pieza 3m). Con la sesión del admin (RLS:
 * alertas_select deja ver todas al admin).
 */

function whatsappSinMensaje(celular: string | null | undefined) {
  const numero = normalizarCelularColombiano(celular);
  return numero ? `https://wa.me/${numero}` : null;
}

export type EstadoAlerta = "pendiente" | "atendida";

export type FilaAlertaAdmin = {
  id: string;
  tipo: TipoAlertaAsociado;
  tipoTexto: string;
  estado: EstadoAlerta;
  /** «23 sept». */
  creada: string | undefined;
  creadaEl: string;
  atendida: string | undefined;
  atendidaPor: string | null;
  asociado: { id: string; nombre: string; cedula: string; whatsappUrl: string | null };
};

export async function listarAlertas(
  supabase: SupabaseClient,
  estado: EstadoAlerta = "pendiente",
): Promise<{ filas: FilaAlertaAdmin[]; error: boolean }> {
  const { data: alertas, error } = await supabase
    .from("alertas_asociado")
    .select("id, asociado_id, tipo, estado, created_at, atendida_por, atendida_at")
    .eq("estado", estado)
    .order("created_at", { ascending: estado === "pendiente" })
    .limit(200);
  if (error) {
    registrar("error", { evento: "admin_alertas_fallo", codigo: error.code, mensaje: error.message });
    return { filas: [], error: true };
  }

  const ids = [
    ...new Set(
      (alertas ?? []).flatMap((a) => [a.asociado_id as string, a.atendida_por as string | null]).filter(Boolean),
    ),
  ] as string[];
  const { data: perfiles } = ids.length
    ? await supabase.from("perfiles").select("id, nombre_completo, cedula, telefono").in("id", ids)
    : { data: [] };
  const porId = new Map((perfiles ?? []).map((p) => [p.id as string, p]));

  return {
    error: false,
    filas: (alertas ?? []).map((a) => {
      const perfil = porId.get(a.asociado_id as string);
      const nombre = (perfil?.nombre_completo as string | undefined) ?? "Asociado";
      const tipo = a.tipo as TipoAlertaAsociado;
      return {
        id: a.id as string,
        tipo,
        tipoTexto: ETIQUETA_ALERTA[tipo] ?? String(a.tipo),
        estado: a.estado as EstadoAlerta,
        creada: formatearFecha(a.created_at as string),
        creadaEl: a.created_at as string,
        atendida: formatearFecha(a.atendida_at as string | null),
        atendidaPor: a.atendida_por
          ? ((porId.get(a.atendida_por as string)?.nombre_completo as string | undefined) ?? null)
          : null,
        asociado: {
          id: a.asociado_id as string,
          nombre,
          cedula: (perfil?.cedula as string | undefined) ?? "",
          // Sin mensaje prellenado: el texto para este caso no está definido en el diseño.
          whatsappUrl: whatsappSinMensaje(perfil?.telefono as string | null),
        },
      };
    }),
  };
}

/** Número para la insignia del menú («Alertas 3»). */
export async function contarAlertasPendientes(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("alertas_asociado")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if (error) {
    registrar("error", { evento: "admin_alertas_conteo_fallo", codigo: error.code, mensaje: error.message });
    return 0;
  }
  // Las solicitudes de recuperación de acceso viven en la misma bandeja.
  return (count ?? 0) + (await contarRecuperacionesPendientes(supabase));
}
