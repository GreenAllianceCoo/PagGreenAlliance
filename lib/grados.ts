import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { GRADOS } from "@/lib/validaciones/afiliacion";
import type { Grado } from "@/lib/mock";

/**
 * Opciones del select «Grado» de /afiliacion, desde `grados_credito`.
 * La página es pública y RLS solo deja leer esa tabla a usuarios con sesión,
 * así que se lee en el servidor con service role y solo se expone el código.
 * TODO(pendiente-spec): nombre completo de cada grado (hoy se muestra el código: PP, PT, SI, IT, OF).
 */
export async function gradosParaAfiliacion(): Promise<Grado[]> {
  const { data, error } = await crearClienteAdmin().from("grados_credito").select("grado");
  if (error) {
    registrar("error", { evento: "grados_afiliacion_fallo", codigo: error.code, mensaje: error.message });
  }
  const presentes = new Set((data ?? []).map((fila) => String(fila.grado)));
  // Mismo orden del enum; si la consulta falla, se usan los valores del enum.
  return GRADOS.filter((g) => presentes.size === 0 || presentes.has(g)).map((g) => ({ id: g, nombre: g }));
}
