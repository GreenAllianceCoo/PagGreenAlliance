import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completarConvenio, CONVENIOS, NOMBRE_CORTO_POR_NIT, type Convenio, type MedioConvenio } from "@/lib/convenios";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAnonimoSinSesion } from "@/lib/supabase/admin";

export const BUCKET_LOGOS = "convenios-logos";

/**
 * Columnas públicas de `convenios` para rol anon (migración 20261009000000, H-01):
 * sin `telefono_contacto` (WhatsApp solo para usuario autenticado).
 */
export const COLUMNAS_CONVENIO_PUBLICAS =
  "id, nombre_empresa, nit, especialidad, emoji, descripcion, servicios, sedes, orden, visible, logo_path, video_url, pdf_url, pdf_tamano";

/**
 * Columnas de `convenios` para usuario autenticado (sesión): incluye `telefono_contacto`.
 * Usadas en /cuenta, /asesor/demo, /admin/demo.
 */
export const COLUMNAS_CONVENIO_AUTENTICADAS =
  "id, nombre_empresa, nit, especialidad, emoji, descripcion, servicios, sedes, telefono_contacto, orden, visible, logo_path, video_url, pdf_url, pdf_tamano";

/** Fila pública de `convenios` (sin `telefono_contacto`). */
export type FilaConvenio = {
  id: string;
  nombre_empresa: string;
  nit: string | null;
  emoji: string | null;
  especialidad: string | null;
  descripcion: string | null;
  servicios: string[] | null;
  sedes: string[] | null;
  orden: number;
  visible: boolean;
  logo_path: string | null;
  video_url: string | null;
  pdf_url: string | null;
  pdf_tamano: string | null;
};

/** Fila autenticada de `convenios` (incluye `telefono_contacto`). */
export type FilaConvenioAutenticada = FilaConvenio & {
  telefono_contacto: string | null;
};

/** Video si hay `video_url`; si no, PDF si hay `pdf_url` (con su tamaño). */
export function medioDeFila(fila: Pick<FilaConvenio, "video_url" | "pdf_url" | "pdf_tamano">): MedioConvenio | null {
  if (fila.video_url) return { tipo: "video", src: fila.video_url };
  if (fila.pdf_url) return { tipo: "pdf", src: fila.pdf_url, tamano: fila.pdf_tamano ?? "" };
  return null;
}

/** URL pública del logo (getPublicUrl no hace red: arma la URL del bucket público). */
export function urlLogo(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  return crearClienteAnonimoSinSesion().storage.from(BUCKET_LOGOS).getPublicUrl(logoPath).data.publicUrl;
}

/** Sin `telefono_contacto` (carga pública) el convenio sale sin WhatsApp. */
export function filaAConvenio(fila: FilaConvenio & { telefono_contacto?: string | null }): Convenio {
  return {
    ...completarConvenio({
      emoji: fila.emoji ?? "🤝",
      nombre: fila.nombre_empresa,
      nombreCorto: (fila.nit && NOMBRE_CORTO_POR_NIT[fila.nit]) || fila.nombre_empresa,
      especialidad: fila.especialidad ?? "",
      nit: fila.nit,
      descripcion: fila.descripcion,
      servicios: fila.servicios ?? [],
      sedes: fila.sedes ?? [],
      whatsapp: fila.telefono_contacto ?? null,
      medio: medioDeFila(fila),
      logoUrl: urlLogo(fila.logo_path),
    }),
    id: fila.id,
  };
}

/**
 * Convenios VISIBLES para la landing (pública), por `orden`. H-01: no tiene sesión,
 * se lee con rol anon y SOLO columnas sin `telefono_contacto`. Si falla, usa
 * el respaldo `CONVENIOS` pero sin números (WhatsApp = null).
 * Si la tabla responde y el admin ocultó todos, la lista queda vacía a propósito.
 */
export async function cargarConvenios(): Promise<Convenio[]> {
  try {
    const { data, error } = await crearClienteAnonimoSinSesion()
      .from("convenios")
      .select(COLUMNAS_CONVENIO_PUBLICAS)
      .eq("visible", true)
      .order("orden", { ascending: true })
      .order("nombre_empresa", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as FilaConvenio[]).map(filaAConvenio);
  } catch (e) {
    registrar("error", {
      evento: "convenios_carga_fallo",
      mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
    // Respaldo: devolver CONVENIOS sin números de WhatsApp (como si vinieran de anon)
    return CONVENIOS.map(c => ({
      ...c,
      whatsapp: null,
      whatsappTexto: null,
      whatsappUrl: null,
    }));
  }
}

/**
 * Convenios para usuario autenticado (/cuenta, demos de asesor/admin).
 * Se lee con sesión del usuario (cliente de servidor con cookies) e incluye
 * `telefono_contacto`. Si falla, usa el respaldo `CONVENIOS` completo (con WhatsApp).
 */
export async function cargarConveniosAutenticados(supabase: SupabaseClient): Promise<Convenio[]> {
  try {
    const { data, error } = await supabase
      .from("convenios")
      .select(COLUMNAS_CONVENIO_AUTENTICADAS)
      .eq("visible", true)
      .order("orden", { ascending: true })
      .order("nombre_empresa", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as FilaConvenioAutenticada[]).map(filaAConvenio);
  } catch (e) {
    registrar("error", {
      evento: "convenios_carga_autenticados_fallo",
      mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
    return CONVENIOS;
  }
}
