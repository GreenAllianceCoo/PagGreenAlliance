import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrar } from "@/lib/servidor/registro";
import { BUCKET_AFILIACION } from "@/lib/afiliacion/fotos";

/**
 * RS-03 (decisión de Sebas, 30-sep): las fotos subidas a `solicitudes/<id>/`
 * que no terminan en una solicitud se borran a las 3 horas. Lo dispara una
 * tarea programada (app/api/cron/limpiar-fotos/route.ts).
 *
 * RS-18: la base decide cuáles con la RPC `fotos_huerfanas_afiliacion`
 * (solo service_role): objetos de `solicitudes/<uuid>/` con más de 3 h y sin
 * fila en `solicitudes_afiliacion`. Nunca se toca nada que pertenezca a una
 * solicitud, sea cual sea su estado.
 */

export const EDAD_MINIMA_HUERFANAS_MS = 3 * 60 * 60 * 1000;
const LIMITE_POR_EJECUCION = 500;
const TAMANO_LOTE_BORRADO = 100;
/** Toda ruta a borrar debe ser `solicitudes/<uuid>/<archivo>`; cualquier otra se ignora. */
const RUTA_VALIDA = /^solicitudes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/;
/** RS-22: largo mínimo del secreto de la tarea programada. */
const LARGO_MINIMO_SECRETO = 32;

/**
 * true solo si CRON_SECRET existe, tiene 32+ caracteres y el encabezado
 * `Authorization: Bearer <valor>` coincide. Comparación en tiempo constante
 * (se comparan los SHA-256, que tienen el mismo largo). Nunca se registra el secreto.
 */
export function cronAutorizado(encabezado: string | null, secreto: string | undefined): boolean {
  if (!secreto || secreto.length < LARGO_MINIMO_SECRETO) {
    if (secreto) registrar("error", { evento: "cron_secret_demasiado_corto", minimo: LARGO_MINIMO_SECRETO });
    return false;
  }
  if (!encabezado || !encabezado.startsWith("Bearer ")) return false;
  const recibido = createHash("sha256").update(encabezado.slice("Bearer ".length)).digest();
  const esperado = createHash("sha256").update(secreto).digest();
  return timingSafeEqual(recibido, esperado);
}

export type ResultadoLimpieza = { revisados: number; borrados: number };

/** Borra las fotos huérfanas que devuelve la base, en lotes de 100. */
export async function limpiarFotosHuerfanas(admin: SupabaseClient): Promise<ResultadoLimpieza> {
  const { data, error } = await admin.rpc("fotos_huerfanas_afiliacion", { p_limite: LIMITE_POR_EJECUCION });
  if (error) throw new Error(`No se pudieron listar las fotos huérfanas: ${error.message}`);

  const nombres = ((data ?? []) as { name: string }[])
    .map((f) => f?.name)
    .filter((n): n is string => typeof n === "string" && RUTA_VALIDA.test(n));
  if (nombres.length === 0) return { revisados: 0, borrados: 0 };

  const almacen = admin.storage.from(BUCKET_AFILIACION);
  let borrados = 0;
  for (let i = 0; i < nombres.length; i += TAMANO_LOTE_BORRADO) {
    const lote = nombres.slice(i, i + TAMANO_LOTE_BORRADO);
    const { error: errorBorrar } = await almacen.remove(lote);
    if (errorBorrar) {
      registrar("error", { evento: "limpieza_fotos_borrado_fallo", mensaje: errorBorrar.message });
      continue;
    }
    borrados += lote.length;
  }
  return { revisados: nombres.length, borrados };
}
