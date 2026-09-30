import "server-only";
import {
  completarConvenio,
  CONVENIOS,
  NOMBRE_CORTO_POR_NIT,
  ORDEN_POR_NIT,
  type Convenio,
} from "@/lib/convenios";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/** Fila pública de `convenios` (solo columnas de información comercial). */
type FilaConvenio = {
  nombre_empresa: string;
  nit: string | null;
  telefono_contacto: string | null;
  emoji: string | null;
  especialidad: string | null;
  descripcion: string | null;
  servicios: string[] | null;
  sedes: string[] | null;
};

export function filaAConvenio(fila: FilaConvenio): Convenio {
  return completarConvenio({
    emoji: fila.emoji ?? "🤝",
    nombre: fila.nombre_empresa,
    nombreCorto: (fila.nit && NOMBRE_CORTO_POR_NIT[fila.nit]) || fila.nombre_empresa,
    especialidad: fila.especialidad ?? "",
    nit: fila.nit,
    descripcion: fila.descripcion,
    servicios: fila.servicios ?? [],
    sedes: fila.sedes ?? [],
    whatsapp: fila.telefono_contacto,
  });
}

function posicion(nit: string | null) {
  const i = ORDEN_POR_NIT.indexOf(nit ?? "");
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Convenios ACTIVOS para la landing (pública) y /cuenta. La política de
 * `convenios` solo deja leer a usuarios con sesión; la landing no tiene
 * sesión, así que se lee en el servidor con service role y SOLO columnas
 * comerciales (nada de notas internas). Si falla o está vacía, se usa el
 * respaldo `CONVENIOS` (mismos textos de la migración).
 */
export async function cargarConvenios(): Promise<Convenio[]> {
  try {
    const { data, error } = await crearClienteAdmin()
      .from("convenios")
      .select("nombre_empresa, nit, telefono_contacto, emoji, especialidad, descripcion, servicios, sedes")
      .eq("activo", true);
    if (error) throw error;
    const filas = (data ?? []) as FilaConvenio[];
    if (filas.length === 0) return CONVENIOS;
    return filas
      .map(filaAConvenio)
      .sort((a, b) => posicion(a.nit) - posicion(b.nit) || a.nombre.localeCompare(b.nombre, "es"));
  } catch (e) {
    registrar("error", {
      evento: "convenios_carga_fallo",
      mensaje: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    });
    return CONVENIOS;
  }
}
