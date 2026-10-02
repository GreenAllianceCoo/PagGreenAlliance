import { cronAutorizado, limpiarFotosHuerfanas } from "@/lib/afiliacion/limpiezaFotos";
import { limpiarComprobantes } from "@/lib/admin/limpiezaComprobantes";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * RS-03: tarea programada (vercel.json) que borra del bucket
 * `afiliacion-documentos` las fotos subidas hace más de 3 h que no
 * pertenecen a ninguna solicitud. En la misma pasada limpia los comprobantes de
 * desembolso: los de asociados eliminados cuyo plazo de 30 días venció y los
 * subidos y nunca ligados con más de 24 h. Vercel Cron manda
 * `Authorization: Bearer <CRON_SECRET>`; si la variable falta o no coincide,
 * responde 401 y NO hace nada (ni toca la base ni el bucket).
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("No autorizado", { status: 401 });
  }
  const admin = crearClienteAdmin();
  let fallo = false;
  let fotos = { revisados: 0, borrados: 0 };
  let comprobantes = { vencidos: 0, huerfanos: 0 };
  // Cada limpieza va aparte: si una falla, la otra igual corre.
  try {
    fotos = await limpiarFotosHuerfanas(admin);
    registrar("info", { evento: "limpieza_fotos_huerfanas", ...fotos });
  } catch (error) {
    fallo = true;
    registrar("error", { evento: "limpieza_fotos_fallo", mensaje: error instanceof Error ? error.message : String(error) });
  }
  try {
    comprobantes = await limpiarComprobantes(admin);
    registrar("info", { evento: "limpieza_comprobantes", ...comprobantes });
  } catch (error) {
    fallo = true;
    registrar("error", { evento: "limpieza_comprobantes_fallo", mensaje: error instanceof Error ? error.message : String(error) });
  }
  if (fallo) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true, ...fotos, comprobantes });
}
