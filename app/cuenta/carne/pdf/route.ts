import { cargarPerfilAsociado } from "@/lib/asociado/servidor";
import { esTokenCarne, rutaVerificacion } from "@/lib/carne";
import { fotoCarneParaPdf } from "@/lib/carneFoto";
import { generarCarnePdf } from "@/lib/carnePdf";
import { hoyBogota } from "@/lib/fechas";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CABECERAS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

/**
 * Descarga del carné en PDF. Exige sesión y solo genera el del propio asociado
 * (todo sale de la sesión; no recibe ids). El asociado dado de baja no obtiene PDF.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401, headers: CABECERAS });

  const perfil = await cargarPerfilAsociado(supabase, user.id, { tienePendiente: false, hoy: hoyBogota(new Date()) });
  if (!perfil) return new Response("No encontrado", { status: 404, headers: CABECERAS });
  if (!perfil.activo) return new Response("Cuenta inactiva", { status: 403, headers: CABECERAS });

  const { data: token, error } = await supabase.rpc("mi_carne_token");
  if (error) registrar("error", { evento: "carne_pdf_token_fallo", codigo: error.code, mensaje: error.message });
  if (!esTokenCarne(token)) return new Response("No se pudo generar el carné", { status: 500, headers: CABECERAS });

  try {
    const foto = await fotoCarneParaPdf(user.id);
    const bytes = await generarCarnePdf({
      foto,
      nombre: perfil.nombre,
      grado: perfil.gradoNombre ?? "Sin asignar",
      institucion: perfil.institucion,
      cedula: perfil.cedula,
      urlVerificacion: await urlDelSitio(rutaVerificacion(token)),
    });
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...CABECERAS,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="carne-green-alliance.pdf"',
      },
    });
  } catch (e) {
    registrar("error", { evento: "carne_pdf_fallo", mensaje: e instanceof Error ? e.message : "desconocido" });
    return new Response("No se pudo generar el carné", { status: 500, headers: CABECERAS });
  }
}
