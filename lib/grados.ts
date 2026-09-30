import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAnonimoSinSesion } from "@/lib/supabase/admin";
import {
  filaAGrado,
  MENSAJE_SIN_CUPO,
  type GradoCatalogo,
  type GrupoCredito,
} from "@/lib/gradosCatalogo";

/**
 * Catálogo `public.grados` (migración 20260929100100). Tiene lectura
 * pública (anon y authenticated: nombres de grados, sin datos personales ni
 * montos), así que /afiliacion lo lee con el cliente anónimo SIN sesión, no
 * con service role.
 * Si la consulta falla se devuelve [] y se registra: nunca se inventan grados.
 */
export async function cargarCatalogoGrados(cliente?: SupabaseClient): Promise<GradoCatalogo[]> {
  const supabase = cliente ?? crearClienteAnonimoSinSesion();
  const { data, error } = await supabase
    .from("grados")
    .select("codigo, nombre, policia, ejercito, grupo_credito, orden, seleccionable")
    .order("orden", { ascending: true });
  if (error) {
    registrar("error", { evento: "catalogo_grados_fallo", codigo: error.code, mensaje: error.message });
    return [];
  }
  return (data ?? []).map((fila) => filaAGrado(fila as Record<string, unknown>));
}

/**
 * Opciones del selector «Grado» de /afiliacion: los seleccionables con su
 * institución (el filtro por institución lo hace el navegador con
 * `gradosDeInstitucion`, y el servidor lo vuelve a exigir en el esquema zod).
 */
export async function gradosParaAfiliacion(): Promise<GradoCatalogo[]> {
  return (await cargarCatalogoGrados()).filter((g) => g.seleccionable);
}

/** Un paquete de `grados_credito` SIN la tasa (el asociado nunca la recibe). */
export type PaqueteCredito = {
  porcentaje: "50" | "100";
  capacidad_maxima: number;
  plazo_meses: number;
};

export type CupoCredito =
  | { estado: "sin_grado" }
  | { estado: "sin_cupo"; codigo: string; nombre: string; mensaje: string }
  | {
      estado: "con_cupo";
      codigo: string;
      nombre: string;
      grupo: GrupoCredito;
      /** Ordenados 50 % → 100 %. Vacío si la tabla no tiene filas para el grupo. */
      paquetes: PaqueteCredito[];
    };

/**
 * Cupo de crédito de un GRADO: busca su grupo en `grados` y los topes del
 * grupo en `grados_credito` (spec §0–§1). Con `grupo_credito = null` (IJ y
 * militares) → «sin cupo configurado»: no puede pedir crédito.
 * Recibe el cliente de quien llama (con su sesión y RLS): `grados_credito`
 * solo se lee con sesión.
 */
export async function cupoCreditoDelGrado(
  supabase: SupabaseClient,
  codigo: string | null | undefined,
): Promise<CupoCredito> {
  if (!codigo) return { estado: "sin_grado" };

  const { data: fila, error } = await supabase
    .from("grados")
    .select("codigo, nombre, policia, ejercito, grupo_credito, orden, seleccionable")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "cupo_grado_fallo", codigo: error.code, mensaje: error.message });
  }
  if (!fila) {
    // Grado que no está en el catálogo (no debería pasar: hay FK).
    return { estado: "sin_cupo", codigo, nombre: codigo, mensaje: MENSAJE_SIN_CUPO };
  }
  const grado = filaAGrado(fila as Record<string, unknown>);
  if (!grado.grupoCredito) {
    return { estado: "sin_cupo", codigo: grado.codigo, nombre: grado.nombre, mensaje: MENSAJE_SIN_CUPO };
  }

  const { data: paquetes, error: errorPaquetes } = await supabase
    .from("grados_credito")
    // Sin tasa_interes_mensual: es de uso interno y no debe llegar al navegador (25-sep).
    .select("porcentaje, capacidad_maxima, plazo_meses")
    .eq("grado", grado.grupoCredito)
    .order("porcentaje", { ascending: true });
  if (errorPaquetes) {
    registrar("error", { evento: "cupo_paquetes_fallo", codigo: errorPaquetes.code, mensaje: errorPaquetes.message });
  }

  return {
    estado: "con_cupo",
    codigo: grado.codigo,
    nombre: grado.nombre,
    grupo: grado.grupoCredito,
    paquetes: (paquetes ?? []).map((p) => ({
      porcentaje: String(p.porcentaje) as "50" | "100",
      capacidad_maxima: Number(p.capacidad_maxima),
      plazo_meses: Number(p.plazo_meses),
    })),
  };
}
