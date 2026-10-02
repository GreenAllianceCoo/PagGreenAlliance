import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_COMPROBANTES } from "@/lib/comprobantes";
import { registrar } from "@/lib/servidor/registro";

/**
 * Limpieza de comprobantes de desembolso (decisión de Sebas, 2-oct), dentro de la
 * misma tarea programada que borra las fotos de afiliación:
 *  - VENCIDOS: al eliminar definitivamente a un asociado sus comprobantes se guardan
 *    30 días (solicitudes_credito.comprobante_borrar_at). Al vencer se borra el
 *    archivo de Storage y recién entonces se limpia la referencia en la base.
 *  - HUÉRFANOS: archivos subidos y nunca ligados a una solicitud, con más de 24 h.
 * La base decide cuáles (RPC solo service_role); aquí solo se borra.
 */

const LIMITE_POR_EJECUCION = 200;
const TAMANO_LOTE_BORRADO = 100;
/** Toda ruta a borrar debe ser `<solicitud uuid>/<uuid>.<ext>`; cualquier otra se ignora. */
const RUTA_VALIDA = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

export type ResultadoLimpiezaComprobantes = { vencidos: number; huerfanos: number };

export async function limpiarComprobantes(admin: SupabaseClient): Promise<ResultadoLimpiezaComprobantes> {
  const almacen = admin.storage.from(BUCKET_COMPROBANTES);
  let vencidos = 0;
  let huerfanos = 0;

  // 1. Vencidos: borrar de Storage y luego liberar la referencia (por lote, solo los que se borraron).
  const { data: lista, error: errorLista } = await admin.rpc("comprobantes_vencidos", { p_limite: LIMITE_POR_EJECUCION });
  if (errorLista) throw new Error(`No se pudieron listar los comprobantes vencidos: ${errorLista.message}`);
  const filas = ((lista ?? []) as { solicitud_id: string; ruta: string }[]).filter(
    (f) => typeof f?.ruta === "string" && RUTA_VALIDA.test(f.ruta),
  );
  for (let i = 0; i < filas.length; i += TAMANO_LOTE_BORRADO) {
    const lote = filas.slice(i, i + TAMANO_LOTE_BORRADO);
    const { error } = await almacen.remove(lote.map((f) => f.ruta));
    if (error) {
      registrar("error", { evento: "limpieza_comprobantes_vencidos_fallo", mensaje: error.message });
      continue;
    }
    const { error: errorLiberar } = await admin.rpc("liberar_comprobantes", { p_solicitud_ids: lote.map((f) => f.solicitud_id) });
    if (errorLiberar) {
      registrar("error", { evento: "limpieza_comprobantes_liberar_fallo", mensaje: errorLiberar.message });
      continue;
    }
    vencidos += lote.length;
  }

  // 2. Huérfanos (más de 24 h sin ligar).
  const { data: sueltos, error: errorSueltos } = await admin.rpc("comprobantes_huerfanos", { p_limite: 500 });
  if (errorSueltos) throw new Error(`No se pudieron listar los comprobantes huérfanos: ${errorSueltos.message}`);
  const nombres = ((sueltos ?? []) as { name: string }[])
    .map((f) => f?.name)
    .filter((n): n is string => typeof n === "string" && RUTA_VALIDA.test(n));
  for (let i = 0; i < nombres.length; i += TAMANO_LOTE_BORRADO) {
    const lote = nombres.slice(i, i + TAMANO_LOTE_BORRADO);
    const { error } = await almacen.remove(lote);
    if (error) {
      registrar("error", { evento: "limpieza_comprobantes_huerfanos_fallo", mensaje: error.message });
      continue;
    }
    huerfanos += lote.length;
  }
  return { vencidos, huerfanos };
}
