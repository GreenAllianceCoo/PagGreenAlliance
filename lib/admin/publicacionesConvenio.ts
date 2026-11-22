import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoPublicacion, hoyBogota, type EstadoPublicacion, type Publicacion } from "@/lib/convenio/publicaciones";
import {
  COLUMNAS_PUBLICACION,
  filaAPublicacion,
  mapaMetricas,
  SIN_METRICAS,
  urlsFirmadas,
  type FilaPublicacion,
  type Metricas,
} from "@/lib/convenio/servidor";
import { registrar } from "@/lib/servidor/registro";
import type { FiltrosPublicaciones } from "@/lib/validaciones/publicacionesConvenio";

/** Publicación tal como la ve el admin en /admin/convenios/publicaciones. */
export type PublicacionAdmin = Publicacion & {
  convenioId: string;
  convenioNombre: string;
  estado: EstadoPublicacion;
  metricas: Metricas;
  /** URL firmada (1 h) de la primera imagen, para la miniatura. */
  portada: string | null;
  /** URL firmada del PDF o de la primera imagen, para «Ver». */
  archivoUrl: string | null;
  /** Nombre de quien la ocultó (solo si está oculta). */
  ocultaPorNombre: string | null;
};

export type OpcionConvenio = { id: string; nombre: string };

type FilaAdmin = FilaPublicacion & {
  convenio_id: string;
  oculta_por: string | null;
  convenios: { nombre_empresa: string } | { nombre_empresa: string }[] | null;
};

const TOPE_FILAS = 1000;

function nombreConvenio(c: FilaAdmin["convenios"]): string {
  const fila = Array.isArray(c) ? c[0] : c;
  return fila?.nombre_empresa ?? "Convenio eliminado";
}

/** Aplica los filtros en memoria (son pocas: máximo 15 activas por convenio). */
export function filtrarPublicaciones<T extends Pick<PublicacionAdmin, "convenioId" | "tipo" | "estado">>(
  lista: T[],
  filtros: FiltrosPublicaciones,
): T[] {
  return lista.filter(
    (p) =>
      (!filtros.convenio || p.convenioId === filtros.convenio) &&
      (!filtros.tipo || p.tipo === filtros.tipo) &&
      (!filtros.estado || p.estado === filtros.estado),
  );
}

/**
 * Todas las publicaciones de todos los convenios con la sesión del admin (RLS:
 * convenio_publicaciones_select_staff), más las opciones del filtro de convenio.
 */
export async function listarPublicacionesAdmin(supabase: SupabaseClient, filtros: FiltrosPublicaciones, hoy = hoyBogota()) {
  const [{ data, error }, { data: metricas }] = await Promise.all([
    supabase
      .from("convenio_publicaciones")
      .select(`${COLUMNAS_PUBLICACION}, convenio_id, oculta_por, convenios(nombre_empresa)`)
      .order("creada_en", { ascending: false })
      .limit(TOPE_FILAS),
    supabase.rpc("metricas_publicaciones"),
  ]);
  if (error) {
    registrar("error", { evento: "admin_publicaciones_lista_fallo", codigo: error.code, mensaje: error.message });
    return { publicaciones: [] as PublicacionAdmin[], convenios: [] as OpcionConvenio[], total: 0, error: true };
  }

  const filas = (data ?? []) as unknown as FilaAdmin[];
  const porId = mapaMetricas(metricas);

  const todas = filas.map((f) => {
    const p = filaAPublicacion(f);
    return { ...p, fila: f, estado: estadoPublicacion(p, hoy) };
  });

  const opciones = new Map<string, string>();
  for (const { fila } of todas) opciones.set(fila.convenio_id, nombreConvenio(fila.convenios));
  const convenios = [...opciones].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const visibles = filtrarPublicaciones(
    todas.map((t) => ({ ...t, convenioId: t.fila.convenio_id })),
    filtros,
  );

  const idsOcultadores = [...new Set(visibles.map((v) => v.fila.oculta_por).filter((x): x is string => Boolean(x)))];
  const rutas = visibles.flatMap((v) => [v.imagenes[0], v.pdfPath]).filter((r): r is string => Boolean(r));
  const [urls, { data: ocultadores }] = await Promise.all([
    urlsFirmadas(supabase, rutas),
    idsOcultadores.length > 0
      ? supabase.from("perfiles").select("id, nombre_completo").in("id", idsOcultadores)
      : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
  ]);
  const nombres = new Map(((ocultadores ?? []) as { id: string; nombre_completo: string }[]).map((o) => [o.id, o.nombre_completo]));

  const publicaciones: PublicacionAdmin[] = visibles.map(({ fila, ...p }) => {
    const portada = p.imagenes[0] ? (urls[p.imagenes[0]] ?? null) : null;
    return {
      ...p,
      convenioNombre: nombreConvenio(fila.convenios),
      metricas: porId.get(p.id) ?? SIN_METRICAS,
      portada,
      archivoUrl: p.pdfPath ? (urls[p.pdfPath] ?? null) : portada,
      ocultaPorNombre: fila.oculta_por ? (nombres.get(fila.oculta_por) ?? "Alguien del equipo") : null,
    };
  });

  return { publicaciones, convenios, total: todas.length, error: false };
}
