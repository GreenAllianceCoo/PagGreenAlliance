import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatearFecha } from "@/lib/cuenta";
import { formatearFechaLarga } from "@/lib/fechas";
import { esEstadoProceso, ETIQUETA_ESTADO_PROCESO, type EstadoProceso } from "@/lib/procesoEjecutivo";
import { registrar } from "@/lib/servidor/registro";
import { nombreInstitucion } from "@/lib/validaciones/instituciones";

/**
 * Loaders de la sección «Asociados» de /admin (spec-requerimientos-ricardo §6,
 * pieza 3m). Reciben el cliente de `exigirAdmin()` (RLS con la sesión del
 * admin: procesos_ejecutivos e historial solo los lee el admin).
 * `procesos_ejecutivos` tiene dos FK a perfiles (asociado_id y
 * actualizado_por), así que no se embebe: se hacen consultas separadas.
 */

export type FilaAsociadoAdmin = {
  id: string;
  nombre: string;
  cedula: string;
  grado: string | null;
  institucion: string | null;
  activo: boolean;
  estadoProceso: EstadoProceso | null;
  /** «Operando» o «Sin iniciar». */
  estadoProcesoTexto: string;
  fechaInicioEmbargo: string | null;
};

/** Lista de asociados (rol asociado) con el estado de su proceso. */
export async function listarAsociadosConProceso(
  supabase: SupabaseClient,
): Promise<{ filas: FilaAsociadoAdmin[]; error: boolean }> {
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, cedula, grado, institucion, activo")
    .eq("rol", "asociado")
    .order("nombre_completo");
  if (error) {
    registrar("error", { evento: "admin_asociados_fallo", codigo: error.code, mensaje: error.message });
    return { filas: [], error: true };
  }
  const ids = (perfiles ?? []).map((p) => p.id as string);
  const { data: procesos } = ids.length
    ? await supabase.from("procesos_ejecutivos").select("asociado_id, estado, fecha_inicio_embargo").in("asociado_id", ids)
    : { data: [] };
  const porId = new Map((procesos ?? []).map((p) => [p.asociado_id as string, p]));

  return {
    error: false,
    filas: (perfiles ?? []).map((p) => {
      const proceso = porId.get(p.id as string);
      const estado = esEstadoProceso(proceso?.estado) ? proceso.estado : null;
      return {
        id: p.id as string,
        nombre: p.nombre_completo as string,
        cedula: p.cedula as string,
        grado: (p.grado as string | null) ?? null,
        institucion: nombreInstitucion(p.institucion),
        activo: p.activo !== false,
        estadoProceso: estado,
        estadoProcesoTexto: estado ? ETIQUETA_ESTADO_PROCESO[estado] : "Sin iniciar",
        fechaInicioEmbargo: (proceso?.fecha_inicio_embargo as string | null) ?? null,
      };
    }),
  };
}

export type CambioProceso = {
  id: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  fechaInicioEmbargoTexto: string | null;
  adminNombre: string | null;
  /** «23 sept» (hora de Colombia). */
  cuando: string | undefined;
  creadoEl: string;
};

export type DetalleProcesoAsociado = {
  asociado: {
    id: string;
    nombre: string;
    cedula: string;
    grado: string | null;
    institucion: string | null;
    /** Asesor del asociado (RS-01: si es el admin en sesión, no puede cambiar el proceso). */
    asesorId: string | null;
    /** §12.6: false = dado de baja. */
    activo: boolean;
  };
  estado: EstadoProceso | null;
  fechaInicioEmbargo: string | null;
  historial: CambioProceso[];
};

/** Detalle del proceso de un asociado + historial (más reciente primero). null si no existe. */
export async function cargarDetalleProceso(
  supabase: SupabaseClient,
  asociadoId: string,
): Promise<DetalleProcesoAsociado | null> {
  const [{ data: perfil }, { data: proceso }, { data: historial }] = await Promise.all([
    supabase.from("perfiles").select("id, nombre_completo, cedula, grado, institucion, asesor_id, activo").eq("id", asociadoId).maybeSingle(),
    supabase.from("procesos_ejecutivos").select("estado, fecha_inicio_embargo").eq("asociado_id", asociadoId).maybeSingle(),
    supabase
      .from("historial_proceso_ejecutivo")
      .select("id, estado_anterior, estado_nuevo, fecha_inicio_embargo, admin_id, created_at")
      .eq("asociado_id", asociadoId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (!perfil) return null;

  const adminIds = [...new Set((historial ?? []).map((h) => h.admin_id as string | null).filter(Boolean))] as string[];
  const { data: admins } = adminIds.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", adminIds)
    : { data: [] };
  const nombreAdmin = new Map((admins ?? []).map((a) => [a.id as string, a.nombre_completo as string]));

  const etiqueta = (valor: unknown) => (esEstadoProceso(valor) ? ETIQUETA_ESTADO_PROCESO[valor] : null);

  return {
    asociado: {
      id: perfil.id as string,
      nombre: perfil.nombre_completo as string,
      cedula: perfil.cedula as string,
      grado: (perfil.grado as string | null) ?? null,
      institucion: nombreInstitucion(perfil.institucion),
      asesorId: (perfil.asesor_id as string | null) ?? null,
      activo: perfil.activo !== false,
    },
    estado: esEstadoProceso(proceso?.estado) ? proceso.estado : null,
    fechaInicioEmbargo: (proceso?.fecha_inicio_embargo as string | null) ?? null,
    historial: (historial ?? []).map((h) => ({
      id: Number(h.id),
      estadoAnterior: etiqueta(h.estado_anterior),
      estadoNuevo: etiqueta(h.estado_nuevo) ?? String(h.estado_nuevo),
      fechaInicioEmbargoTexto: h.fecha_inicio_embargo ? formatearFechaLarga(h.fecha_inicio_embargo as string) : null,
      adminNombre: h.admin_id ? (nombreAdmin.get(h.admin_id as string) ?? null) : null,
      cuando: formatearFecha(h.created_at as string),
      creadoEl: h.created_at as string,
    })),
  };
}
