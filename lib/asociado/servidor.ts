import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reglaSolicitarCredito, type ReglaSolicitarCredito } from "@/lib/credito";
import { hoyBogota, type FechaISO } from "@/lib/fechas";
import { cupoCreditoDelGrado, type CupoCredito } from "@/lib/grados";
import { MENSAJE_SIN_CUPO } from "@/lib/gradosCatalogo";
import {
  caminoEstabilidad,
  vistaProcesoEjecutivo,
  type FilaMiProceso,
  type VistaProcesoEjecutivo,
} from "@/lib/procesoEjecutivo";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { nombreInstitucion } from "@/lib/validaciones/instituciones";

/**
 * Loader del «Perfil» del asociado en /cuenta (spec-requerimientos-ricardo §3,
 * pieza 3k). Todo con la sesión del usuario (RLS: solo lo suyo), salvo el
 * NOMBRE del asesor: `perfiles` solo deja leer la fila propia, así que ese
 * único dato se lee con service role en el servidor.
 * Nunca incluye la tasa de interés.
 */

export type PerfilAsociado = {
  nombre: string;
  cedula: string;
  telefono: string;
  rol: string | null;
  /** «Teniente» (null si no tiene grado). */
  gradoNombre: string | null;
  gradoCodigo: string | null;
  /** «Policía Nacional» / «Ejército Nacional» (null si el perfil es anterior). */
  institucion: string | null;
  activo: boolean;
  /** Nombre del asesor (null = sin asesor). */
  asesorNombre: string | null;
  proceso: VistaProcesoEjecutivo;
  /** Para la prop existente `caminoEstabilidad` del carné (undefined = no se dibuja). */
  caminoEstabilidad: ReturnType<typeof caminoEstabilidad>;
  cupo: CupoCredito;
  /** Regla de Sebas (§8): activo + proceso «operando» (+ grado con cupo, sin pendiente). */
  credito: ReglaSolicitarCredito;
};

type FilaPerfil = {
  nombre_completo: string | null;
  cedula: string | null;
  grado: string | null;
  telefono: string | null;
  rol: string | null;
  institucion: string | null;
  activo: boolean | null;
  asesor_id: string | null;
};

/** Nombre del asesor del asociado (service role, solo ese campo). */
async function nombreDelAsesor(asesorId: string | null): Promise<string | null> {
  if (!asesorId) return null;
  const { data, error } = await crearClienteAdmin()
    .from("perfiles")
    .select("nombre_completo")
    .eq("id", asesorId)
    .maybeSingle();
  if (error) registrar("error", { evento: "perfil_nombre_asesor_fallo", mensaje: error.message });
  return (data?.nombre_completo as string | undefined) ?? null;
}

/** Proceso ejecutivo del usuario en sesión (0 o 1 fila). */
export async function cargarMiProceso(supabase: SupabaseClient): Promise<FilaMiProceso | null> {
  const { data, error } = await supabase.rpc("mi_proceso_ejecutivo").maybeSingle();
  if (error) {
    registrar("error", { evento: "mi_proceso_ejecutivo_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  return (data as FilaMiProceso | null) ?? null;
}

/**
 * Estado de la regla de crédito para el usuario en sesión (lo usan
 * /cuenta/solicitar y la acción `crearSolicitud`, además de /cuenta).
 */
export async function reglaCreditoDe(
  supabase: SupabaseClient,
  datos: { activo: boolean | null; grado: string | null; tienePendiente: boolean; proceso?: FilaMiProceso | null },
): Promise<{ regla: ReglaSolicitarCredito; cupo: CupoCredito; proceso: FilaMiProceso | null }> {
  const [cupo, proceso] = await Promise.all([
    cupoCreditoDelGrado(supabase, datos.grado),
    datos.proceso !== undefined ? Promise.resolve(datos.proceso) : cargarMiProceso(supabase),
  ]);
  const regla = reglaSolicitarCredito({
    activo: datos.activo,
    tieneGrado: cupo.estado !== "sin_grado",
    tieneCupo: cupo.estado === "con_cupo",
    mensajeSinCupo: cupo.estado === "sin_cupo" ? cupo.mensaje : MENSAJE_SIN_CUPO,
    estadoProceso: proceso?.estado ?? null,
    tienePendiente: datos.tienePendiente,
    cantidadTopes: cupo.estado === "con_cupo" ? cupo.paquetes.length : 0,
  });
  return { regla, cupo, proceso };
}

export async function cargarPerfilAsociado(
  supabase: SupabaseClient,
  userId: string,
  opciones: { tienePendiente: boolean; hoy?: FechaISO },
): Promise<PerfilAsociado | null> {
  const hoy = opciones.hoy ?? hoyBogota();
  const { data, error } = await supabase
    .from("perfiles")
    .select("nombre_completo, cedula, grado, telefono, rol, institucion, activo, asesor_id")
    .eq("id", userId)
    .single();
  if (error || !data) {
    if (error) registrar("error", { evento: "perfil_asociado_fallo", codigo: error.code, mensaje: error.message });
    return null;
  }
  const perfil = data as FilaPerfil;

  const [{ regla, cupo, proceso }, asesorNombre] = await Promise.all([
    reglaCreditoDe(supabase, { activo: perfil.activo, grado: perfil.grado, tienePendiente: opciones.tienePendiente }),
    nombreDelAsesor(perfil.asesor_id),
  ]);
  const vista = vistaProcesoEjecutivo(proceso, hoy);

  return {
    nombre: perfil.nombre_completo ?? "Asociado",
    cedula: perfil.cedula ?? "—",
    telefono: perfil.telefono ?? "",
    rol: perfil.rol,
    gradoNombre: cupo.estado === "sin_grado" ? null : cupo.nombre,
    gradoCodigo: perfil.grado,
    institucion: nombreInstitucion(perfil.institucion),
    activo: perfil.activo !== false,
    asesorNombre,
    proceso: vista,
    caminoEstabilidad: caminoEstabilidad(vista, hoy),
    cupo,
    credito: regla,
  };
}
