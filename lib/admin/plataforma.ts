import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatearFecha } from "@/lib/cuenta";
import { registrar } from "@/lib/servidor/registro";

/** Loaders de /admin/plataforma: pausa del ingreso de asociados y avisos (migración 20261018000000). */

export type EstadoPausa = {
  pausada: boolean;
  mensaje: string | null;
  /** «Pausado por Ana · 18 oct 2026 7:30» del último cambio (null si nunca se ha tocado). */
  ultimoCambio: string | null;
};

export type AvisoAdmin = {
  id: string;
  titulo: string;
  mensaje: string;
  activo: boolean;
  creado: string;
  autor: string | null;
  vistos: number;
};

export async function cargarPlataforma(supabase: SupabaseClient): Promise<{
  pausa: EstadoPausa | null;
  avisos: AvisoAdmin[];
  error: boolean;
}> {
  const [{ data: config, error: errorConfig }, { data: avisos, error: errorAvisos }] = await Promise.all([
    supabase
      .from("configuracion_plataforma")
      .select("cuenta_pausada, mensaje_pausa, actualizado_por, actualizado_at")
      .maybeSingle(),
    supabase
      .from("avisos_asociados")
      .select("id, titulo, mensaje, activo, creado_por, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (errorConfig || errorAvisos) {
    registrar("error", {
      evento: "admin_plataforma_lectura_fallo",
      codigo: errorConfig?.code ?? errorAvisos?.code,
      mensaje: errorConfig?.message ?? errorAvisos?.message,
    });
    return { pausa: null, avisos: [], error: true };
  }

  const filas = avisos ?? [];
  const ids = [...new Set([config?.actualizado_por, ...filas.map((a) => a.creado_por)].filter(Boolean))] as string[];
  const [{ data: personas }, conteos] = await Promise.all([
    ids.length ? supabase.from("perfiles").select("id, nombre_completo").in("id", ids) : Promise.resolve({ data: [] }),
    Promise.all(
      filas.map((a) =>
        supabase.from("avisos_vistos").select("aviso_id", { count: "exact", head: true }).eq("aviso_id", a.id),
      ),
    ),
  ]);
  const nombre = new Map((personas ?? []).map((p) => [p.id as string, p.nombre_completo as string]));

  return {
    error: false,
    pausa: config
      ? {
          pausada: Boolean(config.cuenta_pausada),
          mensaje: (config.mensaje_pausa as string | null) ?? null,
          ultimoCambio: config.actualizado_por
            ? `${config.cuenta_pausada ? "Pausado" : "Reanudado"} por ${nombre.get(config.actualizado_por as string) ?? "un administrador"} · ${formatearFecha(config.actualizado_at as string)}`
            : null,
        }
      : null,
    avisos: filas.map((a, i) => ({
      id: a.id as string,
      titulo: a.titulo as string,
      mensaje: a.mensaje as string,
      activo: Boolean(a.activo),
      creado: formatearFecha(a.created_at as string) ?? "",
      autor: a.creado_por ? (nombre.get(a.creado_por as string) ?? null) : null,
      vistos: conteos[i]?.count ?? 0,
    })),
  };
}
