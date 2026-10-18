import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cerrarSesion } from "@/app/cuenta/actions";
import { IconoWhatsapp } from "@/components/ui/Iconos";
import { Logo } from "@/components/ui/Logo";
import { clasesBoton } from "@/components/ui/Button";
import { enlaceWhatsappFlotante } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Plataforma en pausa · Cooperativa Green Alliance",
};

const MENSAJE_POR_DEFECTO =
  "Estamos haciendo ajustes en la plataforma. Vuelve a intentarlo más tarde o escríbenos por WhatsApp.";

/**
 * Destino de proxy.ts cuando un administrador pausó el ingreso de asociados
 * (estado_pausa_cuenta(), migración 20261018000000). Si ya no hay pausa, vuelve a /cuenta.
 */
export default async function CuentaPausadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data } = await supabase.rpc("estado_pausa_cuenta").maybeSingle<{ pausada: boolean; mensaje: string | null }>();
  if (!data?.pausada) redirect("/cuenta");

  const whatsapp = enlaceWhatsappFlotante();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ga-fondo-suave px-4 py-10">
      <main className="flex w-full max-w-[480px] flex-col items-center gap-5 rounded-28 bg-white px-6 py-9 text-center shadow-comprobante">
        <Logo variant="apilado" className="w-[170px]" />
        <h1 className="m-0 font-display text-26 font-extrabold text-ga-navy">Volvemos pronto</h1>
        <p role="status" className="m-0 whitespace-pre-line text-16 leading-150 text-ga-texto-2">
          {data.mensaje ?? MENSAJE_POR_DEFECTO}
        </p>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={clasesBoton("secundario", "w-full gap-2")}>
            <IconoWhatsapp tamano={20} />
            Escribir por WhatsApp
          </a>
        ) : null}
        <form action={cerrarSesion} className="w-full">
          <button type="submit" className={clasesBoton("terciario", "w-full")}>
            Salir
          </button>
        </form>
      </main>
    </div>
  );
}
