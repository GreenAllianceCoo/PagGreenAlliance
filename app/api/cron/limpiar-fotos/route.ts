import { cronAutorizado, limpiarFotosHuerfanas } from "@/lib/afiliacion/limpiezaFotos";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * RS-03: tarea programada (vercel.json) que borra del bucket
 * `afiliacion-documentos` las fotos subidas hace más de 3 h que no
 * pertenecen a ninguna solicitud. Vercel Cron manda
 * `Authorization: Bearer <CRON_SECRET>`; si la variable falta o no coincide,
 * responde 401 y NO hace nada (ni toca la base ni el bucket).
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("No autorizado", { status: 401 });
  }
  try {
    const resultado = await limpiarFotosHuerfanas(crearClienteAdmin());
    registrar("info", { evento: "limpieza_fotos_huerfanas", ...resultado });
    return Response.json({ ok: true, ...resultado });
  } catch (error) {
    registrar("error", { evento: "limpieza_fotos_fallo", mensaje: error instanceof Error ? error.message : String(error) });
    return Response.json({ ok: false }, { status: 500 });
  }
}
