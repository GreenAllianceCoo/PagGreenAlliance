import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { urlFirmadaFoto } from "@/lib/admin/fotos";
import { registrar } from "@/lib/servidor/registro";
import { FILAS_CAMBIOS, type FiltrosCambios } from "@/lib/validaciones/cambiosAsociados";
import { vistaCambio, type CambioAsociado, type FilaCambioAsociado } from "./cambiosAsociadosTexto";

/** Cambio listo para pintar: las rutas de las fotos ya vienen como URLs firmadas cortas. */
export type CambioConFotos = Omit<CambioAsociado, "foto"> & {
  foto: { etiqueta: string; urlAnterior: string | null; urlNueva: string | null; teniaAnterior: boolean } | null;
};

/**
 * «Cambios» (solo admin): una página de public.admin_cambios_asociados(), ya redactada,
 * con las fotos de antes y después firmadas (service role; quien llama ya pasó por
 * exigirAdmin). Las rutas del bucket nunca llegan al navegador.
 */
export async function cargarCambiosAsociados(
  supabase: SupabaseClient,
  filtros: FiltrosCambios,
): Promise<{ cambios: CambioConFotos[]; total: number; error: boolean }> {
  const { data, error } = await supabase.rpc("admin_cambios_asociados", {
    p_asociado: filtros.asociado ?? null,
    p_busqueda: filtros.q ?? null,
    p_desde: filtros.desde ?? null,
    p_hasta: filtros.hasta ?? null,
    p_limite: FILAS_CAMBIOS,
    p_pagina: filtros.pagina,
  });
  if (error) {
    registrar("error", { evento: "admin_cambios_asociados_fallo", codigo: error.code, mensaje: error.message });
    return { cambios: [], total: 0, error: true };
  }
  const filas = (data ?? []) as FilaCambioAsociado[];
  const cambios = await Promise.all(
    filas.map(async (fila): Promise<CambioConFotos> => {
      const v = vistaCambio(fila);
      if (!v.foto) return { ...v, foto: null };
      const [urlAnterior, urlNueva] = await Promise.all([urlFirmadaFoto(v.foto.rutaAnterior), urlFirmadaFoto(v.foto.rutaNueva)]);
      return { ...v, foto: { etiqueta: v.foto.etiqueta, urlAnterior, urlNueva, teniaAnterior: v.foto.rutaAnterior !== null } };
    }),
  );
  return { cambios, total: Number(filas[0]?.total ?? 0), error: false };
}

/** Nombre del asociado del filtro (para el título «Cambios de Ana Pérez»), o null. */
export async function nombreDeAsociado(supabase: SupabaseClient, asociadoId: string): Promise<string | null> {
  const { data } = await supabase.from("perfiles").select("nombre_completo, rol").eq("id", asociadoId).maybeSingle();
  return data && data.rol === "asociado" ? (data.nombre_completo as string) : null;
}
