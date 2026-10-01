import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CarneVirtual } from "@/components/ui/CarneVirtual";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { cargarPerfilAsociado } from "@/lib/asociado/servidor";
import { esTokenCarne, rutaVerificacion } from "@/lib/carne";
import { qrComoSvg } from "@/lib/carneQr";
import { hoyBogota } from "@/lib/fechas";
import { registrar } from "@/lib/servidor/registro";
import { urlDelSitio } from "@/lib/servidor/sitio";
import { createClient } from "@/lib/supabase/server";
import { BotonRegenerar } from "./BotonRegenerar";

export const metadata: Metadata = {
  title: "Mi carné con QR · Cooperativa Green Alliance",
  robots: { index: false, follow: false },
};

// El token cambia al regenerar: nunca se sirve una versión guardada.
export const dynamic = "force-dynamic";

/**
 * Carné grande con QR (pantalla propia, pedido de Sebas). El QR apunta a
 * <sitio>/verificar/<token>; esa página pública solo muestra nombre, grado,
 * institución y estado. Protegida por proxy.ts («/cuenta/:path*») y aquí otra vez.
 */
export default async function CarneQrPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const perfil = await cargarPerfilAsociado(supabase, user.id, { tienePendiente: false, hoy: hoyBogota(new Date()) });
  if (perfil && !perfil.activo) redirect(RUTA_CUENTA_INACTIVA);

  const { data: token, error } = await supabase.rpc("mi_carne_token");
  if (error) registrar("error", { evento: "carne_token_fallo", codigo: error.code, mensaje: error.message });

  let svg: string | null = null;
  if (esTokenCarne(token)) {
    svg = await qrComoSvg(await urlDelSitio(rutaVerificacion(token)));
  }

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-5 py-6 lg:py-10">
      <Link
        href="/cuenta"
        className="text-15 font-bold text-ga-verde no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
      >
        ← Volver a mi cuenta
      </Link>
      <h1 className="m-0 font-display text-26 font-extrabold text-ga-navy">Tu carné con QR</h1>

      <CarneVirtual
        nombre={perfil?.nombre ?? "Asociado"}
        cedula={perfil?.cedula ?? "—"}
        grado={perfil?.gradoNombre ?? "Sin asignar"}
        institucion={perfil?.institucion ?? undefined}
        activo={perfil ? perfil.activo : undefined}
        hrefQr={null}
        hrefConvenios="/cuenta#convenios"
      />

      <section aria-labelledby="titulo-qr" className="flex flex-col items-center gap-4 rounded-28 bg-white p-6 text-center">
        <h2 id="titulo-qr" className="m-0 font-display text-20 font-extrabold text-ga-navy">
          Código QR de verificación
        </h2>
        {svg ? (
          <div
            role="img"
            aria-label="Código QR que lleva a la verificación pública de tu carné"
            className="h-56 w-56 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="m-0 text-15 text-ga-texto-2">No se pudo generar el código en este momento. Intenta de nuevo.</p>
        )}
        <p className="m-0 max-w-[460px] text-14 leading-150 text-ga-texto-2">
          Quien lo escanee verá tu nombre, grado, institución y si estás activo. No muestra tu cédula, celular ni
          datos de crédito. Si lo compartiste por error, regenéralo: el código anterior deja de funcionar.
        </p>
        {svg ? (
          // Descarga directa (route handler): <a download>, no navegación de Next.
          <a
            href="/cuenta/carne/pdf"
            download="carne-green-alliance.pdf"
            className="flex h-12 items-center justify-center rounded-full bg-ga-verde px-8 text-15 font-extrabold text-white no-underline transition-colors duration-200 hover:bg-ga-verde-oscuro hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
          >
            Descargar PDF
          </a>
        ) : null}
        <BotonRegenerar />
      </section>
    </main>
  );
}
