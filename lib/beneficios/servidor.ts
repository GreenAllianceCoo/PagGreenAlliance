import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { ciudadesDeConvenio, esNueva, type ResumenPublicacion } from "@/lib/beneficios/beneficios";
import { COLUMNAS_PUBLICACION, filaAPublicacion, urlsFirmadas, type FilaPublicacion } from "@/lib/convenio/servidor";
import type { Publicacion } from "@/lib/convenio/publicaciones";
import { enlaceWhatsappConvenio } from "@/lib/convenios";
import { urlLogo } from "@/lib/conveniosServidor";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

/**
 * Sesión de /cuenta/beneficios: sin sesión → /ingresar; cuenta dada de baja →
 * «Tu cuenta está inactiva». Lo que ve cada quien lo decide RLS: solo un
 * asociado activo ve publicaciones (vigentes y de convenios visibles).
 */
export async function sesionBeneficios() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: perfil } = await supabase.from("perfiles").select("rol, activo, nombre_completo").eq("id", user.id).maybeSingle();
  if (perfil && perfil.activo === false) redirect(RUTA_CUENTA_INACTIVA);
  return {
    supabase,
    nombre: (perfil?.nombre_completo as string | undefined) ?? "Asociado",
    esAsociado: perfil?.rol === "asociado",
  };
}

const COLUMNAS_CONVENIO = "id, nombre_empresa, especialidad, sedes, logo_path, telefono_contacto";

type FilaConvenioBeneficio = {
  id: string;
  nombre_empresa: string;
  especialidad: string | null;
  sedes: string[] | null;
  logo_path: string | null;
  telefono_contacto: string | null;
};

type FilaBeneficio = FilaPublicacion & { convenio_id: string; convenios: FilaConvenioBeneficio | FilaConvenioBeneficio[] | null };

export type Beneficio = Publicacion & {
  convenioId: string;
  convenioNombre: string;
  convenioLogoUrl: string | null;
  especialidad: string;
  ciudades: string[];
  nuevo: boolean;
  portada: string | null;
};

function convenioDe(f: FilaBeneficio): FilaConvenioBeneficio | null {
  return Array.isArray(f.convenios) ? (f.convenios[0] ?? null) : f.convenios;
}

function aBeneficio(f: FilaBeneficio, ahora: Date): Beneficio | null {
  const c = convenioDe(f);
  if (!c) return null;
  const p = filaAPublicacion(f);
  return {
    ...p,
    convenioId: f.convenio_id,
    convenioNombre: c.nombre_empresa,
    convenioLogoUrl: urlLogo(c.logo_path),
    especialidad: c.especialidad ?? "",
    ciudades: ciudadesDeConvenio(c.sedes ?? []),
    nuevo: esNueva(p.creadaEn, ahora),
    portada: null,
  };
}

const SELECT = `${COLUMNAS_PUBLICACION}, convenio_id, convenios!inner(${COLUMNAS_CONVENIO})`;

/** Feed: publicaciones activas, las más recientes primero, con la URL firmada de su primera imagen. */
export async function cargarBeneficios(supabase: SupabaseClient, ahora = new Date()) {
  const { data, error } = await supabase.from("convenio_publicaciones").select(SELECT).order("creada_en", { ascending: false }).limit(300);
  if (error) {
    registrar("error", { evento: "beneficios_lista_fallo", codigo: error.code, mensaje: error.message });
    return { beneficios: [] as Beneficio[], error: true };
  }
  const lista = ((data ?? []) as unknown as FilaBeneficio[]).map((f) => aBeneficio(f, ahora)).filter((b): b is Beneficio => b !== null);
  const urls = await urlsFirmadas(
    supabase,
    lista.map((b) => b.imagenes[0]).filter((r): r is string => Boolean(r)),
  );
  return {
    error: false,
    beneficios: lista.map((b) => ({ ...b, portada: b.imagenes[0] ? (urls[b.imagenes[0]] ?? null) : null })),
  };
}

export type DetalleBeneficio = Beneficio & {
  /** URLs firmadas de todas las imágenes, en orden. */
  imagenesUrl: string[];
  pdfUrl: string | null;
  whatsappUrl: string | null;
};

/** Una publicación activa por id (null si no existe, venció, está oculta o no es asociado). */
export async function cargarBeneficio(supabase: SupabaseClient, id: string, ahora = new Date()): Promise<DetalleBeneficio | null> {
  const { data } = await supabase.from("convenio_publicaciones").select(SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const fila = data as unknown as FilaBeneficio;
  const b = aBeneficio(fila, ahora);
  if (!b) return null;
  const rutas = [...b.imagenes, ...(b.pdfPath ? [b.pdfPath] : [])];
  const urls = await urlsFirmadas(supabase, rutas);
  const imagenesUrl = b.imagenes.map((r) => urls[r]).filter((u): u is string => Boolean(u));
  return {
    ...b,
    portada: imagenesUrl[0] ?? null,
    imagenesUrl,
    pdfUrl: b.pdfPath ? (urls[b.pdfPath] ?? null) : null,
    whatsappUrl: enlaceWhatsappConvenio(convenioDe(fila)?.telefono_contacto, b.convenioNombre),
  };
}

/** Publicaciones activas agrupadas por convenio (para el detalle de cada convenio en /cuenta). */
export async function resumenesPorConvenio(supabase: SupabaseClient): Promise<Record<string, ResumenPublicacion[]>> {
  const { data, error } = await supabase
    .from("convenio_publicaciones")
    .select("id, titulo, tipo, beneficio, convenio_id")
    .order("creada_en", { ascending: false })
    .limit(300);
  if (error) {
    registrar("warn", { evento: "beneficios_resumen_fallo", codigo: error.code, mensaje: error.message });
    return {};
  }
  const salida: Record<string, ResumenPublicacion[]> = {};
  for (const f of (data ?? []) as (ResumenPublicacion & { convenio_id: string })[]) {
    (salida[f.convenio_id] ??= []).push({ id: f.id, titulo: f.titulo, tipo: f.tipo, beneficio: f.beneficio });
  }
  return salida;
}
