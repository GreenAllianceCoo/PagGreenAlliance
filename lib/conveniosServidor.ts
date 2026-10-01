import "server-only";
import { completarConvenio, CONVENIOS, NOMBRE_CORTO_POR_NIT, type Convenio, type MedioConvenio } from "@/lib/convenios";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAnonimoSinSesion } from "@/lib/supabase/admin";

export const BUCKET_LOGOS = "convenios-logos";

/**
 * Columnas comerciales de `convenios`: las mismas que el rol anon puede pedir
 * (migración 20261002000000). Nunca `select *`: la tabla tiene notas internas.
 */
export const COLUMNAS_CONVENIO_PUBLICAS =
  "id, nombre_empresa, nit, especialidad, emoji, descripcion, servicios, sedes, telefono_contacto, orden, visible, logo_path, video_url, pdf_url, pdf_tamano";

/** Fila pública de `convenios`. */
export type FilaConvenio = {
  id: string;
  nombre_empresa: string;
  nit: string | null;
  telefono_contacto: string | null;
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

export function filaAConvenio(fila: FilaConvenio): Convenio {
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
      whatsapp: fila.telefono_contacto,
      medio: medioDeFila(fila),
      logoUrl: urlLogo(fila.logo_path),
    }),
    id: fila.id,
  };
}

/**
 * Convenios VISIBLES para la landing (pública) y /cuenta, por `orden`. La
 * landing no tiene sesión: se lee en el servidor con el rol anon (sin service role) y
 * SOLO columnas comerciales. Si la consulta falla (o no hay ninguno visible
 * porque la tabla no responde), se usa el respaldo `CONVENIOS`. Si la tabla
 * responde y el admin ocultó todos, la lista queda vacía a propósito.
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
    return CONVENIOS;
  }
}
