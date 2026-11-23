import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { BUCKET_PUBLICACIONES, type Publicacion, type TipoPublicacion } from "@/lib/convenio/publicaciones";
import { urlLogo } from "@/lib/conveniosServidor";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda del panel de la empresa en convenio (/convenio, docs/spec-convenios.md
 * §B2). Se usa en el layout, en CADA página y en CADA Server Action de
 * /convenio: proxy.ts solo exige sesión.
 *
 * - Sin sesión → /ingresar.
 * - Otro rol → /cuenta (desde ahí cada área manda a su lugar).
 * - Rol convenio pero el convenio está oculto, eliminado o la cuenta inactiva
 *   (convenio_del_usuario() = null) → cierra la sesión y muestra «Tu cuenta
 *   está inactiva» (RUTA_CUENTA_INACTIVA).
 *
 * Devuelve el cliente con la sesión del convenio: las consultas pasan por RLS.
 */
export async function exigirConvenio() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "convenio") redirect("/cuenta");

  const { data: convenioId } = await supabase.rpc("convenio_del_usuario");
  if (typeof convenioId !== "string" || convenioId.length === 0) redirect(RUTA_CUENTA_INACTIVA);

  const { data: convenio } = await supabase
    .from("convenios")
    .select("id, nombre_empresa, logo_path")
    .eq("id", convenioId)
    .maybeSingle();
  if (!convenio) redirect(RUTA_CUENTA_INACTIVA);

  return {
    supabase,
    userId: user.id,
    convenio: {
      id: convenio.id as string,
      nombre: convenio.nombre_empresa as string,
      logoUrl: urlLogo(convenio.logo_path as string | null),
    },
  };
}

export const COLUMNAS_PUBLICACION =
  "id, tipo, titulo, descripcion, beneficio, imagenes, pdf_path, inicia_el, termina_el, oculta_en, oculta_motivo, creada_en";

export type FilaPublicacion = {
  id: string;
  tipo: TipoPublicacion;
  titulo: string;
  descripcion: string | null;
  beneficio: string | null;
  imagenes: string[] | null;
  pdf_path: string | null;
  inicia_el: string | null;
  termina_el: string | null;
  oculta_en: string | null;
  oculta_motivo: string | null;
  creada_en: string;
};

export function filaAPublicacion(f: FilaPublicacion): Publicacion {
  return {
    id: f.id,
    tipo: f.tipo,
    titulo: f.titulo,
    descripcion: f.descripcion,
    beneficio: f.beneficio,
    imagenes: f.imagenes ?? [],
    pdfPath: f.pdf_path,
    iniciaEl: f.inicia_el,
    terminaEl: f.termina_el,
    ocultaEn: f.oculta_en,
    ocultaMotivo: f.oculta_motivo,
    creadaEn: f.creada_en,
  };
}

export type Metricas = { vistas: number; vistasUnicas: number; clics: number; clicsUnicos: number };
export const SIN_METRICAS: Metricas = { vistas: 0, vistasUnicas: 0, clics: 0, clicsUnicos: 0 };

type FilaMetricas = { publicacion_id: string; vistas: number; vistas_unicas: number; clics: number; clics_unicos: number };

/** Filas de metricas_publicaciones() → mapa por id de publicación. */
export function mapaMetricas(filas: unknown): Map<string, Metricas> {
  const porId = new Map<string, Metricas>();
  for (const m of (Array.isArray(filas) ? filas : []) as FilaMetricas[]) {
    porId.set(m.publicacion_id, {
      vistas: Number(m.vistas),
      vistasUnicas: Number(m.vistas_unicas),
      clics: Number(m.clics),
      clicsUnicos: Number(m.clics_unicos),
    });
  }
  return porId;
}

/** URLs firmadas (1 h) de archivos del bucket privado; las rutas que fallen quedan sin URL. */
export async function urlsFirmadas(supabase: SupabaseClient, rutas: string[]): Promise<Record<string, string>> {
  if (rutas.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET_PUBLICACIONES).createSignedUrls(rutas, 3600);
  if (error) {
    registrar("warn", { evento: "publicaciones_urls_fallo", mensaje: error.message });
    return {};
  }
  const salida: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) salida[d.path] = d.signedUrl;
  return salida;
}

/**
 * Publicaciones del convenio de la sesión (RLS: solo las suyas, incluidas
 * vencidas y ocultas), con sus métricas y la URL de la primera imagen.
 */
export async function listarPublicacionesPropias(supabase: SupabaseClient) {
  const [{ data, error }, { data: metricas }] = await Promise.all([
    supabase.from("convenio_publicaciones").select(COLUMNAS_PUBLICACION).order("creada_en", { ascending: false }),
    supabase.rpc("metricas_publicaciones"),
  ]);
  if (error) {
    registrar("error", { evento: "convenio_publicaciones_lista_fallo", codigo: error.code, mensaje: error.message });
    return { publicaciones: [] as (Publicacion & { metricas: Metricas; portada: string | null })[], error: true };
  }
  const porId = mapaMetricas(metricas);
  const lista = ((data ?? []) as FilaPublicacion[]).map(filaAPublicacion);
  const urls = await urlsFirmadas(
    supabase,
    lista.map((p) => p.imagenes[0]).filter((r): r is string => Boolean(r)),
  );
  return {
    error: false,
    publicaciones: lista.map((p) => ({
      ...p,
      metricas: porId.get(p.id) ?? SIN_METRICAS,
      portada: p.imagenes[0] ? (urls[p.imagenes[0]] ?? null) : null,
    })),
  };
}

/** Una publicación propia por id (null si no es suya o no existe). */
export async function obtenerPublicacionPropia(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("convenio_publicaciones").select(COLUMNAS_PUBLICACION).eq("id", id).maybeSingle();
  return data ? filaAPublicacion(data as FilaPublicacion) : null;
}
