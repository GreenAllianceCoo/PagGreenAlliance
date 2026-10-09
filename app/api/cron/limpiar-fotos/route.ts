import { cronAutorizado, limpiarFotosHuerfanas, limpiarFotosCarneHuerfanas } from "@/lib/afiliacion/limpiezaFotos";
import { limpiarComprobantes } from "@/lib/admin/limpiezaComprobantes";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * RS-03: tarea programada (vercel.json) que borra:
 * - Del bucket `afiliacion-documentos`: fotos de solicitudes >3h sin vincularse (limpiarFotosHuerfanas).
 * - Del bucket `fotos-carne`: fotos >24h que no son vigentes en ningún perfil (limpiarFotosCarneHuerfanas, H-09).
 * - Comprobantes de desembolso: vencidos (30d de asociados eliminados) e huérfanos (>24h sin vincular).
 * Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`; si falta o no coincide, responde 401.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("No autorizado", { status: 401 });
  }
  const admin = crearClienteAdmin();
  let fallo = false;
  let fotosAfiliacion = { revisados: 0, borrados: 0 };
  let fotosCarne = { revisados: 0, borrados: 0 };
  let comprobantes = { vencidos: 0, huerfanos: 0 };
  // Cada limpieza va aparte: si una falla, la otra igual corre.
  try {
    fotosAfiliacion = await limpiarFotosHuerfanas(admin);
    registrar("info", { evento: "limpieza_fotos_huerfanas", ...fotosAfiliacion });
  } catch (error) {
    fallo = true;
    registrar("error", { evento: "limpieza_fotos_fallo", mensaje: error instanceof Error ? error.message : String(error) });
  }
  try {
    fotosCarne = await limpiarFotosCarneHuerfanas(admin);
    registrar("info", { evento: "limpieza_fotos_carne_huerfanas", ...fotosCarne });
  } catch (error) {
    fallo = true;
    registrar("error", { evento: "limpieza_fotos_carne_fallo", mensaje: error instanceof Error ? error.message : String(error) });
  }
  try {
    comprobantes = await limpiarComprobantes(admin);
    registrar("info", { evento: "limpieza_comprobantes", ...comprobantes });
  } catch (error) {
    fallo = true;
    registrar("error", { evento: "limpieza_comprobantes_fallo", mensaje: error instanceof Error ? error.message : String(error) });
  }
  if (fallo) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true, ...fotosAfiliacion, fotosCarne, comprobantes });
}
