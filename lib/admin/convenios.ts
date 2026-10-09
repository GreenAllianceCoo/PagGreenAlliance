import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";
import { COLUMNAS_CONVENIO_AUTENTICADAS, urlLogo, type FilaConvenioAutenticada } from "@/lib/conveniosServidor";

/** Convenio tal como lo edita el admin (incluye los ocultos). */
export type ConvenioAdmin = {
  id: string;
  nombreEmpresa: string;
  nit: string | null;
  especialidad: string;
  emoji: string;
  descripcion: string;
  servicios: string[];
  sedes: string[];
  telefonoContacto: string;
  orden: number;
  visible: boolean;
  logoPath: string | null;
  logoUrl: string | null;
  videoUrl: string;
  pdfUrl: string;
  pdfTamano: string;
};

/** Todos los convenios (visibles y ocultos) con la sesión del admin: RLS deja ver todo solo a un admin. */
export async function listarConveniosAdmin(supabase: SupabaseClient): Promise<{ convenios: ConvenioAdmin[]; error: boolean }> {
  const { data, error } = await supabase
    .from("convenios")
    .select(COLUMNAS_CONVENIO_AUTENTICADAS)
    .order("orden", { ascending: true })
    .order("nombre_empresa", { ascending: true });
  if (error) {
    registrar("error", { evento: "admin_convenios_fallo", codigo: error.code, mensaje: error.message });
    return { convenios: [], error: true };
  }
  const filas = (data ?? []) as unknown as FilaConvenioAutenticada[];
  return {
    error: false,
    convenios: filas.map((f) => ({
      id: f.id,
      nombreEmpresa: f.nombre_empresa,
      nit: f.nit,
      especialidad: f.especialidad ?? "",
      emoji: f.emoji ?? "",
      descripcion: f.descripcion ?? "",
      servicios: f.servicios ?? [],
      sedes: f.sedes ?? [],
      telefonoContacto: f.telefono_contacto ?? "",
      orden: f.orden,
      visible: f.visible,
      logoPath: f.logo_path,
      logoUrl: urlLogo(f.logo_path),
      videoUrl: f.video_url ?? "",
      pdfUrl: f.pdf_url ?? "",
      pdfTamano: f.pdf_tamano ?? "",
    })),
  };
}
