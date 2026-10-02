"use server";

import { firmarComprobante, rutaDeComprobante } from "@/lib/admin/comprobantes";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { createClient } from "@/lib/supabase/server";
import { esquemaVerComprobante } from "@/lib/validaciones/comprobante";

/**
 * «Ver comprobante» del asociado (pedido de Sebas, 1-oct). Solo lectura y solo del
 * PROPIO crédito: primero se comprueba, con la sesión del asociado (RLS: solo ve sus
 * solicitudes), que la solicitud es suya y que tiene comprobante; recién después se
 * firma la URL con service role (3 minutos). El bucket es privado y no tiene
 * políticas, así que no hay otra forma de leerlo.
 * Respuesta única si no existe o no es suya: no se revela nada de solicitudes ajenas.
 */
export async function urlComprobanteDesembolso(solicitudId: string): Promise<{ url?: string; error?: string }> {
  const r = esquemaVerComprobante.safeParse({ solicitudId });
  if (!r.success) return { error: "No encontramos el comprobante." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión venció. Ingresa de nuevo." };

  if (!(await dentroDelLimite("comprobante-ver", user.id, 30, 60 * 60))) {
    return { error: "Hiciste muchas consultas seguidas. Intenta de nuevo en un rato." };
  }

  const { data: propia } = await supabase
    .from("solicitudes_credito")
    .select("id, comprobante_subido_at")
    .eq("id", r.data.solicitudId)
    .eq("asociado_id", user.id)
    .maybeSingle();
  if (!propia?.comprobante_subido_at) return { error: "No encontramos el comprobante." };

  const ruta = await rutaDeComprobante(r.data.solicitudId);
  if (!ruta) return { error: "No encontramos el comprobante." };
  const url = await firmarComprobante(ruta);
  return url ? { url } : { error: "No pudimos abrir el comprobante. Intenta de nuevo." };
}
